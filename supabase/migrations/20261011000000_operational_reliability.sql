-- ==============================================================================
-- GOVVERIFY AI — PHASE 4.1 & 4.3: OPERATIONAL RELIABILITY & PERSISTENT QUEUE MIGRATION
-- Migration: 20261011000000_operational_reliability.sql
-- Description:
-- 1. Adds failure telemetry, grounding metadata, and retry tracking to public.verification_requests.
-- 2. Creates compound unique index on public.evidence to ensure idempotent multi-attempt discovery.
-- 3. Creates public.verification_jobs for persistent, restart-safe, multi-worker background queueing.
-- 4. Creates atomic claim stored procedure with FOR UPDATE SKIP LOCKED and fencing tokens.
-- 5. Enables strict RLS and explicit least-privilege grants (service_role exclusive).
-- ==============================================================================

-- ==============================================================================
-- 1. TELEMETRY & RETRY COLUMNS FOR VERIFICATION REQUESTS
-- ==============================================================================

DO $$
BEGIN
  -- 1.1 failure_reason: Standardized operational failure taxonomy
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'verification_requests' 
      AND column_name = 'failure_reason'
  ) THEN
    ALTER TABLE public.verification_requests
      ADD COLUMN failure_reason TEXT NULL CHECK (
        failure_reason IS NULL OR failure_reason IN (
          'QUOTA_EXHAUSTED',
          'RATE_LIMITED',
          'PROVIDER_UNAVAILABLE',
          'DISCOVERY_FAILED',
          'NO_VERIFIED_SOURCES',
          'DATABASE_ERROR',
          'INVALID_REQUEST',
          'ANALYSIS_FAILED',
          'TIMEOUT',
          'UNKNOWN'
        )
      );
  END IF;

  -- 1.2 failure_details: Sanitized operational metadata (allowlist-only, non-sensitive)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'verification_requests' 
      AND column_name = 'failure_details'
  ) THEN
    ALTER TABLE public.verification_requests
      ADD COLUMN failure_details JSONB NULL;
  END IF;

  -- 1.3 grounding_status: Grounding engine state (e.g. GROUNDED, EMPTY_RESULTS, QUOTA_EXHAUSTED)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'verification_requests' 
      AND column_name = 'grounding_status'
  ) THEN
    ALTER TABLE public.verification_requests
      ADD COLUMN grounding_status TEXT NULL;
  END IF;

  -- 1.4 retry_count: Number of execution attempts performed
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'verification_requests' 
      AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE public.verification_requests
      ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0);
  END IF;

  -- 1.5 next_retry_at: Timestamp scheduled for the next retry attempt
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'verification_requests' 
      AND column_name = 'next_retry_at'
  ) THEN
    ALTER TABLE public.verification_requests
      ADD COLUMN next_retry_at TIMESTAMPTZ NULL;
  END IF;

  -- 1.6 last_attempt_at: Timestamp when the latest execution attempt started
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'verification_requests' 
      AND column_name = 'last_attempt_at'
  ) THEN
    ALTER TABLE public.verification_requests
      ADD COLUMN last_attempt_at TIMESTAMPTZ NULL;
  END IF;
END $$;

-- High-frequency indexes for operational monitoring and scheduler queries
CREATE INDEX IF NOT EXISTS idx_verification_requests_retry 
  ON public.verification_requests(status, next_retry_at) 
  WHERE status IN ('QUEUED', 'FAILED');

CREATE INDEX IF NOT EXISTS idx_verification_requests_failure_reason 
  ON public.verification_requests(failure_reason) 
  WHERE failure_reason IS NOT NULL;

-- ==============================================================================
-- 2. COMPOUND UNIQUE CONSTRAINT ON EVIDENCE (MULTI-ATTEMPT IDEMPOTENCY)
-- Ensures multi-attempt discoveries are idempotent and never insert duplicate citations.
-- ==============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_evidence_request_source 
  ON public.evidence(verification_request_id, source_id);

-- ==============================================================================
-- 3. PERSISTENT BACKGROUND JOB QUEUE TABLE (verification_jobs)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.verification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id UUID NOT NULL REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL CHECK (job_type IN ('DISCOVERY', 'VERDICT', 'FULL_VERIFICATION')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ NULL,
  lease_expires_at TIMESTAMPTZ NULL,
  worker_id TEXT NULL,
  fencing_token BIGINT NOT NULL DEFAULT 1 CHECK (fencing_token >= 1),
  last_error_code TEXT NULL,
  last_error_details JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL
);

-- Idempotency constraint: At most one active job (PENDING or PROCESSING) per request and job_type
CREATE UNIQUE INDEX IF NOT EXISTS uq_verification_jobs_active 
  ON public.verification_jobs(verification_request_id, job_type) 
  WHERE status IN ('PENDING', 'PROCESSING');

-- Queue claiming index: Fast lock retrieval for eligible jobs
CREATE INDEX IF NOT EXISTS idx_verification_jobs_claim 
  ON public.verification_jobs(status, next_run_at) 
  WHERE status = 'PENDING';

-- Lease expiration index: Fast reaper retrieval for crashed workers
CREATE INDEX IF NOT EXISTS idx_verification_jobs_lease 
  ON public.verification_jobs(status, lease_expires_at) 
  WHERE status = 'PROCESSING';

-- Request linkage index
CREATE INDEX IF NOT EXISTS idx_verification_jobs_request 
  ON public.verification_jobs(verification_request_id);

-- Automatic updated_at trigger
DROP TRIGGER IF EXISTS set_verification_jobs_updated_at ON public.verification_jobs;
CREATE TRIGGER set_verification_jobs_updated_at
  BEFORE UPDATE ON public.verification_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==============================================================================
-- 4. ATOMIC JOB CLAIM FUNCTION (claim_verification_jobs)
-- Uses FOR UPDATE SKIP LOCKED to prevent concurrency races between multiple worker instances.
-- Increments fencing_token to detect and fence off stale/zombie workers.
-- ==============================================================================

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
  v_now TIMESTAMPTZ := NOW();
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

-- ==============================================================================
-- 5. ROW-LEVEL SECURITY & LEAST-PRIVILEGE PERMISSIONS
-- Browser clients (anon & authenticated) have NO direct access to jobs or claim function.
-- Only the backend worker (service_role) can access job queue functions.
-- ==============================================================================

ALTER TABLE public.verification_jobs ENABLE ROW LEVEL SECURITY;

-- Explicitly revoke public/client access
REVOKE ALL ON public.verification_jobs FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.claim_verification_jobs(TEXT, INT, INT) FROM anon, authenticated, public;

-- Grant exclusive access to service_role (backend worker)
GRANT ALL ON public.verification_jobs TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_verification_jobs(TEXT, INT, INT) TO service_role;
