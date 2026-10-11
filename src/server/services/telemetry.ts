/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Operational Telemetry Persistence Service
 * Safe persistence of failure metadata, grounding states, and retry tracking
 * with non-fatal degradation for unmigrated database instances.
 */

import { getServerSupabase } from '../supabase.js';
import { ClassifiedError, FailureReason } from './errorClassification.js';

export interface RequestTelemetryPayload {
  status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  failureReason?: FailureReason | null;
  failureDetails?: Record<string, any> | null;
  groundingStatus?: string | null;
  retryCount?: number;
  nextRetryAt?: string | null;
  lastAttemptAt?: string | null;
}

// Global cached flag so we do not repeatedly retry failed column updates if unmigrated
let telemetryColumnsSupported: boolean | null = null;

/**
 * Persists operational telemetry to public.verification_requests.
 * Automatically falls back to standard status update if schema columns are not yet migrated.
 */
export async function persistRequestTelemetry(
  requestId: string,
  payload: RequestTelemetryPayload
): Promise<boolean> {
  const supabase = getServerSupabase();
  const now = new Date().toISOString();

  // If telemetry columns are known to not exist yet, update only basic fields
  if (telemetryColumnsSupported === false) {
    if (payload.status) {
      await supabase
        .from('verification_requests')
        .update({ status: payload.status, updated_at: now })
        .eq('id', requestId);
    }
    return false;
  }

  const updateBody: Record<string, any> = {
    updated_at: now,
  };

  if (payload.status !== undefined) {
    updateBody.status = payload.status;
  }
  if (payload.failureReason !== undefined) {
    updateBody.failure_reason = payload.failureReason;
  }
  if (payload.failureDetails !== undefined) {
    updateBody.failure_details = payload.failureDetails;
  }
  if (payload.groundingStatus !== undefined) {
    updateBody.grounding_status = payload.groundingStatus;
  }
  if (payload.retryCount !== undefined) {
    updateBody.retry_count = payload.retryCount;
  }
  if (payload.nextRetryAt !== undefined) {
    updateBody.next_retry_at = payload.nextRetryAt;
  }
  if (payload.lastAttemptAt !== undefined) {
    updateBody.last_attempt_at = payload.lastAttemptAt;
  }

  const { error } = await supabase
    .from('verification_requests')
    .update(updateBody)
    .eq('id', requestId);

  if (error) {
    // If column missing error, degrade gracefully
    if (
      error.message?.includes('failure_reason') ||
      error.message?.includes('grounding_status') ||
      error.message?.includes('column')
    ) {
      telemetryColumnsSupported = false;
      if (payload.status) {
        await supabase
          .from('verification_requests')
          .update({ status: payload.status, updated_at: now })
          .eq('id', requestId);
      }
      return false;
    }
    console.error(`[GovVerify AI] Error updating request telemetry for ${requestId}:`, error.message);
    return false;
  }

  telemetryColumnsSupported = true;
  return true;
}

/**
 * Resets telemetry cache for testing or post-migration reload.
 */
export function resetTelemetrySchemaCache(): void {
  telemetryColumnsSupported = null;
}
