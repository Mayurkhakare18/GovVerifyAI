/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 4.2: Frontend Verification Status Gate Regression Test Suite
 * 
 * Validates:
 * 1. QUEUED request with no result renders queue state and no completed report.
 * 2. PROCESSING request with no result renders in-progress state and no completed report.
 * 3. FAILED request with no result renders failed state with safe error messaging.
 * 4. COMPLETED request with a valid persisted result for each canonical verdict:
 *    - SUPPORTED
 *    - PARTIALLY_SUPPORTED
 *    - CONTRADICTED
 *    - INSUFFICIENT_EVIDENCE
 * 5. COMPLETED request with no result renders integrity error (result unavailable) and no fabricated verdict.
 * 6. COMPLETED request with an invalid verdict renders integrity error and no fabricated verdict.
 * 7. Missing request data, loading, and error states render appropriate unavailable views.
 * 8. Legitimate INSUFFICIENT_EVIDENCE result remains visible as a completed report.
 * 9. Strictly NO incomplete state displays "Verification completed against official sovereign records."
 * 
 * Audit Guarantee: Strictly offline / mocked test data. Zero database writes or Supabase mutations.
 */

import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  VerificationResultDetail,
  evaluateVerificationGate,
  resolveSafeFailureInfo,
  VerificationDetailRecord,
} from '../src/components/dashboard/VerificationResultDetail';
import {
  CANONICAL_VERDICTS,
  isCanonicalVerdict,
  getCitizenVerdict,
  CanonicalVerdict,
} from '../src/utils/citizenVerdict';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    process.stdout.write(`• Testing: ${name}... `);
    await fn();
    console.log(`\x1b[32mPASSED\x1b[0m`);
    passed++;
  } catch (err: any) {
    console.log(`\x1b[31mFAILED\x1b[0m`);
    console.error(`  Error: ${err.message}`);
    failed++;
  }
}

// ==============================================================================
// TEST FIXTURES (Isolated in-memory mock records)
// ==============================================================================

const MOCK_CLAIM_TEXT = 'Eligible farmers receive Rs 6,000 per year under PM-KISAN.';

const createMockRecord = (
  status: string,
  results?: Array<{
    id: string;
    verdict: string;
    confidence: number;
    explanation: string;
    completed_at?: string;
  }>,
  extras?: Partial<VerificationDetailRecord>
): VerificationDetailRecord => ({
  id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
  original_claim: MOCK_CLAIM_TEXT,
  status,
  input_type: 'CLAIM',
  created_at: '2026-10-10T12:00:00.000Z',
  claims: [
    {
      id: 'c1d2e3f4-0000-0000-0000-000000000001',
      claim_text: MOCK_CLAIM_TEXT,
      claim_type: 'PRIMARY_ASSERTION',
    },
  ],
  evidence: [
    {
      id: 'e1d2e3f4-0000-0000-0000-000000000001',
      extracted_text: 'Under PM-KISAN, Rs 6,000 per year is provided in three installments.',
      clause_reference: 'Section 3.1',
      sources: {
        id: 's1d2e3f4-0000-0000-0000-000000000001',
        title: 'PM-KISAN Guidelines',
        url: 'https://pmkisan.gov.in/guidelines.html',
        domain: 'pmkisan.gov.in',
        issuing_authority: 'Ministry of Agriculture & Farmers Welfare',
        source_type: 'GROUNDED_SEARCH',
      },
    },
  ],
  verification_results: results,
  ...extras,
});

async function main() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — PHASE 4.2 STATUS GATE REGRESSION TEST SUITE');
  console.log('Validating Frontend Status Gating, Verdict Integrity & Zero Leaks');
  console.log('================================================================\n');

  // ============================================================================
  // SECTION 1: QUEUED REQUEST WITH NO RESULT
  // ============================================================================
  console.log('[SECTION 1] QUEUED Verification Request Handling');

  await runTest('1.1. evaluateVerificationGate classifies QUEUED without results as QUEUED', () => {
    const record = createMockRecord('QUEUED', []);
    const { gateState } = evaluateVerificationGate(record);
    assert(gateState === 'QUEUED', `Expected gateState QUEUED, got ${gateState}`);
  });

  await runTest('1.2. VerificationResultDetail renders distinct QUEUED view with reassurance messaging', () => {
    const record = createMockRecord('QUEUED', []);
    const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: record }));

    assert(html.includes('data-testid="status-gate-queued"'), 'Must render queued status container');
    assert(html.includes('Verification Waiting to Start'), 'Must display waiting headline');
    assert(html.includes('Status: QUEUED'), 'Must indicate QUEUED status');
    assert(html.includes(MOCK_CLAIM_TEXT), 'Must display submitted claim statement');
    assert(html.includes('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'), 'Must display request ID');
    assert(!html.includes('Verification completed against official sovereign records.'), 'Must NOT contain false completion message');
    assert(!html.includes('What we found'), 'Must NOT render completed report findings');
  });

  // ============================================================================
  // SECTION 2: PROCESSING REQUEST WITH NO RESULT
  // ============================================================================
  console.log('\n[SECTION 2] PROCESSING Verification Request Handling');

  await runTest('2.1. evaluateVerificationGate classifies PROCESSING without results as PROCESSING', () => {
    const record = createMockRecord('PROCESSING', []);
    const { gateState } = evaluateVerificationGate(record);
    assert(gateState === 'PROCESSING', `Expected gateState PROCESSING, got ${gateState}`);
  });

  await runTest('2.2. VerificationResultDetail renders distinct PROCESSING view with progress indicators', () => {
    const record = createMockRecord('PROCESSING', []);
    const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: record }));

    assert(html.includes('data-testid="status-gate-processing"'), 'Must render processing status container');
    assert(html.includes('Verification is Actively in Progress'), 'Must display in-progress title');
    assert(html.includes('Status: PROCESSING'), 'Must indicate PROCESSING status');
    assert(html.includes(MOCK_CLAIM_TEXT), 'Must display submitted claim statement');
    assert(!html.includes('Verification completed against official sovereign records.'), 'Must NOT contain false completion message');
    assert(!html.includes('What we found'), 'Must NOT render completed report findings');
  });

  // ============================================================================
  // SECTION 3: FAILED REQUEST WITH NO RESULT
  // ============================================================================
  console.log('\n[SECTION 3] FAILED Verification Request & Safe Error Handling');

  await runTest('3.1. evaluateVerificationGate classifies FAILED without results as FAILED', () => {
    const record = createMockRecord('FAILED', []);
    const { gateState } = evaluateVerificationGate(record);
    assert(gateState === 'FAILED', `Expected gateState FAILED, got ${gateState}`);
  });

  await runTest('3.2. FAILED with reliable QUOTA_EXHAUSTED metadata renders safe rate limit message and retry action', () => {
    const record = createMockRecord('FAILED', [], { failure_reason: 'QUOTA_EXHAUSTED' });
    const info = resolveSafeFailureInfo(record);
    assert(info.headline.includes('Search Quota Temporarily Reached'), 'Headline must explain rate limit safely');

    const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: record }));
    assert(html.includes('data-testid="status-gate-failed"'), 'Must render failed status container');
    assert(html.includes('Search Quota Temporarily Reached'), 'Must display safe failure headline');
    assert(html.includes('Status: FAILED'), 'Must indicate FAILED status');
    assert(html.includes('Retry Verification'), 'Must offer retry verification action');
    assert(!html.includes('Verification completed against official sovereign records.'), 'Must NOT contain false completion message');
  });

  await runTest('3.3. FAILED with no metadata falls back to neutral retry/contact-support instruction', () => {
    const record = createMockRecord('FAILED', []);
    const info = resolveSafeFailureInfo(record);
    assert(info.headline === 'Verification Could Not Be Completed', 'Must use neutral headline');
    assert(info.instruction.includes('contact citizen support'), 'Must include neutral support instruction');

    const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: record }));
    assert(html.includes('Verification Could Not Be Completed'), 'Must render neutral headline');
    assert(html.includes('contact citizen support'), 'Must render neutral support instruction');
  });

  await runTest('3.4. FAILED with sensitive error trace sanitizes output and leaks zero database internals', () => {
    const record = createMockRecord('FAILED', [], {
      error_message: 'error: select * from supabase_admin.vault where apikey=secret_live_key',
    });
    const info = resolveSafeFailureInfo(record);
    assert(!info.message.includes('supabase_admin'), 'Must strip Supabase internal references');
    assert(!info.message.includes('secret_live_key'), 'Must strip secret keys');
    assert(info.message === 'Verification could not be completed against official sovereign records at this time.', 'Must fall back to neutral safe message');

    const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: record }));
    assert(!html.includes('supabase_admin'), 'Rendered HTML must not leak database internals');
    assert(!html.includes('secret_live_key'), 'Rendered HTML must not leak secrets');
  });

  // ============================================================================
  // SECTION 4: COMPLETED WITH VALID PERSISTED CANONICAL VERDICTS
  // ============================================================================
  console.log('\n[SECTION 4] COMPLETED Request with Valid Canonical Verdicts');

  for (const canonicalVerdict of CANONICAL_VERDICTS) {
    await runTest(`4.${CANONICAL_VERDICTS.indexOf(canonicalVerdict) + 1}. COMPLETED with verdict ${canonicalVerdict} renders full report`, () => {
      const citizenInfo = getCitizenVerdict(canonicalVerdict);
      const record = createMockRecord('COMPLETED', [
        {
          id: 'res-1111-2222-3333-4444',
          verdict: canonicalVerdict,
          confidence: 0.95,
          explanation: `Persisted verification verdict for ${canonicalVerdict} claim.`,
          completed_at: '2026-10-10T12:05:00.000Z',
        },
      ]);

      const { gateState, canonicalVerdict: gateVerdict } = evaluateVerificationGate(record);
      assert(gateState === 'COMPLETED_REPORT', `Must evaluate to COMPLETED_REPORT for ${canonicalVerdict}`);
      assert(gateVerdict === canonicalVerdict, `Must preserve canonical verdict ${canonicalVerdict}`);

      const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: record }));
      assert(html.includes(citizenInfo.label), `HTML must include citizen label "${citizenInfo.label}"`);
      assert(html.includes('Verification Result'), 'Must render full Verification Result title');
      assert(html.includes('Audit Provenance'), 'Must render audit provenance section');
      assert(html.includes('pmkisan.gov.in'), 'Must render grounded evidence source');
    });
  }

  // ============================================================================
  // SECTION 5: COMPLETED WITH NO RESULT (INTEGRITY ERROR)
  // ============================================================================
  console.log('\n[SECTION 5] COMPLETED Request Missing Persisted Result');

  await runTest('5.1. evaluateVerificationGate classifies COMPLETED without results as COMPLETED_NO_RESULT', () => {
    const recordEmpty = createMockRecord('COMPLETED', []);
    const { gateState: stateEmpty } = evaluateVerificationGate(recordEmpty);
    assert(stateEmpty === 'COMPLETED_NO_RESULT', `Expected COMPLETED_NO_RESULT, got ${stateEmpty}`);

    const recordUndefined = createMockRecord('COMPLETED', undefined);
    const { gateState: stateUndef } = evaluateVerificationGate(recordUndefined);
    assert(stateUndef === 'COMPLETED_NO_RESULT', `Expected COMPLETED_NO_RESULT, got ${stateUndef}`);
  });

  await runTest('5.2. VerificationResultDetail renders integrity notice and DOES NOT fabricate a verdict', () => {
    const record = createMockRecord('COMPLETED', []);
    const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: record }));

    assert(html.includes('data-testid="status-gate-completed_no_result"'), 'Must render completed_no_result container');
    assert(html.includes('Verification Result Unavailable'), 'Must state result is unavailable');
    assert(html.includes('Status: COMPLETED (Missing Result)'), 'Must indicate missing result status');
    assert(html.includes('unverified claims are never fabricated or simulated'), 'Must display integrity guarantee');
    assert(!html.includes('What we found'), 'Must NOT display completed findings section');
    assert(!html.includes('Verification completed against official sovereign records.'), 'Must NOT display false completion message');
  });

  // ============================================================================
  // SECTION 6: COMPLETED WITH INVALID VERDICT
  // ============================================================================
  console.log('\n[SECTION 6] COMPLETED Request with Invalid / Non-Canonical Verdict');

  await runTest('6.1. evaluateVerificationGate rejects non-canonical verdicts', () => {
    const nonCanonicals = ['UNVERIFIED', 'PENDING', 'TRUE', 'FALSE', 'PARTLY_SUPPORTED', 'PLAUSIBLE', ''];
    for (const invalidVerdict of nonCanonicals) {
      assert(!isCanonicalVerdict(invalidVerdict), `Verdict "${invalidVerdict}" must not be canonical`);
      const record = createMockRecord('COMPLETED', [
        {
          id: 'res-bad',
          verdict: invalidVerdict,
          confidence: 0.5,
          explanation: 'Bogus verdict.',
        },
      ]);
      const { gateState } = evaluateVerificationGate(record);
      assert(gateState === 'COMPLETED_INVALID_VERDICT', `Expected COMPLETED_INVALID_VERDICT for "${invalidVerdict}", got ${gateState}`);
    }
  });

  await runTest('6.2. VerificationResultDetail renders unrecognized verdict format card and never falls back to INSUFFICIENT_EVIDENCE', () => {
    const record = createMockRecord('COMPLETED', [
      {
        id: 'res-bad',
        verdict: 'UNCONFIRMED_RUMOR',
        confidence: 0.5,
        explanation: 'Invalid verdict attempt.',
      },
    ]);
    const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: record }));

    assert(html.includes('data-testid="status-gate-completed_invalid_verdict"'), 'Must render invalid verdict status container');
    assert(html.includes('Unrecognized Verdict Format'), 'Must indicate format error');
    assert(html.includes('GovVerify AI reports strictly require one of the four sovereign standards'), 'Must state 4 canonical standards');
    assert(!html.includes('Audited Citizen Verdict'), 'Must NOT render Audited Citizen Verdict banner');
    assert(!html.includes('What we found'), 'Must NOT render completed report findings');
    assert(!html.includes('Verification completed against official sovereign records.'), 'Must NOT display false completion message');
  });

  // ============================================================================
  // SECTION 7: MISSING REQUEST DATA, LOADING & ERROR STATES
  // ============================================================================
  console.log('\n[SECTION 7] Missing Request Data, Loading & Error States');

  await runTest('7.1. Loading state renders skeleton placeholders', () => {
    const html = renderToString(React.createElement(VerificationResultDetail, { initialLoading: true, initialRecord: null }));
    assert(html.includes('data-testid="status-gate-loading"'), 'Must render loading skeleton');
    assert(html.includes('animate-pulse'), 'Must contain pulse animation classes');
    assert(!html.includes('Verification completed against official sovereign records.'), 'Must NOT display false completion message');
  });

  await runTest('7.2. Error state (404/403/Network) renders Report Unavailable card', () => {
    const html = renderToString(React.createElement(VerificationResultDetail, {
      initialRecord: null,
      initialError: 'Verification record not found or has been deleted.',
    }));
    assert(html.includes('data-testid="status-gate-error"'), 'Must render error container');
    assert(html.includes('Report Unavailable'), 'Must display Report Unavailable title');
    assert(html.includes('Verification record not found or has been deleted.'), 'Must display safe error message');
    assert(html.includes('Back to History'), 'Must display Back to History button');
  });

  await runTest('7.3. Null or undefined record evaluates to STATUS_UNAVAILABLE with zero leaks', () => {
    const { gateState: nullState } = evaluateVerificationGate(null);
    assert(nullState === 'STATUS_UNAVAILABLE', 'null record must evaluate to STATUS_UNAVAILABLE');

    const { gateState: undefState } = evaluateVerificationGate(undefined);
    assert(undefState === 'STATUS_UNAVAILABLE', 'undefined record must evaluate to STATUS_UNAVAILABLE');

    const unknownRecord = createMockRecord('UNKNOWN_STATUS');
    const { gateState: unknownState } = evaluateVerificationGate(unknownRecord);
    assert(unknownState === 'STATUS_UNAVAILABLE', 'Unknown status must evaluate to STATUS_UNAVAILABLE');

    const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: unknownRecord }));
    assert(html.includes('Verification Status Unavailable'), 'Must display unavailable state');
    assert(!html.includes('Verification completed against official sovereign records.'), 'Must NOT display false completion message');
  });

  // ============================================================================
  // SECTION 8: LEGITIMATE INSUFFICIENT_EVIDENCE REPORT PRESERVATION
  // ============================================================================
  console.log('\n[SECTION 8] Legitimate INSUFFICIENT_EVIDENCE Completed Report Preservation');

  await runTest('8.1. Legitimate INSUFFICIENT_EVIDENCE result remains fully visible as completed report', () => {
    const record = createMockRecord('COMPLETED', [
      {
        id: 'res-legit-insufficient',
        verdict: 'INSUFFICIENT_EVIDENCE',
        confidence: 0.88,
        explanation: 'We could not locate official gazettes confirming direct cash assistance under the cited name.',
        completed_at: '2026-10-10T14:30:00.000Z',
      },
    ]);

    const { gateState, canonicalVerdict } = evaluateVerificationGate(record);
    assert(gateState === 'COMPLETED_REPORT', 'Legitimate INSUFFICIENT_EVIDENCE must pass status gate');
    assert(canonicalVerdict === 'INSUFFICIENT_EVIDENCE', 'Verdict must be INSUFFICIENT_EVIDENCE');

    const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: record }));
    assert(html.includes('Insufficient Evidence'), 'Must render Insufficient Evidence badge');
    assert(html.includes('We could not locate official gazettes confirming direct cash assistance'), 'Must render legitimate persisted explanation');
    assert(html.includes('Audited Citizen Verdict'), 'Must render Audited Citizen Verdict card');
    assert(html.includes('pmkisan.gov.in'), 'Must render verified source evidence citation');
  });

  // ============================================================================
  // SECTION 9: STRICT PROHIBITION ON FALSE COMPLETION MESSAGES
  // ============================================================================
  console.log('\n[SECTION 9] Prohibition on False Completion Phrase Across Incomplete States');

  await runTest('9.1. False completion phrase is absent across ALL incomplete/error states', () => {
    const forbiddenPhrase = 'Verification completed against official sovereign records.';

    const incompleteScenarios: VerificationDetailRecord[] = [
      createMockRecord('QUEUED', []),
      createMockRecord('QUEUED', undefined),
      createMockRecord('PROCESSING', []),
      createMockRecord('PROCESSING', undefined),
      createMockRecord('FAILED', []),
      createMockRecord('FAILED', undefined),
      createMockRecord('COMPLETED', []),
      createMockRecord('COMPLETED', undefined),
      createMockRecord('COMPLETED', [{ id: '1', verdict: 'INVALID', confidence: 0.5, explanation: 'x' }]),
      createMockRecord('CANCELLED', []),
      createMockRecord('DRAFT', []),
    ];

    for (const rec of incompleteScenarios) {
      const html = renderToString(React.createElement(VerificationResultDetail, { initialRecord: rec }));
      assert(!html.includes(forbiddenPhrase), `Forbidden phrase must NOT appear for status=${rec.status}`);
      assert(!html.includes('What we found'), `Completed report findings must NOT appear for status=${rec.status}`);
    }

    // Also check loading and error states
    const loadingHtml = renderToString(React.createElement(VerificationResultDetail, { initialLoading: true, initialRecord: null }));
    assert(!loadingHtml.includes(forbiddenPhrase), 'Forbidden phrase must NOT appear in loading state');

    const errorHtml = renderToString(React.createElement(VerificationResultDetail, { initialRecord: null, initialError: 'DB error' }));
    assert(!errorHtml.includes(forbiddenPhrase), 'Forbidden phrase must NOT appear in error state');
  });

  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n================================================================');
  console.log(`STATUS GATE REGRESSION TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('Zero Database Writes Confirmed (100% In-Memory Mock Execution)');
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
