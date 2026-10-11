# GOVVERIFY AI — PHASE 4 QUEUE & WORKER ARCHITECTURE
## Persistent Asynchronous Execution, Concurrency Control, Lease Management & Quota-Aware Retries

**Subsystem Status:** `IMPLEMENTED & TESTED LOCALLY`  
**Production Readiness:** `DEPLOYMENT PREPARED` (Worker daemon process ready for supervision)  

---

## 1. ARCHITECTURAL OVERVIEW

The GovVerify AI verification pipeline requires durable background processing to prevent stranded requests when LLM or search provider queries take several seconds or experience rate limits.

### High-Level Architecture Diagram
```
Citizen Web UI (React/Vite)
        │
        ▼ HTTP POST /api/v1/verifications
Express API Gateway (`server.ts`, `src/server/routes/api.ts`)
        │
        ├─ 1. Inserts `verification_requests` (status: 'QUEUED')
        ├─ 2. Calls `enqueueVerificationJob(requestId, 'FULL_VERIFICATION')`
        │        │
        │        ▼ Inserts into `public.verification_jobs`
        │           (status: 'PENDING', fencing_token: 1, max_attempts: 3)
        │
        ▼ 201 Created Returned to Citizen UI (Instant acknowledgement)
-------------------------------------------------------------------------
Background Processing Boundary (Decoupled from Web Request Cycle)
-------------------------------------------------------------------------
Verification Worker Daemon (`src/server/queue/worker.ts`)
        │
        ├─ Polling Loop (every 2.5s)
        │
        ├─ Calls `claim_verification_jobs(workerId, batchSize=1, lease=60s)`
        │     │
        │     ▼ PostgreSQL `FOR UPDATE SKIP LOCKED`
        │        - Atomically locks 1 eligible pending or expired job
        │        - Sets status = 'PROCESSING', bumps fencing_token = fencing_token + 1
        │
        ├─ Spawns Lease Renewal Heartbeat (every 30s)
        │
        ├─ Executes Pipeline Steps:
        │     ├── Step 1: Validate request state & check existing results
        │     ├── Step 2: Overwrite Protection Guard (Skip if completed)
        │     ├── Step 3: Sovereign Source Discovery (`sourceDiscovery.ts`)
        │     ├── Step 4: Evidence Grounding & Provenance Filtering
        │     └── Step 5: Canonical Verdict Synthesis (`verdictAnalysis.ts`)
        │
        ├─ Success: `completeVerificationJob(jobId, fencing_token)`
        │     └── Verified against current fencing token. Updates request to COMPLETED.
        │
        └─ Failure: `classifyError(err)` + `evaluateRetry(reason, attempt)`
              ├── If retryable: schedules next_run_at with exponential backoff & jitter
              └── If terminal: marks job FAILED and persists sanitized failure telemetry
```

---

## 2. JOB STATE MACHINE & LIFECYCLE

```
                   ┌──────────────┐
                   │   ENQUEUE    │
                   └──────┬───────┘
                          │ (idempotent insert)
                          ▼
                   ┌──────────────┐
         ┌─────────┤   PENDING    │◄─────────────────┐
         │         └──────┬───────┘                  │
         │                │ (atomic claim)           │ (retry scheduled
         │                ▼                          │  with backoff)
         │         ┌──────────────┐                  │
         │         │  PROCESSING  │──────────────────┘
         │         └──┬───┬────┬──┘
(cancel) │            │   │    │ (lease expired,
         │            │   │    │  reclaimed by worker 2)
         ▼            │   │    ▼
  ┌───────────┐       │   │ ┌──────────────┐
  │ CANCELLED │       │   │ │ ZOMBIE (stale│
  └───────────┘       │   │ │  fencing out)│
                      │   │ └──────────────┘
(verdict persisted)   │   │
                      ▼   ▼ (max attempts exhausted or non-retryable)
             ┌───────────┐ ┌───────────┐
             │ COMPLETED │ │  FAILED   │
             └───────────┘ └───────────┘
```

---

## 3. CONCURRENCY & ZOMBIE WORKER FENCING

In distributed and multi-instance cloud environments, worker processes can experience garbage collection pauses, transient network partitions, or unexpected process restarts. GovVerify AI guarantees data integrity through:

### 3.1 Atomic Job Claiming (`FOR UPDATE SKIP LOCKED`)
The PostgreSQL stored procedure `claim_verification_jobs` queries candidate jobs using:
```sql
SELECT id FROM public.verification_jobs
WHERE (status = 'PENDING' AND next_run_at <= now())
   OR (status = 'PROCESSING' AND lease_expires_at < now())
ORDER BY next_run_at ASC
LIMIT p_batch_size
FOR UPDATE SKIP LOCKED;
```
This guarantees:
- Worker A and Worker B never receive the same job.
- Zero row locking contention or queue stalls.

### 3.2 Expired Lease Reclaiming
- Each claim acquires a 60-second lease (`lease_expires_at = now() + interval '60 seconds'`).
- If a worker crashes, its lease expires naturally.
- The next polling cycle allows another worker to safely reclaim the job without manual operator intervention.

### 3.3 Monotonic Fencing Tokens
- Every claim increments `fencing_token = fencing_token + 1`.
- When a worker finishes processing, it submits its assigned `fencing_token` to `completeVerificationJob(jobId, fencing_token)`.
- If a zombie worker finishes work after its lease expired and another worker already took over (bumping the token), the update condition `WHERE fencing_token = :token` affects 0 rows.
- The worker detects `fencedOut: true` and logs a warning without overwriting the newer state.

---

## 4. QUOTA-AWARE RETRY ENGINE & BACKOFF FORMULA

To protect search and AI provider budgets, the retry engine strictly differentiates short-lived rate limits from daily quota exhaustion:

### 4.1 Bounded Exponential Backoff with Full Jitter
```typescript
delay = min(maxBackoff, baseBackoff * 2^(attempt - 1)) * (1 +/- jitterFactor)
```
- **Base Backoff:** 15 seconds (30s for rate limits)
- **Max Backoff Ceiling:** 900 seconds (15 minutes)
- **Jitter Factor:** +/- 30% random spread to prevent thundering herd spikes.

### 4.2 Explicit Retry-After Honor
When Tavily or Gemini search endpoints return HTTP 429 with a valid `Retry-After` header:
- The system parses the header (seconds or HTTP date).
- The scheduled `next_run_at` matches the provider's requested wait time (capped at `maxBackoff`).

### 4.3 Quota Policy Matrix

| Failure Category | Retryable? | Max Attempts | Backoff Strategy |
|---|---|---:|---|
| `RATE_LIMITED` (HTTP 429) | **Yes** | 2 | Exponential backoff (30s base) or `Retry-After` |
| `QUOTA_EXHAUSTED` (Daily) | **No** | 0 | Immediate terminal transition; prevents quota thrashing |
| `PROVIDER_UNAVAILABLE` (503)| **Yes** | 3 | Exponential backoff with jitter (20s base) |
| `TIMEOUT` (Gateway 504) | **Yes** | 3 | Exponential backoff with jitter (15s base) |
| `DATABASE_ERROR` | **Yes** | 3 | Exponential backoff (10s base) |
| `DISCOVERY_FAILED` | **Yes** | 3 | Exponential backoff (15s base) |
| `NO_VERIFIED_SOURCES` | **No** | 0 | Honest analytical conclusion (`INSUFFICIENT_EVIDENCE`) |
| `INVALID_REQUEST` (400) | **No** | 0 | Terminal failure; bad payload cannot succeed on retry |
| `ANALYSIS_FAILED` | **No** | 0 | Terminal failure |
| `UNKNOWN` | **No** | 0 | Terminal failure; requires inspection |

---

## 5. OVERWRITE PROTECTION GUARD

The worker strictly respects historical data:
```typescript
// Step 2: Overwrite Protection Guard
const existingResults = requestRecord.verification_results || [];
if (requestRecord.status === 'COMPLETED' && existingResults.length > 0) {
  console.log(`[GovVerify Worker] Request ${requestId} is already COMPLETED. Completing job immediately.`);
  await completeVerificationJob(job.id, job.fencing_token);
  return;
}
```
If a job is enqueued for a request that already has a validated verification result, the worker marks the job complete and **never re-analyzes or mutates the existing result**.

---

## 6. WORKER PROCESS OPERATIONAL GUIDE

### Local Execution
```bash
npm run worker
```

### Production Execution (systemd Service)
Create `/etc/systemd/system/govverify-worker.service`:
```ini
[Unit]
Description=GovVerify AI Background Verification Worker
After=network.target

[Service]
Type=simple
User=govverify
WorkingDirectory=/opt/govverify-ai
ExecStart=/usr/bin/npm run worker
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/govverify-ai/.env

[Install]
WantedBy=multi-user.target
```

### Graceful Shutdown (SIGINT & SIGTERM)
The worker intercepts OS signals:
1. Stops the polling timer (`isRunning = false`, `isShuttingDown = true`).
2. Clears lease renewal heartbeat intervals.
3. Awaits completion of in-flight jobs (up to a 10-second drain window).
4. Exits cleanly with status code 0.
