/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { apiRouter } from '../src/server/routes/api';
import { getServerSupabase, getSupabaseConfigStatus } from '../src/server/supabase';
import {
  decomposeClaimIntoSubclaims,
  filterVerifiedEvidence,
  evaluateEvidenceForSubclaims,
  validateVerdictAnalysis,
  analyzeAndPersistVerdictForRequest,
  StructuredVerdictAnalysis,
} from '../src/server/services/verdictAnalysis';

let passedTests = 0;
let failedTests = 0;
let skippedTests = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    process.stdout.write(`• Testing: ${name}... `);
    await fn();
    console.log(`\x1b[32mPASSED\x1b[0m`);
    passedTests++;
  } catch (err: any) {
    console.log(`\x1b[31mFAILED\x1b[0m`);
    console.error(`  Error: ${err.message}`);
    failedTests++;
  }
}

async function main() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — PHASE 3 STEP 3 AUTOMATED TEST SUITE');
  console.log('End-to-End Verification & Production-Readiness Hardening');
  console.log('================================================================\n');

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const createdRequestIds: string[] = [];

  try {
    // ==========================================================================
    // SECTION 1: OFFLINE UNIT TESTS (INTEGRITY & HARDENING LOGIC)
    // ==========================================================================
    console.log('[SECTION 1] Offline Unit Tests (Evidence Integrity & Guardrails)');

    await runTest('1.1. Outdated sources are flagged with archival disclosure', async () => {
      const claim = 'Historical guidelines for PM-KISAN landholders.';
      const subclaims = [claim];
      const verifiedEvidence = [
        {
          id: 'ev-hist-1',
          source_id: 'src-hist-1',
          extracted_text: 'Guidelines for PM-KISAN implementation as notified in 2021.',
          relationship: 'SUPPORTS',
          sources: {
            id: 'src-hist-1',
            title: 'Archival PM-KISAN Circular 2021',
            url: 'https://pmkisan.gov.in/archive/2021.pdf',
            domain: 'pmkisan.gov.in',
            issuing_authority: 'Ministry of Agriculture',
            publication_date: '2021-04-15',
            source_type: 'GROUNDED_SEARCH',
          },
        },
      ];

      const analysis = evaluateEvidenceForSubclaims(claim, subclaims, verifiedEvidence);
      assert(analysis.citations.length === 1, 'Should produce 1 citation');
      assert(analysis.citations[0].isOutdated === true, 'Citation from 2021 must be flagged as isOutdated');
    });

    await runTest('1.2. Genuine conflict between official notices produces qualified outcome and disclosure', async () => {
      const claim = 'Eligibility requirements for PM-KISAN enrollment.';
      const subclaims = [claim];
      const conflictingEvidence = [
        {
          id: 'ev-conf-1',
          source_id: 'src-conf-1',
          extracted_text: 'Official notice states all rural families are eligible for PM-KISAN benefits.',
          relationship: 'SUPPORTS',
          sources: {
            id: 'src-conf-1',
            title: 'Ministry Notification A',
            url: 'https://agricoop.nic.in/notice-a.pdf',
            domain: 'agricoop.nic.in',
            issuing_authority: 'Department of Agriculture',
            source_type: 'GROUNDED_SEARCH',
          },
        },
        {
          id: 'ev-conf-2',
          source_id: 'src-conf-2',
          extracted_text: 'PIB Clarification: Clarified that institutional landholders and tax-payers are denied PM-KISAN benefits; false claims are fake.',
          relationship: 'REFUTES',
          sources: {
            id: 'src-conf-2',
            title: 'PIB Clarification Press Release',
            url: 'https://pib.gov.in/press-release-b.html',
            domain: 'pib.gov.in',
            issuing_authority: 'Press Information Bureau',
            source_type: 'GROUNDED_SEARCH',
          },
        },
      ];

      const analysis = evaluateEvidenceForSubclaims(claim, subclaims, conflictingEvidence);
      assert(
        analysis.verdict === 'PARTIALLY_SUPPORTED',
        `Expected PARTIALLY_SUPPORTED for genuine conflict, got ${analysis.verdict}`
      );
      assert(
        analysis.subclaims[0].explanation.includes('Genuine Conflict'),
        'Subclaim explanation must disclose Genuine Conflict'
      );
    });

    await runTest('1.3. Missing evidence never produces confident verdict (Confidence = 0%)', async () => {
      const ungroundedClaim = 'Speculative assertion with zero retrieved evidence.';
      const analysis = evaluateEvidenceForSubclaims(ungroundedClaim, [ungroundedClaim], []);
      assert(analysis.verdict === 'INSUFFICIENT_EVIDENCE', 'Must be INSUFFICIENT_EVIDENCE');
      assert(analysis.confidence === 0, `Confidence must be 0 for zero evidence, got ${analysis.confidence}`);
      assert(typeof analysis.limitation === 'string', 'Limitation must be present');
    });

    await runTest('1.4. Validation rejects fabricated citations and phantom IDs', async () => {
      const verifiedEvidence = [{ id: 'real-ev-123' }];
      const badAnalysis: StructuredVerdictAnalysis = {
        verdict: 'SUPPORTED',
        confidence: 90,
        summaryExplanation: 'Valid text',
        subclaims: [],
        citations: [
          {
            id: 'fabricated-ev-id-999',
            sourceId: 'src-999',
            sourceTitle: 'Hallucinated Source',
            sourceUrl: 'https://gov.in',
            officialPublisher: 'Fake',
            relevantExcerpt: 'Fake quote',
            relationship: 'SUPPORTS',
            verdictContribution: 'SUPPORTED',
          },
        ],
        evidenceCount: 1,
        verifiedSourcesCount: 1,
        completedAt: new Date().toISOString(),
      };

      const val = validateVerdictAnalysis(badAnalysis, verifiedEvidence);
      assert(!val.isValid, 'Must reject fabricated citation ID');
      assert(val.error?.includes('Traceability violation') || false, 'Must flag Traceability violation');
    });

    // ==========================================================================
    // SECTION 2: LIVE API & DATABASE INTEGRATION TESTS
    // ==========================================================================
    console.log('\n[SECTION 2] Live API & Database Integration Tests');

    const dbStatus = getSupabaseConfigStatus();
    if (!dbStatus.isConfigured) {
      console.log('• Supabase is unconfigured in this environment. Skipping live DB tests.');
      skippedTests++;
    } else {
      const supabase = getServerSupabase();

      await runTest('2.1. End-to-end citizen workflow: Submit -> Queue -> Verdict -> Retrieve', async () => {
        // Step A: Submit claim as guest via POST /api/v1/verify
        const submitRes = await fetch(`${baseUrl}/api/v1/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim: 'Government of India launches PM-KISAN cash transfers to bank accounts of farmers.',
            inputType: 'CLAIM',
            skipDiscovery: true, // Manual deterministic step
          }),
        });

        assert(submitRes.status === 201, `Submit failed with status ${submitRes.status}`);
        const submitJson = await submitRes.json();
        assert(submitJson.id, 'Must return request ID');
        assert(submitJson.guestToken, 'Must return guestToken');
        assert(submitJson.status === 'QUEUED', `Initial status must be QUEUED, got ${submitJson.status}`);
        createdRequestIds.push(submitJson.id);

        const requestId = submitJson.id;
        const guestToken = submitJson.guestToken;

        // Step B: Attach verified source and evidence to request in DB
        const { data: source } = await supabase
          .from('sources')
          .insert({
            title: 'PM-KISAN Scheme Guidelines',
            url: 'https://pmkisan.gov.in/guidelines-e2e.html',
            domain: 'pmkisan.gov.in',
            issuing_authority: 'Ministry of Agriculture',
            source_type: 'GROUNDED_SEARCH',
          })
          .select()
          .single();

        assert(source, 'Failed to create test source in DB');

        const { data: evidence } = await supabase
          .from('evidence')
          .insert({
            verification_request_id: requestId,
            source_id: source.id,
            extracted_text: 'Under PM-KISAN, cash transfers of ₹6,000 per year are transferred to bank accounts of farmers.',
            relationship: 'SUPPORTS',
          })
          .select()
          .single();

        assert(evidence, 'Failed to create test evidence in DB');

        // Step C: Trigger verdict analysis via POST /api/v1/verify/:id/verdict
        const verdictRes = await fetch(`${baseUrl}/api/v1/verify/${requestId}/verdict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Guest-Token': guestToken,
          },
          body: JSON.stringify({ autoDiscover: false }),
        });

        assert(verdictRes.status === 200, `Verdict call failed with status ${verdictRes.status}`);
        const verdictJson = await verdictRes.json();
        assert(verdictJson.status === 'COMPLETED', `Expected status COMPLETED, got ${verdictJson.status}`);
        assert(verdictJson.verdict === 'SUPPORTED', `Expected SUPPORTED verdict, got ${verdictJson.verdict}`);
        assert(verdictJson.citations.length >= 1, 'Must return citation');
        assert(verdictJson.citations[0].id === evidence.id, 'Citation ID must match persisted evidence ID');

        // Step D: Retrieve result via GET /api/v1/verify/:id
        const getRes = await fetch(`${baseUrl}/api/v1/verify/${requestId}?token=${guestToken}`);
        assert(getRes.status === 200, `GET /api/v1/verify/:id failed with status ${getRes.status}`);
        const getJson = await getRes.json();
        const vResult = Array.isArray(getJson.data?.verification_results)
          ? getJson.data.verification_results[0]
          : getJson.data?.verification_results;

        assert(vResult?.verdict === 'SUPPORTED', `GET returned verdict ${vResult?.verdict}`);
        assert(getJson.data?.status === 'COMPLETED', `Request status must be COMPLETED, got ${getJson.data?.status}`);
      });

      await runTest('2.2. Repeated verdict calls are idempotent and prevent duplicate processing', async () => {
        const guestToken = 'guest-token-idempotency-test';
        // 1. Create a request
        const { data: req } = await supabase
          .from('verification_requests')
          .insert({
            input_type: 'CLAIM',
            original_claim: 'PIB Fact Check directly confirms the notification is official.',
            status: 'QUEUED',
            guest_session_token: guestToken,
          })
          .select()
          .single();

        assert(req, 'Failed to create request');
        createdRequestIds.push(req.id);

        // 2. Insert verified source & evidence
        const { data: src } = await supabase
          .from('sources')
          .insert({
            title: 'PIB Fact Check Direct Confirmation',
            url: 'https://pib.gov.in/confirmed-idempotent.html',
            domain: 'pib.gov.in',
            source_type: 'GROUNDED_SEARCH',
          })
          .select()
          .single();

        await supabase.from('evidence').insert({
          verification_request_id: req.id,
          source_id: src.id,
          extracted_text: 'PIB Fact Check directly confirms the notification is official.',
          relationship: 'SUPPORTS',
        });

        // 3. First call: Generates and persists verdict
        const firstCall = await fetch(`${baseUrl}/api/v1/verify/${req.id}/verdict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Guest-Token': guestToken },
          body: JSON.stringify({ autoDiscover: false }),
        });
        const firstJson = await firstCall.json();
        assert(firstJson.status === 'COMPLETED', 'First call should complete');
        assert(firstJson.verdict === 'SUPPORTED', 'First call verdict should be SUPPORTED');

        // 4. Second call: Must return existing completed result idempotently
        const secondCall = await fetch(`${baseUrl}/api/v1/verify/${req.id}/verdict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Guest-Token': guestToken },
        });
        const secondJson = await secondCall.json();
        assert(secondJson.status === 'COMPLETED', 'Second call must return COMPLETED');
        assert(
          new Date(secondJson.completedAt).getTime() === new Date(firstJson.completedAt).getTime(),
          'Must preserve original completedAt timestamp'
        );
      });

      await runTest('2.3. Overwrite protection: Transient empty evidence cannot overwrite a valid verdict', async () => {
        const guestToken = 'guest-token-overwrite-protection';
        // 1. Create a completed request with valid verdict in DB
        const { data: req } = await supabase
          .from('verification_requests')
          .insert({
            input_type: 'CLAIM',
            original_claim: 'Claim with existing verified outcome',
            status: 'COMPLETED',
            guest_session_token: guestToken,
          })
          .select()
          .single();

        assert(req, 'Failed to create request');
        createdRequestIds.push(req.id);

        await supabase.from('verification_results').insert({
          verification_request_id: req.id,
          verdict: 'SUPPORTED',
          confidence: 90,
          explanation: 'Original verified evidence confirmed this claim.',
          completed_at: new Date().toISOString(),
        });

        // 2. Call analyzeAndPersistVerdictForRequest with forceReanalyze and empty evidence
        const protectedResult = await analyzeAndPersistVerdictForRequest(req.id, {
          forceReanalyze: true,
          forceModelFailure: true,
        });

        // Must preserve the valid SUPPORTED verdict instead of overwriting with INSUFFICIENT_EVIDENCE
        assert(
          protectedResult.analysis.verdict === 'SUPPORTED',
          `Verdict should be protected as SUPPORTED, got ${protectedResult.analysis.verdict}`
        );

        // Verify DB record was not corrupted
        const { data: dbResult } = await supabase
          .from('verification_results')
          .select('verdict')
          .eq('verification_request_id', req.id)
          .single();

        assert(dbResult?.verdict === 'SUPPORTED', `DB verdict must remain SUPPORTED, got ${dbResult?.verdict}`);
      });

      await runTest('2.4. Cross-user isolation and authorization checks', async () => {
        // Create an authenticated request owned by a mock user UUID
        const ownerUserId = '11111111-2222-3333-4444-555555555555';
        const { data: authReq } = await supabase
          .from('verification_requests')
          .insert({
            input_type: 'CLAIM',
            original_claim: 'Authenticated user private request',
            status: 'QUEUED',
            user_id: ownerUserId,
          })
          .select()
          .single();

        if (authReq) {
          createdRequestIds.push(authReq.id);

          // An unauthenticated request attempting to access it must receive 403 Forbidden
          const unauthRes = await fetch(`${baseUrl}/api/v1/verify/${authReq.id}`);
          assert(unauthRes.status === 403, `Expected 403 Forbidden for cross-user access, got ${unauthRes.status}`);

          // An unauthenticated request attempting to trigger verdict must receive 403 Forbidden
          const unauthVerdictRes = await fetch(`${baseUrl}/api/v1/verify/${authReq.id}/verdict`, {
            method: 'POST',
          });
          assert(
            unauthVerdictRes.status === 403,
            `Expected 403 Forbidden for unauthorized verdict trigger, got ${unauthVerdictRes.status}`
          );
        }
      });
    }

    // ==========================================================================
    // CLEANUP
    // ==========================================================================
    if (dbStatus.isConfigured && createdRequestIds.length > 0) {
      const supabase = getServerSupabase();
      for (const reqId of createdRequestIds) {
        try {
          await supabase.from('verification_requests').delete().eq('id', reqId);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`PHASE 3 STEP 3 TEST SUMMARY:`);
  console.log(`Passed:  \x1b[32m${passedTests}\x1b[0m`);
  console.log(`Failed:  \x1b[31m${failedTests}\x1b[0m`);
  console.log(`Skipped: \x1b[33m${skippedTests}\x1b[0m`);
  console.log('================================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal test execution error:', e);
  process.exit(1);
});
