/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Persistent Job Queue Management Service
 * Manages atomic job insertion, transaction-safe claims via FOR UPDATE SKIP LOCKED,
 * lease renewal, fencing token enforcement, and completion tracking.
 */

import { getServerSupabase } from '../supabase.js';
import { ClassifiedError } from '../services/errorClassification.js';
import { RetryEvaluation } from './retryPolicy.js';

export type JobType = 'DISCOVERY' | 'VERDICT' | 'FULL_VERIFICATION';
export type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface VerificationJobRecord {
  id: string;
  verification_request_id: string;
  job_type: JobType;
  status: JobStatus;
  attempt_count: number;
  max_attempts: number;
  next_run_at: string;
  locked_at: string | null;
  lease_expires_at: string | null;
  worker_id: string | null;
  fencing_token: number;
  last_error_code: string | null;
  last_error_details: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface EnqueueJobOptions {
  maxAttempts?: number;
  delaySeconds?: number;
  jobType?: JobType;
}

// Global cached state tracking whether the verification_jobs table is active in the DB
let queueTableSupported: boolean | null = null;
let forceInMemoryMode: boolean = false;

// In-memory fallback queue for testing or environments where migration has not yet run
const inMemoryJobs = new Map<string, VerificationJobRecord>();

/**
 * Resets in-memory queue state (for testing).
 */
export function resetInMemoryQueue(): void {
  inMemoryJobs.clear();
  if (!forceInMemoryMode) {
    queueTableSupported = null;
  }
}

/**
 * Sets whether to force in-memory queue mode (for testing).
 */
export function setForceInMemoryQueue(force: boolean): void {
  forceInMemoryMode = force;
  queueTableSupported = force ? false : null;
}

/**
 * Enqueues a verification job with strict idempotency (at most one active job per request/type).
 */
export async function enqueueVerificationJob(
  verificationRequestId: string,
  jobType: JobType = 'FULL_VERIFICATION',
  options?: EnqueueJobOptions
): Promise<{ success: boolean; jobId: string; isDuplicate: boolean; mode: 'DATABASE' | 'MEMORY' }> {
  const supabase = getServerSupabase();
  const maxAttempts = options?.maxAttempts || 3;
  const delaySec = options?.delaySeconds || 0;
  const nextRunAt = new Date(Date.now() + delaySec * 1000).toISOString();

  // Try PostgreSQL queue table if not forced to memory and not known to be unmigrated
  if (!forceInMemoryMode && queueTableSupported !== false) {
    try {
      // 1. Check for existing active job to guarantee idempotency
      const { data: existingJob, error: checkErr } = await supabase
        .from('verification_jobs')
        .select('id, status, fencing_token')
        .eq('verification_request_id', verificationRequestId)
        .eq('job_type', jobType)
        .in('status', ['PENDING', 'PROCESSING'])
        .maybeSingle();

      if (!checkErr && existingJob) {
        return {
          success: true,
          jobId: existingJob.id,
          isDuplicate: true,
          mode: 'DATABASE',
        };
      }

      // 2. Insert new pending job
      const { data: inserted, error: insertErr } = await supabase
        .from('verification_jobs')
        .insert({
          verification_request_id: verificationRequestId,
          job_type: jobType,
          status: 'PENDING',
          max_attempts: maxAttempts,
          next_run_at: nextRunAt,
          fencing_token: 1,
        })
        .select()
        .single();

      if (!insertErr && inserted) {
        queueTableSupported = true;
        return {
          success: true,
          jobId: inserted.id,
          isDuplicate: false,
          mode: 'DATABASE',
        };
      }

      if (insertErr && (insertErr.message?.includes('does not exist') || insertErr.message?.includes('42P01') || insertErr.code === '42P01')) {
        queueTableSupported = false;
      }
    } catch {
      queueTableSupported = false;
    }
  }

  // In-memory fallback queue for testing or unmigrated environments
  for (const job of inMemoryJobs.values()) {
    if (
      job.verification_request_id === verificationRequestId &&
      job.job_type === jobType &&
      (job.status === 'PENDING' || job.status === 'PROCESSING')
    ) {
      return {
        success: true,
        jobId: job.id,
        isDuplicate: true,
        mode: 'MEMORY',
      };
    }
  }

  const id = `mem-job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();
  const memJob: VerificationJobRecord = {
    id,
    verification_request_id: verificationRequestId,
    job_type: jobType,
    status: 'PENDING',
    attempt_count: 0,
    max_attempts: maxAttempts,
    next_run_at: nextRunAt,
    locked_at: null,
    lease_expires_at: null,
    worker_id: null,
    fencing_token: 1,
    last_error_code: null,
    last_error_details: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
  inMemoryJobs.set(id, memJob);

  return {
    success: true,
    jobId: id,
    isDuplicate: false,
    mode: 'MEMORY',
  };
}

/**
 * Claims eligible pending or expired jobs atomically.
 * Uses stored procedure claim_verification_jobs with FOR UPDATE SKIP LOCKED.
 */
export async function claimVerificationJobs(
  workerId: string,
  batchSize: number = 1,
  leaseSeconds: number = 60
): Promise<VerificationJobRecord[]> {
  const supabase = getServerSupabase();

  if (!forceInMemoryMode && queueTableSupported !== false) {
    try {
      // 1. Try PostgreSQL stored procedure
      const { data, error } = await supabase.rpc('claim_verification_jobs', {
        p_worker_id: workerId,
        p_batch_size: batchSize,
        p_lease_seconds: leaseSeconds,
      });

      if (!error && Array.isArray(data)) {
        queueTableSupported = true;
        return data as VerificationJobRecord[];
      }

      // If stored procedure doesn't exist, fall back to atomic update via select & update
      if (error && (error.message?.includes('function') || error.message?.includes('does not exist'))) {
        const now = new Date();
        const leaseExpires = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
        const nowIso = now.toISOString();

        // Select candidate jobs
        const { data: candidates } = await supabase
          .from('verification_jobs')
          .select('*')
          .or(`and(status.eq.PENDING,next_run_at.lte.${nowIso}),and(status.eq.PROCESSING,lease_expires_at.lt.${nowIso})`)
          .order('next_run_at', { ascending: true })
          .limit(batchSize);

        const claimed: VerificationJobRecord[] = [];
        for (const job of candidates || []) {
          const { data: updated } = await supabase
            .from('verification_jobs')
            .update({
              status: 'PROCESSING',
              locked_at: nowIso,
              lease_expires_at: leaseExpires,
              worker_id: workerId,
              attempt_count: (job.attempt_count || 0) + 1,
              fencing_token: (job.fencing_token || 1) + 1,
              updated_at: nowIso,
            })
            .eq('id', job.id)
            .eq('fencing_token', job.fencing_token)
            .select()
            .single();

          if (updated) {
            claimed.push(updated as VerificationJobRecord);
          }
        }
        return claimed;
      }
    } catch {
      queueTableSupported = false;
    }
  }

  // In-memory queue atomic claim logic
  const now = Date.now();
  const claimed: VerificationJobRecord[] = [];

  for (const job of inMemoryJobs.values()) {
    if (claimed.length >= batchSize) break;

    const nextRun = Date.parse(job.next_run_at);
    const leaseExp = job.lease_expires_at ? Date.parse(job.lease_expires_at) : 0;

    const isEligiblePending = job.status === 'PENDING' && nextRun <= now;
    const isExpiredProcessing = job.status === 'PROCESSING' && leaseExp < now;

    if (isEligiblePending || isExpiredProcessing) {
      job.status = 'PROCESSING';
      job.locked_at = new Date(now).toISOString();
      job.lease_expires_at = new Date(now + leaseSeconds * 1000).toISOString();
      job.worker_id = workerId;
      job.attempt_count = job.attempt_count + 1;
      job.fencing_token = job.fencing_token + 1;
      job.updated_at = new Date(now).toISOString();
      claimed.push({ ...job });
    }
  }

  return claimed;
}

/**
 * Marks a job as successfully completed.
 * Enforces fencing token match to ensure a stale/zombie worker cannot overwrite state.
 */
export async function completeVerificationJob(
  jobId: string,
  fencingToken: number
): Promise<{ success: boolean; fencedOut?: boolean }> {
  const supabase = getServerSupabase();
  const now = new Date().toISOString();

  if (!forceInMemoryMode && queueTableSupported !== false) {
    try {
      const { data, error } = await supabase
        .from('verification_jobs')
        .update({
          status: 'COMPLETED',
          completed_at: now,
          updated_at: now,
        })
        .eq('id', jobId)
        .eq('fencing_token', fencingToken)
        .select();

      if (!error) {
        if (!data || data.length === 0) {
          // Token mismatch: another worker bumped fencing_token after lease expiry
          return { success: false, fencedOut: true };
        }
        return { success: true };
      }
    } catch {
      // Fall through to memory
    }
  }

  const job = inMemoryJobs.get(jobId);
  if (!job) return { success: false };

  if (job.fencing_token !== fencingToken) {
    return { success: false, fencedOut: true };
  }

  job.status = 'COMPLETED';
  job.completed_at = now;
  job.updated_at = now;
  return { success: true };
}

/**
 * Fails a job, scheduling a retry if eligible or marking terminal failure.
 */
export async function failVerificationJob(
  jobId: string,
  fencingToken: number,
  classified: ClassifiedError,
  retryEval: RetryEvaluation
): Promise<{ success: boolean; fencedOut?: boolean; willRetry: boolean }> {
  const supabase = getServerSupabase();
  const now = new Date().toISOString();
  const nextStatus: JobStatus = retryEval.shouldRetry ? 'PENDING' : 'FAILED';
  const nextRunAt = retryEval.nextRunAt ? retryEval.nextRunAt.toISOString() : now;

  if (!forceInMemoryMode && queueTableSupported !== false) {
    try {
      const { data, error } = await supabase
        .from('verification_jobs')
        .update({
          status: nextStatus,
          next_run_at: nextRunAt,
          last_error_code: classified.failureReason,
          last_error_details: classified.sanitizedDetails,
          completed_at: nextStatus === 'FAILED' ? now : null,
          updated_at: now,
        })
        .eq('id', jobId)
        .eq('fencing_token', fencingToken)
        .select();

      if (!error) {
        if (!data || data.length === 0) {
          return { success: false, fencedOut: true, willRetry: false };
        }
        return { success: true, willRetry: retryEval.shouldRetry };
      }
    } catch {
      // Fall through to memory
    }
  }

  const job = inMemoryJobs.get(jobId);
  if (!job) return { success: false, willRetry: false };

  if (job.fencing_token !== fencingToken) {
    return { success: false, fencedOut: true, willRetry: false };
  }

  job.status = nextStatus;
  job.next_run_at = nextRunAt;
  job.last_error_code = classified.failureReason;
  job.last_error_details = classified.sanitizedDetails;
  job.completed_at = nextStatus === 'FAILED' ? now : null;
  job.updated_at = now;

  return { success: true, willRetry: retryEval.shouldRetry };
}

/**
 * Renews the lease duration for an active long-running in-flight job.
 */
export async function renewJobLease(
  jobId: string,
  workerId: string,
  fencingToken: number,
  additionalSeconds: number = 60
): Promise<boolean> {
  const supabase = getServerSupabase();
  const now = new Date();
  const leaseExpires = new Date(now.getTime() + additionalSeconds * 1000).toISOString();

  if (!forceInMemoryMode && queueTableSupported !== false) {
    try {
      const { data, error } = await supabase
        .from('verification_jobs')
        .update({
          lease_expires_at: leaseExpires,
          updated_at: now.toISOString(),
        })
        .eq('id', jobId)
        .eq('worker_id', workerId)
        .eq('fencing_token', fencingToken)
        .eq('status', 'PROCESSING')
        .select();

      if (!error && data && data.length > 0) {
        return true;
      }
    } catch {
      // Fall through to memory
    }
  }

  const job = inMemoryJobs.get(jobId);
  if (!job) return false;

  if (job.id === jobId && job.worker_id === workerId && job.fencing_token === fencingToken && job.status === 'PROCESSING') {
    job.lease_expires_at = leaseExpires;
    job.updated_at = now.toISOString();
    return true;
  }

  return false;
}
