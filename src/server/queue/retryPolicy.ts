/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Quota-Aware Retry Engine & Backoff Policy
 * Implements bounded exponential backoff with jitter, honors HTTP Retry-After headers,
 * applies provider-specific quota constraints, and prevents runaway retry loops.
 */

import { FailureReason, isRetryableFailure } from '../services/errorClassification.js';

export interface RetryPolicyConfig {
  maxAttempts: number;
  baseBackoffSeconds: number;
  maxBackoffSeconds: number;
  jitterFactor: number; // 0.0 - 1.0
}

export const DEFAULT_RETRY_POLICY: RetryPolicyConfig = {
  maxAttempts: 3,
  baseBackoffSeconds: 15, // 15s initial backoff
  maxBackoffSeconds: 900, // 15m maximum backoff ceiling
  jitterFactor: 0.3,      // +/- 30% jitter
};

export interface RetryEvaluation {
  shouldRetry: boolean;
  attemptNumber: number;
  maxAttempts: number;
  nextRunAt: Date | null;
  backoffSeconds: number;
  reason: string;
}

/**
 * Calculates exponential backoff with full jitter:
 * delay = min(maxBackoff, baseBackoff * 2^(attempt - 1)) * (1 +/- jitter)
 */
export function calculateBackoffWithJitter(
  attempt: number,
  config: RetryPolicyConfig = DEFAULT_RETRY_POLICY
): number {
  const boundedAttempt = Math.max(1, attempt);
  const exponential = config.baseBackoffSeconds * Math.pow(2, boundedAttempt - 1);
  const capped = Math.min(config.maxBackoffSeconds, exponential);

  // Apply jitter: [capped * (1 - jitterFactor), capped * (1 + jitterFactor)]
  const minJitter = 1 - config.jitterFactor;
  const maxJitter = 1 + config.jitterFactor;
  const randomFactor = minJitter + Math.random() * (maxJitter - minJitter);

  return Math.max(5, Math.round(capped * randomFactor));
}

/**
 * Evaluates whether an execution failure is retryable, computing the scheduled nextRunAt.
 */
export function evaluateRetry(
  failureReason: FailureReason,
  currentAttemptCount: number,
  options?: {
    retryAfterSeconds?: number;
    customMaxAttempts?: number;
    quotaResetTime?: Date;
    config?: Partial<RetryPolicyConfig>;
  }
): RetryEvaluation {
  const attempt = currentAttemptCount + 1;
  const policy: RetryPolicyConfig = {
    ...DEFAULT_RETRY_POLICY,
    ...(options?.config || {}),
  };

  // Provider rate limits default to a lower max attempt count to preserve API quota
  const maxAttempts =
    options?.customMaxAttempts ||
    (failureReason === 'RATE_LIMITED' ? 2 : policy.maxAttempts);

  // 1. Non-retryable error categories
  if (!isRetryableFailure(failureReason)) {
    return {
      shouldRetry: false,
      attemptNumber: attempt,
      maxAttempts,
      nextRunAt: null,
      backoffSeconds: 0,
      reason: `Failure reason "${failureReason}" is classified as non-retryable. Immediate terminal transition.`,
    };
  }

  // 2. Maximum attempts exhausted
  if (attempt >= maxAttempts) {
    return {
      shouldRetry: false,
      attemptNumber: attempt,
      maxAttempts,
      nextRunAt: null,
      backoffSeconds: 0,
      reason: `Maximum retry attempts (${maxAttempts}) exhausted for failure reason "${failureReason}".`,
    };
  }

  // 3. Explicit Retry-After header provided by search provider (HTTP 429)
  if (options?.retryAfterSeconds && options.retryAfterSeconds > 0) {
    const boundedRetryAfter = Math.min(policy.maxBackoffSeconds, options.retryAfterSeconds);
    const nextRun = new Date(Date.now() + boundedRetryAfter * 1000);
    return {
      shouldRetry: true,
      attemptNumber: attempt,
      maxAttempts,
      nextRunAt: nextRun,
      backoffSeconds: boundedRetryAfter,
      reason: `Honoring provider Retry-After header (${boundedRetryAfter}s).`,
    };
  }

  // 4. Rate-limited failure (HTTP 429) without explicit header
  if (failureReason === 'RATE_LIMITED') {
    const backoff = calculateBackoffWithJitter(attempt, {
      ...policy,
      baseBackoffSeconds: 30, // Higher base backoff for rate limits
    });
    const nextRun = new Date(Date.now() + backoff * 1000);
    return {
      shouldRetry: true,
      attemptNumber: attempt,
      maxAttempts,
      nextRunAt: nextRun,
      backoffSeconds: backoff,
      reason: `Rate limit backoff with jitter applied (${backoff}s).`,
    };
  }

  // 5. Standard transient network / timeout / provider failure
  const backoff = calculateBackoffWithJitter(attempt, policy);
  const nextRun = new Date(Date.now() + backoff * 1000);
  return {
    shouldRetry: true,
    attemptNumber: attempt,
    maxAttempts,
    nextRunAt: nextRun,
    backoffSeconds: backoff,
    reason: `Transient operational failure (${failureReason}). Retry attempt ${attempt}/${maxAttempts} scheduled in ${backoff}s.`,
  };
}
