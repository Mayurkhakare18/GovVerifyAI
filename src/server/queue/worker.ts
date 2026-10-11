/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Persistent Background Verification Worker
 * Autonomous worker process claiming jobs atomically via PostgreSQL,
 * executing sovereign discovery & verdict analysis, managing leases,
 * enforcing fencing tokens, and applying quota-aware retry backoff.
 */

import os from 'os';
import { getServerSupabase } from '../supabase.js';
import {
  claimVerificationJobs,
  completeVerificationJob,
  failVerificationJob,
  renewJobLease,
  VerificationJobRecord,
} from './jobQueue.js';
import { evaluateRetry } from './retryPolicy.js';
import { classifyError } from '../services/errorClassification.js';
import { discoverAndPersistSourcesForRequest } from '../services/sourceDiscovery.js';
import { analyzeAndPersistVerdictForRequest } from '../services/verdictAnalysis.js';
import { persistRequestTelemetry } from '../services/telemetry.js';

export interface WorkerOptions {
  workerId?: string;
  pollIntervalMs?: number;
  batchSize?: number;
  leaseSeconds?: number;
  maxConsecutiveErrors?: number;
  shutdownTimeoutMs?: number;
}

export class VerificationWorker {
  public readonly workerId: string;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly leaseSeconds: number;
  private isRunning: boolean = false;
  private isShuttingDown: boolean = false;
  private inFlightJobsCount: number = 0;
  private pollTimer: NodeJS.Timeout | null = null;
  private heartbeatTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options?: WorkerOptions) {
    const randomHex = Math.random().toString(36).slice(2, 8);
    this.workerId = options?.workerId || `worker-${os.hostname().slice(0, 12)}-${process.pid}-${randomHex}`;
    this.pollIntervalMs = options?.pollIntervalMs || 2500;
    this.batchSize = options?.batchSize || 1;
    this.leaseSeconds = options?.leaseSeconds || 60;
  }

  /**
   * Starts the worker polling loop.
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isShuttingDown = false;
    console.log(`[GovVerify Worker] Started background worker instance: ${this.workerId} (polling every ${this.pollIntervalMs}ms)`);
    this.scheduleNextPoll(100);
  }

  /**
   * Stops the worker and cleanly drains active jobs.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    console.log(`[GovVerify Worker] Stopping worker ${this.workerId}...`);
    this.isShuttingDown = true;
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Clear active heartbeats
    for (const timer of this.heartbeatTimers.values()) {
      clearInterval(timer);
    }
    this.heartbeatTimers.clear();

    // Wait for active in-flight jobs to drain
    const start = Date.now();
    while (this.inFlightJobsCount > 0 && Date.now() - start < 10000) {
      await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`[GovVerify Worker] Worker ${this.workerId} stopped cleanly.`);
  }

  private scheduleNextPoll(delayMs: number): void {
    if (!this.isRunning || this.isShuttingDown) return;
    this.pollTimer = setTimeout(() => {
      this.pollAndProcess().catch((err) => {
        console.error(`[GovVerify Worker] Unexpected error in poll cycle:`, err.message);
      }).finally(() => {
        this.scheduleNextPoll(this.pollIntervalMs);
      });
    }, delayMs);
  }

  /**
   * Single polling execution cycle.
   */
  public async pollAndProcess(): Promise<number> {
    if (this.isShuttingDown) return 0;

    let claimedJobs: VerificationJobRecord[] = [];
    try {
      claimedJobs = await claimVerificationJobs(this.workerId, this.batchSize, this.leaseSeconds);
    } catch (err: any) {
      console.warn(`[GovVerify Worker] Notice claiming jobs:`, err.message);
      return 0;
    }

    if (claimedJobs.length === 0) {
      return 0;
    }

    console.log(`[GovVerify Worker ${this.workerId}] Claimed ${claimedJobs.length} eligible job(s).`);

    // Process claimed jobs in parallel up to batch size
    const promises = claimedJobs.map((job) => this.processSingleJob(job));
    await Promise.all(promises);

    return claimedJobs.length;
  }

  /**
   * Processes a single claimed verification job.
   */
  public async processSingleJob(job: VerificationJobRecord): Promise<void> {
    this.inFlightJobsCount++;
    const requestId = job.verification_request_id;
    console.log(`[GovVerify Worker ${this.workerId}] Executing job ${job.id} (type: ${job.job_type}, req: ${requestId}, attempt: ${job.attempt_count}/${job.max_attempts}).`);

    // Start lease renewal heartbeat every half lease duration
    const heartbeatIntervalMs = Math.max(5000, (this.leaseSeconds * 1000) / 2);
    const heartbeat = setInterval(async () => {
      try {
        await renewJobLease(job.id, this.workerId, job.fencing_token, this.leaseSeconds);
      } catch {
        // Heartbeat failure is non-fatal; worker will attempt completion with fencing token
      }
    }, heartbeatIntervalMs);
    this.heartbeatTimers.set(job.id, heartbeat);

    try {
      const supabase = getServerSupabase();

      // Step 1: Validate request state
      const { data: requestRecord, error: reqErr } = await supabase
        .from('verification_requests')
        .select('*, verification_results(*)')
        .eq('id', requestId)
        .single();

      if (reqErr || !requestRecord) {
        throw new Error(`Verification request ${requestId} not found.`);
      }

      // Step 2: Overwrite Protection Guard — If already completed with a valid result, do NOT re-execute!
      const existingResults = requestRecord.verification_results || [];
      if (requestRecord.status === 'COMPLETED' && existingResults.length > 0) {
        console.log(`[GovVerify Worker] Request ${requestId} is already COMPLETED with result. Completing job immediately.`);
        await completeVerificationJob(job.id, job.fencing_token);
        return;
      }

      // Step 3: Execute discovery step if needed
      let discoveryResult: any = null;
      if (job.job_type === 'DISCOVERY' || job.job_type === 'FULL_VERIFICATION') {
        discoveryResult = await discoverAndPersistSourcesForRequest(requestId);
      }

      // Step 4: Execute verdict step if needed
      if (job.job_type === 'VERDICT') {
        await analyzeAndPersistVerdictForRequest(requestId);
      } else if (job.job_type === 'FULL_VERIFICATION') {
        if (discoveryResult && discoveryResult.hasVerifiedEvidence) {
          await analyzeAndPersistVerdictForRequest(requestId);
        } else {
          console.log(`[GovVerify Worker] Discovery for ${requestId} yielded 0 verified evidence. Handled as honest insufficient evidence or terminal failure.`);
        }
      }

      // Step 5: Mark job completed with fencing token enforcement
      const completionResult = await completeVerificationJob(job.id, job.fencing_token);
      if (completionResult.fencedOut) {
        console.warn(`[GovVerify Worker] Stale worker fenced out for job ${job.id}. Lease was reclaimed by another worker.`);
      } else {
        console.log(`[GovVerify Worker] Successfully completed job ${job.id} for request ${requestId}.`);
      }
    } catch (err: any) {
      console.error(`[GovVerify Worker] Execution error processing job ${job.id}:`, err.message);

      // Step 6: Classify error and evaluate retry backoff
      const classified = classifyError(err, {
        phase: job.job_type === 'VERDICT' ? 'VERDICT' : 'DISCOVERY',
        requestId,
        attemptNumber: job.attempt_count,
      });

      const retryEval = evaluateRetry(classified.failureReason, job.attempt_count, {
        retryAfterSeconds: classified.suggestedBackoffSeconds,
        customMaxAttempts: job.max_attempts,
      });

      // Update request operational telemetry
      await persistRequestTelemetry(requestId, {
        status: retryEval.shouldRetry ? 'QUEUED' : 'FAILED',
        failureReason: classified.failureReason,
        failureDetails: classified.sanitizedDetails,
        retryCount: job.attempt_count,
        nextRetryAt: retryEval.nextRunAt ? retryEval.nextRunAt.toISOString() : null,
      });

      // Update job state in queue
      const failResult = await failVerificationJob(job.id, job.fencing_token, classified, retryEval);
      if (failResult.fencedOut) {
        console.warn(`[GovVerify Worker] Fenced out during failure transition for job ${job.id}.`);
      } else if (failResult.willRetry) {
        console.log(`[GovVerify Worker] Scheduled retry for job ${job.id} at ${retryEval.nextRunAt?.toISOString()} (${retryEval.reason}).`);
      } else {
        console.log(`[GovVerify Worker] Terminal failure reached for job ${job.id} (${retryEval.reason}).`);
      }
    } finally {
      const hb = this.heartbeatTimers.get(job.id);
      if (hb) {
        clearInterval(hb);
        this.heartbeatTimers.delete(job.id);
      }
      this.inFlightJobsCount--;
    }
  }
}

// Standalone execution entrypoint when run directly via CLI (tsx src/server/queue/worker.ts)
if (process.argv[1]?.includes('worker.ts') || process.argv[1]?.includes('worker.js')) {
  const worker = new VerificationWorker();
  worker.start();

  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down worker gracefully...`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
