/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { apiRouter } from '../src/server/routes/api';
import { getGeminiConfigStatus, getGeminiClient } from '../src/server/services/gemini';
import {
  classifyIndianAuthorityDomain,
  discoverAuthoritativeSources,
  discoverAndPersistSourcesForRequest,
} from '../src/server/services/sourceDiscovery';
import { getServerSupabase, getSupabaseConfigStatus } from '../src/server/supabase';

let passedTests = 0;
let failedTests = 0;
let blockedLiveTests = 0;

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

function runBlockedTest(name: string, reason: string) {
  console.log(`• Testing: ${name}... \x1b[33mBLOCKED\x1b[0m (${reason})`);
  blockedLiveTests++;
}

async function main() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — PHASE 3 STEP 1.5 AUTOMATED TEST SUITE');
  console.log('Evidence Provenance & Quota-Fallback Hardening Validation');
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
    // GROUP 1: OFFLINE UNIT TESTS (Pure Logic & Heuristics)
    // ==========================================================================
    console.log('[SECTION 1] Offline Unit Tests (Pure Logic & Domain Tiering)');

    await runTest('1.1. Sovereign Indian authority domain classifier & tiering heuristics', async () => {
      // Tier 1: Sovereign portals (.gov.in, .nic.in, PIB, eGazette)
      const pib = classifyIndianAuthorityDomain('https://pib.gov.in/PressReleasePage.aspx?PRID=1999999');
      assert(pib.tier === 1, 'PIB must be Tier 1 sovereign domain');
      assert(pib.domain === 'pib.gov.in', 'Domain should match pib.gov.in');
      assert(pib.suggestedAuthority?.includes('Press Information Bureau') || false, 'Should detect PIB authority');

      const mnre = classifyIndianAuthorityDomain('https://pmkusum.mnre.gov.in/guidelines');
      assert(mnre.tier === 1, 'pmkusum.mnre.gov.in must be Tier 1 sovereign domain');

      const egazette = classifyIndianAuthorityDomain('https://egazette.gov.in/WriteReadData/2026/245678.pdf');
      assert(egazette.tier === 1, 'eGazette must be Tier 1 sovereign domain');

      // Tier 2: Statutory and regulatory institutions
      const rbi = classifyIndianAuthorityDomain('https://rbi.org.in/scripts/BS_PressReleaseDisplay.aspx');
      assert(rbi.tier === 2, 'RBI must be Tier 2 statutory authority');

      const sebi = classifyIndianAuthorityDomain('https://sebi.gov.in/legal/circulars/mar-2026.html');
      assert(sebi.tier === 2, 'SEBI must be Tier 2 statutory authority');

      // Tier 3: National Public Broadcasters
      const dd = classifyIndianAuthorityDomain('https://ddnews.gov.in/national/story');
      assert(dd.tier === 3, 'DD News must be Tier 3');

      // Tier 4: Generic web references
      const generic = classifyIndianAuthorityDomain('https://example-blog.com/news');
      assert(generic.tier === 4, 'Generic blog must be Tier 4');
    });

    await runTest('1.2. Gemini API configuration status reporter contract', async () => {
      const config = getGeminiConfigStatus();
      assert(typeof config.isConfigured === 'boolean', 'isConfigured must be boolean');
      assert(typeof config.message === 'string', 'message must be descriptive string');
      if (!config.isConfigured) {
        assert(config.message.includes('GEMINI_NOT_CONFIGURED'), 'Must report GEMINI_NOT_CONFIGURED clearly');
      }
    });

    // ==========================================================================
    // GROUP 2: OFFLINE PROVENANCE & ANTI-HALLUCINATION GUARDRAIL TESTS
    // ==========================================================================
    console.log('\n[SECTION 2] Offline Provenance Guardrails & Quota Classification');

    await runTest('2.1. Domain tiering heuristic boundary verification', async () => {
      const t1 = classifyIndianAuthorityDomain('https://pmkisan.gov.in');
      assert(t1.tier === 1, 'pmkisan.gov.in is Tier 1');
      const t1Sub = classifyIndianAuthorityDomain('https://sub.portal.mygov.in/path');
      assert(t1Sub.tier === 1, 'sub.portal.mygov.in is Tier 1');
    });

    // 2.2. Duplicate source handling & ID reuse in public.sources
    await runTest('2.2. Duplicate source handling & ID reuse in public.sources', async () => {
      const supabase = getServerSupabase();
      const testUrl = `https://pib.gov.in/test-dedup-${Date.now()}`;

      const { data: s1 } = await supabase
        .from('sources')
        .insert({
          title: 'Duplicate Test Authority 1',
          url: testUrl,
          domain: 'pib.gov.in',
          source_type: 'GROUNDED_SEARCH',
        })
        .select()
        .single();
      assert(Boolean(s1), 'Must insert first source');

      const { data: existing } = await supabase
        .from('sources')
        .select('id')
        .eq('url', testUrl)
        .maybeSingle();
      assert(existing?.id === s1?.id, 'Duplicate check must match existing ID');

      await supabase.from('sources').delete().eq('id', s1.id);
    });

    // 2.3. Request Ownership & Guest Token Authorization
    await runTest('2.3. Authorization & request ownership protection on source discovery endpoints', async () => {
      const supabase = getServerSupabase();

      const { data: guestReq } = await supabase
        .from('verification_requests')
        .insert({
          input_type: 'CLAIM',
          original_claim: 'Test assertion for ownership check',
          guest_session_token: 'valid-secret-guest-token-12345',
          status: 'QUEUED',
        })
        .select()
        .single();
      assert(Boolean(guestReq), 'Guest request must be created');
      createdRequestIds.push(guestReq.id);

      // Invalid guest token -> 403 Forbidden
      const resBadToken = await fetch(`${baseUrl}/api/v1/sources/discover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Token': 'wrong-unauthorized-token',
        },
        body: JSON.stringify({
          verificationRequestId: guestReq.id,
          claim: 'Test assertion for ownership check',
        }),
      });
      assert(
        resBadToken.status === 403 || resBadToken.status === 503,
        `Expected 403 Forbidden (or 503 if Gemini unconfigured), got ${resBadToken.status}`
      );

      // Invalid UUID -> 400 Bad Request
      const resBadId = await fetch(`${baseUrl}/api/v1/sources/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationRequestId: 'not-a-uuid',
          claim: 'Test assertion',
        }),
      });
      assert(
        resBadId.status === 400 || resBadId.status === 503,
        `Expected 400 Bad Request (or 503 if Gemini unconfigured), got ${resBadId.status}`
      );

      // Non-existent UUID -> 404 Not Found
      const resNotFound = await fetch(`${baseUrl}/api/v1/sources/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          verificationRequestId: 'a0000000-0000-4000-a000-000000000000',
          claim: 'Test assertion',
        }),
      });
      assert(
        resNotFound.status === 404 || resNotFound.status === 503,
        `Expected 404 Not Found (or 503 if Gemini unconfigured), got ${resNotFound.status}`
      );
    });

    // 2.4. Failure recovery: request status rollback on discovery error
    await runTest('2.4. Failure recovery: request status rollback to QUEUED on operational error', async () => {
      const supabase = getServerSupabase();

      const { data: failReq } = await supabase
        .from('verification_requests')
        .insert({
          input_type: 'CLAIM',
          original_claim: 'Temporary assertion for failure recovery test',
          status: 'QUEUED',
        })
        .select()
        .single();
      assert(Boolean(failReq), 'Request must be created');
      createdRequestIds.push(failReq.id);

      await supabase
        .from('verification_requests')
        .update({ original_claim: '' })
        .eq('id', failReq.id);

      let caught = false;
      try {
        await discoverAndPersistSourcesForRequest(failReq.id);
      } catch {
        caught = true;
      }
      assert(caught, 'Must throw error on empty claim text');

      const { data: verifiedReq } = await supabase
        .from('verification_requests')
        .select('status')
        .eq('id', failReq.id)
        .single();
      assert(verifiedReq?.status === 'QUEUED', `Status must be rolled back to QUEUED, got ${verifiedReq?.status}`);
    });

    // 2.5. Provenance Guardrail: Quota error simulation enforces UNVERIFIED_CANDIDATE with NO fake excerpts
    await runTest('2.5. Provenance Guardrail: Quota error enforces UNVERIFIED_CANDIDATE & zero fake evidence', async () => {
      const result = await discoverAuthoritativeSources(
        'Government announced PM Kisan 17th installment disbursement date.',
        { forceGroundingError: { status: 429, message: 'Resource exhausted' } }
      );

      assert(result.groundingStatus === 'QUOTA_EXHAUSTED', 'Must record QUOTA_EXHAUSTED groundingStatus');
      assert(result.hasVerifiedEvidence === false, 'hasVerifiedEvidence must be false when grounding is quota exhausted');
      assert(result.sources.length === 0, 'Must NOT return verified sources when grounding fails');
      assert(typeof result.groundingLimitation === 'string', 'Must provide human-readable limitation explanation');

      // Candidate portals check
      if (result.candidateSources.length > 0) {
        for (const candidate of result.candidateSources) {
          assert(candidate.provenance === 'UNVERIFIED_CANDIDATE', 'Candidate must have UNVERIFIED_CANDIDATE provenance');
          assert(candidate.isVerified === false, 'isVerified must be strictly false');
          assert(candidate.sourceType === 'UNVERIFIED_CANDIDATE', 'sourceType must be UNVERIFIED_CANDIDATE');
          assert(candidate.relationship !== 'SUPPORTS' && candidate.relationship !== 'REFUTES', 'Must NEVER assign SUPPORTS/REFUTES');
          assert(!candidate.extractedText || candidate.extractedText.length === 0, 'Must NOT invent fake extracted text');
        }
      }
    });

    // 2.6. Provenance Guardrail: Preserves real grounding metadata when Google Search succeeds
    await runTest('2.6. Provenance Guardrail: Grounded search preserves real metadata & sets isVerified = true', async () => {
      const mockResult = await discoverAuthoritativeSources(
        'Test statement verified via sovereign gazette notification.',
        {
          mockGroundingChunks: [
            {
              web: {
                uri: 'https://egazette.gov.in/WriteReadData/2026/test.pdf',
                title: 'The Gazette of India - Notification 2026',
              },
            },
          ],
          mockGroundingSupports: [
            {
              groundingChunkIndices: [0],
              segment: { text: 'Official notification text retrieved from gazette.' },
            },
          ],
          mockWebSearchQueries: ['site:egazette.gov.in notification 2026'],
        }
      );

      assert(mockResult.groundingStatus === 'SUCCESS', 'groundingStatus must be SUCCESS');
      assert(mockResult.hasVerifiedEvidence === true, 'hasVerifiedEvidence must be true');
      assert(mockResult.sources.length === 1, 'Must return verified grounded source');
      const src = mockResult.sources[0];
      assert(src.provenance === 'GROUNDED_SEARCH', 'Must have GROUNDED_SEARCH provenance');
      assert(src.isVerified === true, 'isVerified must be true');
      assert(src.sourceType === 'GROUNDED_SEARCH', 'sourceType must be GROUNDED_SEARCH');
      assert(src.url === 'https://egazette.gov.in/WriteReadData/2026/test.pdf', 'Must preserve exact URL');
      assert(src.extractedText === 'Official notification text retrieved from gazette.', 'Must preserve grounded text segment');
      assert(src.relationship === 'MENTIONS', 'Relationship defaults to MENTIONS without analytical verdict');
    });

    // ==========================================================================
    // GROUP 3: LIVE GEMINI API TESTS (Live Quota-Exhaustion & Provenance Verification)
    // ==========================================================================
    console.log('\n[SECTION 3] Live Gemini API Tests (Quota Notice & Provenance Hardening)');
    const geminiConfig = getGeminiConfigStatus();

    if (!geminiConfig.isConfigured) {
      runBlockedTest('3.1. Active Gemini Client Initialization', 'GEMINI_API_KEY not set in environment');
      runBlockedTest('3.2. Live Gemini Quota-Exhaustion Detection & Sovereign Candidate Formulation', 'GEMINI_API_KEY not set in environment');
      runBlockedTest('3.3. POST /api/v1/sources/discover Endpoint Contract & Provenance Response', 'GEMINI_API_KEY not set in environment');
    } else {
      await runTest('3.1. Active Gemini Client Initialization', async () => {
        const client = getGeminiClient();
        assert(Boolean(client), 'getGeminiClient must return an initialized instance');
      });

      await runTest('3.2. Live Gemini Quota-Exhaustion Detection & Sovereign Candidate Formulation', async () => {
        const sampleClaim = 'Under PM-KUSUM 2025, solar pump subsidies are released through the official MNRE portal.';
        const result = await discoverAuthoritativeSources(sampleClaim);

        assert(typeof result.claim === 'string', 'Claim must be string');
        assert(Array.isArray(result.searchQueries), 'Search queries must be array');
        assert(result.searchQueries.length > 0, 'Must generate targeted search queries');

        // Verify Quota-Exhaustion behavior on live API key
        if (result.groundingStatus === 'QUOTA_EXHAUSTED') {
          assert(result.hasVerifiedEvidence === false, 'Must flag hasVerifiedEvidence: false on quota exhaustion');
          assert(result.sources.length === 0, 'Must NOT represent unverified candidates as verified sources');
          assert(result.candidateSources.length > 0, 'Candidate portals should be formulated for manual/async search');
          for (const cand of result.candidateSources) {
            assert(cand.provenance === 'UNVERIFIED_CANDIDATE', 'Candidate provenance must be UNVERIFIED_CANDIDATE');
            assert(cand.isVerified === false, 'isVerified must be false');
            assert(cand.relationship !== 'SUPPORTS' && cand.relationship !== 'REFUTES', 'No fabricated verdicts');
          }
        } else {
          // If quota were available:
          assert(result.groundingStatus === 'SUCCESS', 'groundingStatus must be SUCCESS');
          assert(result.hasVerifiedEvidence === true, 'hasVerifiedEvidence must be true');
        }
      });

      await runTest('3.3. POST /api/v1/sources/discover Endpoint Contract & Provenance Response', async () => {
        const res = await fetch(`${baseUrl}/api/v1/sources/discover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim: 'Free electricity scheme announced under PM Surya Ghar Muft Bijli Yojana on pmsuryaghar.gov.in.',
          }),
        });

        assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
        const data = await res.json();
        assert(typeof data.hasVerifiedEvidence === 'boolean', 'Response must include hasVerifiedEvidence');
        assert(typeof data.groundingStatus === 'string', 'Response must include groundingStatus');
        assert(Array.isArray(data.searchQueries), 'searchQueries must be array');
        if (data.groundingStatus === 'QUOTA_EXHAUSTED') {
          assert(data.success === false, 'success must be false when grounding is unavailable');
          assert(data.sourcesCount === 0, 'sourcesCount must be 0 when ungrounded');
          assert(Array.isArray(data.candidateSources), 'candidateSources must be present');
        }
      });
    }

    // ==========================================================================
    // GROUP 4: LIVE SUPABASE DATABASE PERSISTENCE TESTS
    // ==========================================================================
    console.log('\n[SECTION 4] Live Supabase Database Persistence & Status Hardening');
    const supabaseConfig = getSupabaseConfigStatus();

    if (!supabaseConfig.isConfigured || !geminiConfig.isConfigured) {
      const reason = !supabaseConfig.isConfigured
        ? 'Live SUPABASE_URL and SUPABASE_SECRET_KEY required'
        : 'GEMINI_API_KEY required for end-to-end source discovery persistence';
      runBlockedTest('4.1. Quota-Exhausted Discovery transitions status to FAILED (Zero fake evidence)', reason);
      runBlockedTest('4.2. Grounded Evidence Persistence transitions status to PROCESSING (Zero fake verdict)', reason);
      runBlockedTest('4.3. GET /api/v1/verify/:id truthful evidence contract', reason);
      runBlockedTest('4.4. GET /api/v1/sources lists persisted authoritative sources', reason);
    } else {
      // 4.1. Test Quota-Exhausted request handling: NO fake evidence in Supabase, status -> FAILED
      await runTest('4.1. Quota-Exhausted Discovery transitions status to FAILED (Zero fake evidence)', async () => {
        const supabase = getServerSupabase();

        const { data: quotaReq, error: reqErr } = await supabase
          .from('verification_requests')
          .insert({
            input_type: 'CLAIM',
            original_claim: 'Live claim test for quota exhaustion: PM Kusum Solar subsidy distribution rules.',
            status: 'QUEUED',
          })
          .select()
          .single();

        assert(!reqErr && quotaReq, `Failed to create test request: ${reqErr?.message}`);
        createdRequestIds.push(quotaReq.id);

        await supabase.from('claims').insert({
          verification_request_id: quotaReq.id,
          claim_text: quotaReq.original_claim,
          claim_type: 'FACTUAL_ASSERTION',
        });

        // Run discovery under simulated quota exhaustion (tests failure recovery & non-persistence of candidates)
        const result = await discoverAndPersistSourcesForRequest(quotaReq.id, {
          forceGroundingError: { status: 429, message: 'Resource exhausted' },
        });

        assert(result.hasVerifiedEvidence === false, 'hasVerifiedEvidence must be false on quota exhaustion');
        assert(result.status === 'FAILED', 'Status must transition to FAILED (NOT stuck in PROCESSING)');
        assert(result.sourcesCount === 0, 'sourcesCount must be 0');
        assert(result.evidence.length === 0, 'Zero evidence rows must be returned');

        // Check verification_requests in Supabase: status must be FAILED, NOT stuck in PROCESSING
        const { data: updatedReq } = await supabase
          .from('verification_requests')
          .select('status')
          .eq('id', quotaReq.id)
          .single();
        assert(updatedReq?.status === 'FAILED', `Status in DB must be FAILED, got ${updatedReq?.status}`);

        // Check public.evidence in Supabase: MUST HAVE 0 ROWS for this request!
        const { data: evRows } = await supabase
          .from('evidence')
          .select('*')
          .eq('verification_request_id', quotaReq.id);
        assert(!evRows || evRows.length === 0, 'Must NOT persist unverified candidates into public.evidence!');

        // Check public.verification_results: MUST HAVE 0 ROWS!
        const { data: results } = await supabase
          .from('verification_results')
          .select('*')
          .eq('verification_request_id', quotaReq.id);
        assert(!results || results.length === 0, 'Must NOT fabricate a verdict in verification_results');
      });

      // 4.2. Test Grounded Evidence Persistence (using simulated verified grounding chunks)
      await runTest('4.2. Grounded Evidence Persistence transitions status to PROCESSING (Zero fake verdict)', async () => {
        const supabase = getServerSupabase();

        const { data: groundedReq, error: reqErr } = await supabase
          .from('verification_requests')
          .insert({
            input_type: 'CLAIM',
            original_claim: 'Test scheme: PM Kisan 17th installment release date announced on pmkisan.gov.in portal.',
            status: 'QUEUED',
          })
          .select()
          .single();

        assert(!reqErr && groundedReq, `Failed to create test request: ${reqErr?.message}`);
        createdRequestIds.push(groundedReq.id);

        await supabase.from('claims').insert({
          verification_request_id: groundedReq.id,
          claim_text: groundedReq.original_claim,
          claim_type: 'FACTUAL_ASSERTION',
        });

        // Run discovery with verified grounding chunks
        const persisted = await discoverAndPersistSourcesForRequest(groundedReq.id, {
          mockGroundingChunks: [
            {
              web: {
                uri: 'https://pmkisan.gov.in/release-notification-17th.html',
                title: 'PM-KISAN 17th Installment Release Official Notification',
              },
            },
          ],
          mockGroundingSupports: [
            {
              groundingChunkIndices: [0],
              segment: { text: 'Honorable Prime Minister released the 17th installment of PM-KISAN scheme.' },
            },
          ],
          mockWebSearchQueries: ['site:pmkisan.gov.in 17th installment'],
        });

        assert(persisted.hasVerifiedEvidence === true, 'hasVerifiedEvidence must be true');
        assert(persisted.sourcesCount > 0, 'Must persist verified source');
        assert(persisted.evidence.length > 0, 'Must persist verified evidence');
        assert(persisted.status === 'PROCESSING', 'Status must transition to PROCESSING for Step 2');

        // Verify DB records
        const { data: verifiedDbReq } = await supabase
          .from('verification_requests')
          .select('status')
          .eq('id', groundedReq.id)
          .single();
        assert(verifiedDbReq?.status === 'PROCESSING', 'DB status must be PROCESSING');

        // Confirm NO verdict was fabricated in verification_results!
        const { data: results } = await supabase
          .from('verification_results')
          .select('*')
          .eq('verification_request_id', groundedReq.id);
        assert(!results || results.length === 0, 'Phase 3 Step 1.5 MUST NOT fabricate a verdict in verification_results');
      });

      // 4.3. GET /api/v1/verify/:id returns persisted evidence with sources for grounded record
      await runTest('4.3. GET /api/v1/verify/:id returns persisted evidence with sources for grounded record', async () => {
        assert(createdRequestIds.length > 0, 'Must have created request from previous test');
        const groundedId = createdRequestIds[createdRequestIds.length - 1];

        const res = await fetch(`${baseUrl}/api/v1/verify/${groundedId}`);
        assert(res.status === 200, `Expected 200 OK, got ${res.status}`);

        const data = await res.json();
        assert(data.data.id === groundedId, 'Returned record ID must match');
        assert(data.data.status === 'PROCESSING', 'Grounded request status must be PROCESSING');
        assert(Array.isArray(data.data.evidence), 'Evidence array must exist');
        assert(data.data.evidence.length > 0, 'Evidence must contain grounded records');
        assert(Boolean(data.data.evidence[0].sources), 'Nested sources object must exist on evidence');
        assert(data.data.evidence[0].sources.source_type === 'GROUNDED_SEARCH', 'source_type must be GROUNDED_SEARCH');
        assert(data.data.evidence[0].sources.domain.includes('pmkisan.gov.in'), 'Domain must match grounded source');
      });

      // 4.4. GET /api/v1/sources lists persisted authoritative sources
      await runTest('4.4. GET /api/v1/sources lists persisted authoritative sources', async () => {
        const res = await fetch(`${baseUrl}/api/v1/sources?limit=10`);
        assert(res.status === 200, `Expected 200 OK, got ${res.status}`);

        const data = await res.json();
        assert(Array.isArray(data.sources), 'sources must be an array');
        assert(typeof data.count === 'number', 'count must be a number');
      });
    }

    console.log('\n================================================================');
    console.log(`PHASE 3 STEP 1.5 TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed | ${blockedLiveTests} Blocked`);
    console.log('================================================================\n');
  } finally {
    // Clean up temporary test request records if created
    if (createdRequestIds.length > 0) {
      try {
        const supabase = getServerSupabase();
        for (const id of createdRequestIds) {
          await supabase.from('verification_requests').delete().eq('id', id);
        }
      } catch (cleanErr: any) {
        console.warn('Note: Cleanup of test records encountered:', cleanErr.message);
      }
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
