# GOVVERIFY AI — PHASE 4 PRODUCTION DEPLOYMENT CHECKLIST
## Operator Runbook, Migration Sequence, Daemon Setup & Rollback Protocol

**Prepared For:** Production Operations Lead & Database Administrator  
**Release Target:** GovVerify AI — Phase 4 Operational Reliability  
**Target Environment:** Node.js, Express, Supabase PostgreSQL, AWS AP-Northeast-1  
**Approval Requirement:** **Explicit Operator Sign-Off Required Prior to Execution**  

---

## 1. PRE-DEPLOYMENT VERIFICATION & SAFETY PREREQUISITES

Before executing any database commands or starting background workers:

- [ ] **1.1 Confirm Live Census & Invariants**  
  Execute read-only query to confirm current database baseline:
  ```bash
  npx tsx -e "import { getServerSupabase } from './src/server/supabase.js'; const s = getServerSupabase(); s.from('verification_requests').select('status').then(async ({ data: reqs }) => { const { count: resCount } = await s.from('verification_results').select('*', { count: 'exact', head: true }); const counts = {}; reqs.forEach(r => counts[r.status] = (counts[r.status] || 0) + 1); console.log(counts, 'Total:', reqs.length, 'Results:', resCount); });"
  ```
  *Expected Output:* `{ QUEUED: 31, COMPLETED: 40, PROCESSING: 6, FAILED: 26 } Total: 103 Results: 40`.

- [ ] **1.2 Verify Environment Secrets**  
  Ensure the following variables are configured in production secret manager:
  - `SUPABASE_URL` (Valid HTTPS endpoint)
  - `SUPABASE_SERVICE_ROLE_KEY` (High-privilege key for backend worker & API only)
  - `GEMINI_API_KEY` (Official Google Generative AI key)
  - `TAVILY_API_KEY` (Sovereign discovery search key)
  - `NODE_ENV=production`

- [ ] **1.3 Create Database Snapshot**  
  Perform a logical or physical backup of the Supabase PostgreSQL database via the Supabase dashboard (`Database` -> `Backups` -> `Take backup now`).

---

## 2. DATABASE MIGRATION EXECUTION SEQUENCE

- [ ] **2.1 Apply Migration SQL**  
  Open the Supabase SQL Editor and execute the contents of:  
  `supabase/migrations/20261011000000_operational_reliability.sql`

- [ ] **2.2 Verify Migration Success**  
  Run the following verification queries in the SQL Editor:

  *A. Check added columns on `verification_requests`:*
  ```sql
  SELECT column_name, data_type, is_nullable 
  FROM information_schema.columns 
  WHERE table_schema = 'public' 
    AND table_name = 'verification_requests' 
    AND column_name IN ('failure_reason', 'failure_details', 'grounding_status', 'retry_count', 'next_retry_at', 'last_attempt_at');
  ```
  *(Expected: 6 rows returned).*

  *B. Check `verification_jobs` table exists:*
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name = 'verification_jobs';
  ```
  *(Expected: 1 row returned).*

  *C. Check RLS is enabled on `verification_jobs`:*
  ```sql
  SELECT relname, relrowsecurity 
  FROM pg_class 
  WHERE relname = 'verification_jobs';
  ```
  *(Expected: `relrowsecurity = true`).*

  *D. Check stored procedure is registered:*
  ```sql
  SELECT routine_name FROM information_schema.routines 
  WHERE routine_schema = 'public' AND routine_name = 'claim_verification_jobs';
  ```
  *(Expected: 1 row returned).*

---

## 3. WORKER DAEMON PROVISIONING & STARTUP

- [ ] **3.1 Deploy Systemd Service** (Linux Host / VM)  
  Copy unit file to `/etc/systemd/system/govverify-worker.service`:
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

- [ ] **3.2 Reload & Start Service**
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl enable govverify-worker
  sudo systemctl start govverify-worker
  ```

- [ ] **3.3 Monitor Startup Logs**
  ```bash
  sudo journalctl -u govverify-worker -f
  ```
  *Expected Output:*
  ```
  [GovVerify Worker] Started background worker instance: worker-hostname-pid-xxxxxx (polling every 2500ms)
  ```

---

## 4. OPERATIONAL MONITORING & HEALTH CHECKS

- [ ] **4.1 Monitor Queue Depth & Processing Leases**
  Execute monitoring query every 10 minutes post-deployment:
  ```sql
  SELECT 
    status, 
    COUNT(*) AS job_count, 
    MIN(next_run_at) AS earliest_run, 
    MAX(attempt_count) AS max_attempts
  FROM public.verification_jobs
  GROUP BY status;
  ```

- [ ] **4.2 Check for Zombie Workers or Stale Leases**
  ```sql
  SELECT id, verification_request_id, worker_id, locked_at, lease_expires_at
  FROM public.verification_jobs
  WHERE status = 'PROCESSING' AND lease_expires_at < timezone('utc'::text, now());
  ```
  *(If any rows exist, confirm whether subsequent worker cycles reclaim them safely).*

- [ ] **4.3 Monitor Rate Limit & Telemetry Events**
  ```sql
  SELECT failure_reason, COUNT(*) AS occurrences
  FROM public.verification_requests
  WHERE failure_reason IS NOT NULL
  GROUP BY failure_reason;
  ```

---

## 5. EMERGENCY ROLLBACK PROTOCOL

If the worker encounters unrecoverable runtime errors or schema incompatibility:

### Step 1: Immediately Stop Worker Daemon
```bash
sudo systemctl stop govverify-worker
```

### Step 2: Revert API Gateway to In-Memory Mode
The API layer automatically falls back to in-memory processing if `verification_jobs` is unavailable.

### Step 3: Roll Back PostgreSQL Schema
Execute in the Supabase SQL Editor:
```sql
-- 1. Drop atomic claim procedure
DROP FUNCTION IF EXISTS public.claim_verification_jobs(TEXT, INT, INT);

-- 2. Drop jobs table
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

### Step 4: Re-verify Database Integrity
Confirm all 40 completed results remain fully intact:
```sql
SELECT COUNT(*) FROM public.verification_results; -- Must be >= 40
```

---

## 6. FINAL OPERATOR SIGN-OFF BOUNDARY

| Checkpoint | Responsible Party | Verification Status | Sign-off Date |
|---|---|---|---|
| **Code Review & Linting** | Lead Software Engineer | `COMPLETED` (0 lint errors) | 2026-10-11 |
| **Vite Client Bundle Build** | Frontend Lead | `COMPLETED` (248ms build) | 2026-10-11 |
| **Status Gate Test Suite** | QA Lead | `COMPLETED` (21/21 passed) | 2026-10-11 |
| **End-to-End Reliability Suite**| Reliability Engineer | `COMPLETED` (24/24 passed) | 2026-10-11 |
| **Historical Request Audit** | Data Steward | `COMPLETED` (0 writes, 103 items) | 2026-10-11 |
| **Production Migration Approval**| Database Administrator | `PENDING OPERATOR APPROVAL` | - |
| **Worker Service Startup** | DevOps Engineer | `PENDING OPERATOR APPROVAL` | - |
