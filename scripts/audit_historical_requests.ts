/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Historical Request Operational Audit & Remediation Tool (READ-ONLY)
 * 
 * Purpose:
 * Audits all historical QUEUED, FAILED, and PROCESSING verification requests,
 * detecting test artifacts, missing claim records, non-grounded evidence, and
 * classifying requests into an 8-category operational taxonomy.
 * 
 * Safety Guarantee:
 * - Strictly READ-ONLY execution. Zero database writes, updates, deletes, or mutations.
 * - Protects the six excluded PROCESSING requests from Phase 3 Step 3.
 * - Confirms recordsModified is strictly 0.
 */

import dotenv from 'dotenv';
dotenv.config();

import { getServerSupabase } from '../src/server/supabase.js';
import { filterVerifiedEvidence } from '../src/server/services/verdictAnalysis.js';

export type HistoricalAuditCategory =
  | 'COMPLETED_WITH_RESULT'
  | 'ELIGIBLE_FOR_SAFE_REPROCESSING'
  | 'TEST_ARTIFACT'
  | 'MISSING_CLAIM_DATA'
  | 'NO_QUALIFYING_EVIDENCE'
  | 'NON_GROUNDED_EVIDENCE_ONLY'
  | 'TERMINAL_NON_RETRYABLE_FAILURE'
  | 'UNKNOWN_MANUAL_REVIEW';

export interface HistoricalAuditItem {
  requestId: string;
  shortId: string;
  status: string;
  inputType: string;
  claimText: string;
  claimsCount: number;
  totalEvidenceCount: number;
  verifiedEvidenceCount: number;
  hasResult: boolean;
  verdict?: string;
  guestTokenPrefix?: string;
  category: HistoricalAuditCategory;
  categoryLabel: string;
  classificationReason: string;
  safeProposedAction: string;
}

export interface HistoricalAuditSummary {
  totalScanned: number;
  categoryBreakdown: Record<HistoricalAuditCategory, number>;
  recordsModified: 0;
  mode: 'READ_ONLY_AUDIT';
  executedAt: string;
  items: HistoricalAuditItem[];
}

/**
 * Known automated test claims and token fixtures identified in Phase 4 audit.
 */
const KNOWN_TEST_TOKENS = new Set([
  'guest-token-persisted-test',
  'secure-guest-token-abc123xyz789',
  'test-session-guest-token',
  '97f8dcacb599dfc976d47ab37a0792b9eca3c07583028014aaa608fea5c11e2a', // dbf72b4e test workflow
]);

const KNOWN_TEST_UUIDS = new Set([
  'dbf72b4e-3294-4642-84c3-a15ddd61178f', // phase3_step3 Test 2.1
  'd122b2c0-e7f0-4c31-9f75-68c92a953e5e', // phase2.test.ts Test 9
  'd8de54b2-29d9-4fa2-bca4-d62fbc942b1f', // document_extraction test
]);

const KNOWN_EXCLUDED_PROCESSING_UUIDS = new Set([
  // Category 2: Rediscovery needed
  '95ecd135-2aa3-4f93-bc8e-2fbcae49752f',
  '9cf326e4-4d92-4f70-8d5f-9aa57c79e701',
  '09bbf542-a0d7-466f-8700-09dfd70f90fe',
  // Category 3: Inadequate provenance
  '71acb8b9-5eb8-4db8-8316-e41c42f04e13',
  '34845dfa-6f48-4770-ae06-72bcab08e1e7',
  'a9d86901-57d6-4e6f-99f5-19e917d23f7c',
]);

/**
 * Pure evaluation function classifying a single verification request into the 8-category taxonomy.
 * Zero database writes.
 */
export function classifyHistoricalRequest(request: any): HistoricalAuditItem {
  const shortId = request.id ? `${request.id.slice(0, 8)}...` : 'unknown';
  const status = (request.status || 'UNKNOWN').toUpperCase();
  const inputType = request.input_type || 'UNKNOWN';
  const claims = Array.isArray(request.claims) ? request.claims : [];
  const rawEvidence = Array.isArray(request.evidence) ? request.evidence : [];
  const results = Array.isArray(request.verification_results) ? request.verification_results : [];
  const claimText = (request.original_claim || claims[0]?.claim_text || '').trim();
  const guestToken = request.guest_session_token || request.guest_token || '';

  const claimsCount = claims.length;
  const totalEvidenceCount = rawEvidence.length;
  const verifiedEvidence = filterVerifiedEvidence(rawEvidence);
  const verifiedEvidenceCount = verifiedEvidence.length;
  const hasResult = results.length > 0 && results[0] != null;
  const verdict = hasResult ? results[0].verdict : undefined;

  // 1. COMPLETED_WITH_RESULT
  if (status === 'COMPLETED' && hasResult) {
    return {
      requestId: request.id,
      shortId,
      status,
      inputType,
      claimText,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasResult: true,
      verdict,
      category: 'COMPLETED_WITH_RESULT',
      categoryLabel: 'Completed (Result Persisted)',
      classificationReason: `Request is completed with validated persisted verdict "${verdict}". Protected from modification.`,
      safeProposedAction: '[PROTECTED] Keep completed record untouched',
    };
  }

  // 2. TEST_ARTIFACT (Check known tokens, test UUIDs, or headless test claims)
  const isKnownTestToken = KNOWN_TEST_TOKENS.has(guestToken);
  const isKnownTestUuid = KNOWN_TEST_UUIDS.has(request.id);
  const hasTestClaimKeywords =
    claimText.toLowerCase().includes('test claim') ||
    claimText.toLowerCase().includes('test-claim') ||
    guestToken.toLowerCase().includes('test-');

  if (isKnownTestUuid || isKnownTestToken || hasTestClaimKeywords) {
    return {
      requestId: request.id,
      shortId,
      status,
      inputType,
      claimText,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasResult,
      verdict,
      category: 'TEST_ARTIFACT',
      categoryLabel: 'Automated Test Artifact',
      classificationReason: `Originates from automated test suite execution (Token: ${guestToken ? guestToken.slice(0, 10) + '...' : 'none'}).`,
      safeProposedAction: '[SKIP] Exclude from citizen reprocessing; archive or purge in non-prod',
    };
  }

  // 3. MISSING_CLAIM_DATA
  if (!claimText || claimText.length < 5) {
    return {
      requestId: request.id,
      shortId,
      status,
      inputType,
      claimText,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasResult,
      verdict,
      category: 'MISSING_CLAIM_DATA',
      categoryLabel: 'Missing Claim Data',
      classificationReason: 'Claim statement is empty or below minimum character threshold.',
      safeProposedAction: '[SKIP] Cannot verify without substantive citizen statement',
    };
  }

  // 4. NON_GROUNDED_EVIDENCE_ONLY (e.g. Category 3 excluded processing requests)
  if (totalEvidenceCount > 0 && verifiedEvidenceCount === 0) {
    const isExcludedCat3 = KNOWN_EXCLUDED_PROCESSING_UUIDS.has(request.id);
    return {
      requestId: request.id,
      shortId,
      status,
      inputType,
      claimText,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasResult,
      verdict,
      category: 'NON_GROUNDED_EVIDENCE_ONLY',
      categoryLabel: 'Non-Grounded Evidence Only',
      classificationReason: `All ${totalEvidenceCount} evidence citations fail GROUNDED_SEARCH sovereign provenance. ${isExcludedCat3 ? '(Preserved Category 3 request)' : ''}`,
      safeProposedAction: '[SKIP] Cannot synthesize verdict without authentic sovereign sources',
    };
  }

  // 5. NO_QUALIFYING_EVIDENCE (Discovery finished or failed with 0 evidence records)
  if (totalEvidenceCount === 0 && status === 'FAILED') {
    return {
      requestId: request.id,
      shortId,
      status,
      inputType,
      claimText,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasResult,
      verdict,
      category: 'NO_QUALIFYING_EVIDENCE',
      categoryLabel: 'No Qualifying Evidence (Failed)',
      classificationReason: 'Historical terminal failure during discovery with zero evidence records attached.',
      safeProposedAction: '[REVIEW] Eligible for controlled retry only with verified search provider quota',
    };
  }

  // 6. PRESERVED CATEGORY 2 (Excluded PROCESSING requests with 0 evidence)
  if (KNOWN_EXCLUDED_PROCESSING_UUIDS.has(request.id)) {
    return {
      requestId: request.id,
      shortId,
      status,
      inputType,
      claimText,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasResult,
      verdict,
      category: 'UNKNOWN_MANUAL_REVIEW',
      categoryLabel: 'Preserved Processing Request',
      classificationReason: 'Preserved excluded processing request from Phase 3 Step 3.',
      safeProposedAction: '[SKIP] Preserved in PROCESSING status per audit guidelines',
    };
  }

  // 7. ELIGIBLE_FOR_SAFE_REPROCESSING (Legitimate stranded citizen inquiry with valid claim)
  if ((status === 'QUEUED' || status === 'FAILED') && !hasResult && claimText.length >= 10) {
    return {
      requestId: request.id,
      shortId,
      status,
      inputType,
      claimText,
      claimsCount,
      totalEvidenceCount,
      verifiedEvidenceCount,
      hasResult,
      verdict,
      category: 'ELIGIBLE_FOR_SAFE_REPROCESSING',
      categoryLabel: 'Eligible for Reprocessing',
      classificationReason: 'Genuine citizen inquiry with valid claim text, stranded in queue or failed due to historical timeout/rate limit.',
      safeProposedAction: '[ELIGIBLE] Safe for controlled background queue ingestion with rate limit guard',
    };
  }

  // 8. UNKNOWN_MANUAL_REVIEW fallback
  return {
    requestId: request.id,
    shortId,
    status,
    inputType,
    claimText,
    claimsCount,
    totalEvidenceCount,
    verifiedEvidenceCount,
    hasResult,
    verdict,
    category: 'UNKNOWN_MANUAL_REVIEW',
    categoryLabel: 'Manual Review Required',
    classificationReason: `Unclassified operational state: status=${status}, evidence=${totalEvidenceCount}, results=${results.length}.`,
    safeProposedAction: '[MANUAL] Requires operator inspection before any action',
  };
}

export const classifyRequest = classifyHistoricalRequest;

/**
 * Runs the historical request audit against PostgreSQL.
 * GUARANTEE: Strictly executes SELECT queries; ZERO database records modified.
 */
export async function runHistoricalAudit(options?: {
  silent?: boolean;
  statusFilter?: string;
}): Promise<HistoricalAuditSummary> {
  const supabase = getServerSupabase();

  let query = supabase
    .from('verification_requests')
    .select('*, claims(*), evidence(*, sources(*)), verification_results(*)');

  if (options?.statusFilter && options.statusFilter !== 'ALL') {
    query = query.eq('status', options.statusFilter);
  }

  const { data: requests, error } = await query;

  if (error || !requests) {
    throw new Error(`Failed to query verification_requests for audit: ${error?.message}`);
  }

  const categoryBreakdown: Record<HistoricalAuditCategory, number> = {
    COMPLETED_WITH_RESULT: 0,
    ELIGIBLE_FOR_SAFE_REPROCESSING: 0,
    TEST_ARTIFACT: 0,
    MISSING_CLAIM_DATA: 0,
    NO_QUALIFYING_EVIDENCE: 0,
    NON_GROUNDED_EVIDENCE_ONLY: 0,
    TERMINAL_NON_RETRYABLE_FAILURE: 0,
    UNKNOWN_MANUAL_REVIEW: 0,
  };

  const items: HistoricalAuditItem[] = [];

  for (const req of requests) {
    const item = classifyHistoricalRequest(req);
    categoryBreakdown[item.category] = (categoryBreakdown[item.category] || 0) + 1;
    items.push(item);
  }

  const summary: HistoricalAuditSummary = {
    totalScanned: requests.length,
    categoryBreakdown,
    recordsModified: 0, // Strict invariant: 0 writes
    mode: 'READ_ONLY_AUDIT',
    executedAt: new Date().toISOString(),
    items,
  };

  if (!options?.silent) {
    console.log('================================================================');
    console.log('GOVVERIFY AI — HISTORICAL REQUEST OPERATIONAL AUDIT (READ-ONLY)');
    console.log(`Executed At: ${summary.executedAt}`);
    console.log(`Total Requests Scanned: ${summary.totalScanned}`);
    console.log('================================================================\n');

    console.log('--- 8-CATEGORY TAXONOMY BREAKDOWN ---');
    console.log(`• 1. Completed with Result:        ${categoryBreakdown.COMPLETED_WITH_RESULT}`);
    console.log(`• 2. Eligible for Reprocessing:    ${categoryBreakdown.ELIGIBLE_FOR_SAFE_REPROCESSING}`);
    console.log(`• 3. Test Artifacts:               ${categoryBreakdown.TEST_ARTIFACT}`);
    console.log(`• 4. Missing Claim Data:           ${categoryBreakdown.MISSING_CLAIM_DATA}`);
    console.log(`• 5. No Qualifying Evidence:       ${categoryBreakdown.NO_QUALIFYING_EVIDENCE}`);
    console.log(`• 6. Non-Grounded Evidence Only:   ${categoryBreakdown.NON_GROUNDED_EVIDENCE_ONLY}`);
    console.log(`• 7. Terminal Non-Retryable:       ${categoryBreakdown.TERMINAL_NON_RETRYABLE_FAILURE}`);
    console.log(`• 8. Manual Review Required:       ${categoryBreakdown.UNKNOWN_MANUAL_REVIEW}`);
    console.log('----------------------------------------------------------------');
    console.log(`ZERO DATABASE WRITES: Strictly ${summary.recordsModified} records modified.`);
    console.log('================================================================\n');
  }

  return summary;
}

// Standalone execution when called via CLI
if (process.argv[1]?.includes('audit_historical_requests.ts') || process.argv[1]?.includes('audit_historical_requests.js')) {
  runHistoricalAudit({ silent: false })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal audit error:', err);
      process.exit(1);
    });
}
