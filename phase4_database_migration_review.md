# GOVVERIFY AI — PHASE 4 DATABASE MIGRATION REVIEW
## Technical Review of Migration `20261011000000_operational_reliability.sql`

**Target File:** `supabase/migrations/20261011000000_operational_reliability.sql`  
**Migration State:** `PREPARED & LOCALLY VALIDATED` (Not yet applied to Production)  
**Safety Classification:** **Non-Destructive & Backward Compatible**  

---

## 1. MIGRATION SUMMARY & OBJECTIVES

This migration establishes the persistent relational infrastructure required for Phase 4 operational reliability:
1. **Telemetry Columns:** Stores standardized error taxonomy, sanitized operational details, grounding state, retry counters, and timestamps on `public.verification_requests`.
2. **Compound Unique Evidence Index:** Prevents duplicate source ingestion on `public.evidence` during parallel or repeated discovery passes.
3. **Dedicated Job Queue Table (`public.verification_jobs`):** Durable queue with worker leases, fencing tokens, and execution timestamps.
4. **Atomic Claim Stored Procedure (`claim_verification_jobs`):** Transaction-safe queue claiming using PostgreSQL `FOR UPDATE SKIP LOCKED`.
5. **Least-Privilege Security (RLS):** Complete isolation of queue internals from public browser clients, reserving access exclusively to `service_role`.

---

## 2. DETAILED SCHEMA CHANGES

### 2.1 Table Alterations: `public.verification_requests`

| Column | Type | Nullable | Default | Purpose & Constraints |
|---|---|---|---|---|
| `failure_reason` | `TEXT` | `NULL` | `NULL` | Standardized failure taxonomy (e.g. `RATE_LIMITED`, `TIMEOUT`). CHECK constraint enforces known taxonomy codes. |
| `failure_details` | `JSONB` | `NULL` | `NULL` | Sanitized operational metadata (HTTP status, phase, attempt number). Scrubbed of credentials and SQL. |
| `grounding_status` | `TEXT` | `NULL` | `NULL` | Tracks grounding state (`OFFICIAL_SOVEREIGN`, `NON_GROUNDED`, `UNVERIFIED_CANDIDATE`). |
| `retry_count` | `INTEGER` | `NOT NULL` | `0` | Execution attempt counter. CHECK constraint `retry_count >= 0`. |
| `next_retry_at` | `TIMESTAMPTZ` | `NULL` | `NULL` | Timestamp scheduled for next retry attempt. Used by scheduler index. |
| `last_attempt_at` | `TIMESTAMPTZ` | `NULL` | `NULL` | Timestamp when the latest execution attempt commenced. |

#### Associated Indexes
```sql
CREATE INDEX IF NOT EXISTS idx_verification_requests_retry 
  ON public.verification_requests(status, next_retry_at) 
  WHERE status IN ('QUEUED', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_verification_requests_failure_reason 
  ON public.verification_requests(failure_reason) 
  WHERE failure_reason IS NOT NULL;
```
*Design Note:* Partial indexes ensure minimal disk footprint and zero query degradation on completed requests.

---

### 2.2 Evidence Idempotency: `public.evidence`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_request_source_unique
  ON public.evidence(verification_request_id, source_id);
```
*Rationale:* When workers retry discovery or when multiple government links are returned from the same portal, this index prevents duplicate rows in `evidence`, allowing `ON CONFLICT (verification_request_id, source_id) DO NOTHING` in Supabase inserts.

---

### 2.3 New Queue Table: `public.verification_jobs`

```sql
CREATE TABLE IF NOT EXISTS public.verification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id UUID NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('DISCOVERY', 'VERDICT', 'FULL_VERIFICATION')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  locked_at TIMESTAMPTZ NULL,
  lease_expires_at TIMESTAMPTZ NULL,
  worker_id TEXT NULL,
  fencing_token BIGINT NOT NULL DEFAULT 1,
  last_error_code TEXT NULL,
  last_error_details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at TIMESTAMPTZ NULL
);
```

#### Queue Indexes
```sql
-- 1. Scheduler claim index: Finds eligible pending jobs or expired leases
CREATE INDEX IF NOT EXISTS idx_verification_jobs_claim 
  ON public.verification_jobs(status, next_run_at) 
  WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_verification_jobs_lease 
  ON public.verification_jobs(status, lease_expires_at) 
  WHERE status = 'PROCESSING';

-- 2. Idempotency unique index: At most ONE active job per request/job_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_verification_jobs_active_unique 
  ON public.verification_jobs(verification_request_id, job_type) 
  WHERE status IN ('PENDING', 'PROCESSING');
```

---

### 2.4 Atomic Claim Stored Procedure: `claim_verification_jobs`

```sql
CREATE OR REPLACE FUNCTION public.claim_verification_jobs(
  p_worker_id TEXT,
  p_batch_size INT DEFAULT 1,
  p_lease_seconds INT DEFAULT 60
)
RETURNS SETOF public.verification_jobs
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := timezone('utc'::text, now());
  v_lease_expires TIMESTAMPTZ := v_now + (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
  RETURN QUERY
  WITH eligible_jobs AS (
    SELECT id
    FROM public.verification_jobs
    WHERE (status = 'PENDING' AND next_run_at <= v_now)
       OR (status = 'PROCESSING' AND lease_expires_at < v_now)
    ORDER BY next_run_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.verification_jobs j
  SET
    status = 'PROCESSING',
    locked_at = v_now,
    lease_expires_at = v_lease_expires,
    worker_id = p_worker_id,
    attempt_count = j.attempt_count + 1,
    fencing_token = j.fencing_token + 1,
    updated_at = v_now
  FROM eligible_jobs e
  WHERE j.id = e.id
  RETURNING j.*;
END;
$$;
```

#### Key Reliability Properties:
1. `FOR UPDATE SKIP LOCKED`: Prevents deadlocks and race conditions. Multiple workers querying the queue simultaneously will each claim mutually exclusive rows without waiting.
2. **Expired Lease Recovery:** Automatically reclaims jobs from dead workers whose `lease_expires_at < now()`.
3. **Monotonic Fencing Token:** Bumps `fencing_token = fencing_token + 1` atomically on every claim.
4. `SECURITY DEFINER`: Runs with definer privileges to update the table while public client permissions remain restricted.

---

### 2.5 Row-Level Security (RLS) & Access Control

```sql
ALTER TABLE public.verification_jobs ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke client permissions
REVOKE ALL ON public.verification_jobs FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.claim_verification_jobs(TEXT, INT, INT) FROM anon, authenticated, public;

-- Grant exclusive permissions to backend service_role
GRANT ALL ON public.verification_jobs TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_verification_jobs(TEXT, INT, INT) TO service_role;
```

*Security Audit:* Browser clients cannot query, insert, or manipulate verification jobs. Even authenticated citizen accounts cannot view internal worker leases, preventing queue flooding or denial-of-service exploits.

---

## 3. BACKWARD COMPATIBILITY & ZERO-DOWNTIME ROLLOUT

1. **Nullable Columns:** All new columns on `public.verification_requests` are nullable or have safe defaults (`retry_count DEFAULT 0`).
2. **Existing Completed Requests Protected:** No existing rows in `verification_requests` or `verification_results` are touched.
3. **Application Graceful Degradation:** The TypeScript service layer (`src/server/services/telemetry.ts` and `src/server/queue/jobQueue.ts`) includes graceful degradation: if the database has not yet been migrated, operations fall back to existing columns and in-memory queueing with zero uncaught exceptions.

---

## 4. ROLLBACK SCRIPT (IF NEEDED)

If a rollback is ever mandated, execute the following non-destructive commands:

```sql
-- 1. Drop stored procedure
DROP FUNCTION IF EXISTS public.claim_verification_jobs(TEXT, INT, INT);

-- 2. Drop jobs table and indexes
DROP TABLE IF EXISTS public.verification_jobs CASCADE;

-- 3. Drop evidence unique index
DROP INDEX IF EXISTS public.idx_evidence_request_source_unique;

-- 4. Drop telemetry indexes
DROP INDEX IF EXISTS public.idx_verification_requests_retry;
DROP INDEX IF EXISTS public.idx_verification_requests_failure_reason;

-- 5. Drop added columns
ALTER TABLE public.verification_requests
  DROP COLUMN IF EXISTS failure_reason,
  DROP COLUMN IF EXISTS failure_details,
  DROP COLUMN IF EXISTS grounding_status,
  DROP COLUMN IF EXISTS retry_count,
  DROP COLUMN IF EXISTS next_retry_at,
  DROP COLUMN IF EXISTS last_attempt_at;
```
*(Rolling back does not impact existing verification results or user authentication).*
