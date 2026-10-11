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
  console.log('GOVVERIFY AI — PHASE 3 STEP 2 AUTOMATED TEST SUITE');
  console.log('Multi-Source Evidence Analysis and Verdict Generation');
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
    // SECTION 1: OFFLINE UNIT TESTS (MOCKED LOGIC & SAFEGUARDS)
    // ==========================================================================
    console.log('[SECTION 1] Offline Unit Tests (Decomposition, Provenance & Decision Logic)');

    await runTest('1.1. Complex claim decomposition into atomic testable subclaims', async () => {
      const compoundClaim =
        'Government increased PM-KISAN installment to ₹4,000 and mandatory face authentication starting 2026; also Aadhaar seeding required.';
      const subclaims = await decomposeClaimIntoSubclaims(compoundClaim, { forceModelFailure: true });
      assert(Array.isArray(subclaims), 'Subclaims must be an array');
      assert(subclaims.length >= 2, `Expected at least 2 subclaims, got ${subclaims.length}`);
      assert(
        subclaims.some((s) => s.toLowerCase().includes('pm-kisan') || s.toLowerCase().includes('4,000')),
        'Must isolate PM-KISAN installment proposition'
      );
      assert(
        subclaims.some((s) => s.toLowerCase().includes('face authentication')),
        'Must isolate face authentication proposition'
      );
    });

    await runTest('1.2. Verified evidence supporting a claim produces SUPPORTED verdict', async () => {
      const claim = 'PM-KISAN scheme provides financial benefit of ₹6,000 per year to eligible farmers.';
      const subclaims = [claim];
      const verifiedEvidence = [
        {
          id: 'ev-11111111-1111-1111-1111-111111111111',
          source_id: 'src-11111111-1111-1111-1111-111111111111',
          extracted_text:
            'Under the PM-KISAN scheme, an amount of ₹6,000 per year is transferred in three installments of ₹2,000 each directly into the bank accounts of the farmers.',
          relationship: 'SUPPORTS',
          sources: {
            id: 'src-11111111-1111-1111-1111-111111111111',
            title: 'PM-KISAN Portal Operational Guidelines',
            url: 'https://pmkisan.gov.in/guidelines.html',
            domain: 'pmkisan.gov.in',
            issuing_authority: 'Ministry of Agriculture and Farmers Welfare',
            source_type: 'GROUNDED_SEARCH',
          },
        },
      ];

      const analysis = evaluateEvidenceForSubclaims(claim, subclaims, verifiedEvidence);
      assert(analysis.verdict === 'SUPPORTED', `Expected SUPPORTED, got ${analysis.verdict}`);
      assert(analysis.confidence >= 80, `Expected confidence >= 80, got ${analysis.confidence}`);
      assert(analysis.subclaims[0].verdict === 'SUPPORTED', 'Subclaim should be SUPPORTED');
      assert(analysis.citations.length === 1, 'Should contain 1 traceable citation');
      assert(analysis.citations[0].id === verifiedEvidence[0].id, 'Citation must match evidence ID');
    });

    await runTest('1.3. Verified official denial/clarification produces CONTRADICTED verdict', async () => {
      const claim = 'Finance Ministry announces 50% waiver of GST for small traders starting tomorrow.';
      const subclaims = [claim];
      const verifiedEvidence = [
        {
          id: 'ev-22222222-2222-2222-2222-222222222222',
          source_id: 'src-22222222-2222-2222-2222-222222222222',
          extracted_text:
            'A claim is circulating that Finance Ministry announced 50% GST waiver. PIB Fact Check clarifies this message is fake. No such decision has been taken by the GST Council.',
          relationship: 'REFUTES',
          sources: {
            id: 'src-22222222-2222-2222-2222-222222222222',
            title: 'PIB Fact Check: Fake news regarding GST waiver',
            url: 'https://pib.gov.in/factcheck/gst-rumour.html',
            domain: 'pib.gov.in',
            issuing_authority: 'Press Information Bureau Fact Check Unit',
            source_type: 'GROUNDED_SEARCH',
          },
        },
      ];

      const analysis = evaluateEvidenceForSubclaims(claim, subclaims, verifiedEvidence);
      assert(analysis.verdict === 'CONTRADICTED', `Expected CONTRADICTED, got ${analysis.verdict}`);
      assert(analysis.confidence >= 80, `Expected high confidence, got ${analysis.confidence}`);
      assert(analysis.subclaims[0].verdict === 'CONTRADICTED', 'Subclaim should be CONTRADICTED');
      assert(analysis.citations[0].relationship === 'CONTRADICTS', 'Citation relationship must be CONTRADICTS');
    });

    await runTest('1.4. Mixed evidence produces qualified PARTIALLY_SUPPORTED outcome', async () => {
      const subclaim1 = 'PM-KISAN provides ₹6,000 per year to eligible farmers';
      const subclaim2 = 'Government has doubled the benefit to ₹12,000 for all farmers starting 2026';
      const subclaims = [subclaim1, subclaim2];

      const verifiedEvidence = [
        {
          id: 'ev-33333333-3333-3333-3333-333333333331',
          source_id: 'src-33333333-3333-3333-3333-333333333331',
          extracted_text: 'PM-KISAN provides financial benefit of ₹6,000 per year payable in three equal 4-monthly installments.',
          relationship: 'SUPPORTS',
          sources: {
            id: 'src-33333333-3333-3333-3333-333333333331',
            title: 'PM-KISAN Portal Rules',
            url: 'https://pmkisan.gov.in/rules',
            domain: 'pmkisan.gov.in',
            issuing_authority: 'Ministry of Agriculture',
            source_type: 'GROUNDED_SEARCH',
          },
        },
        {
          id: 'ev-33333333-3333-3333-3333-333333333332',
          source_id: 'src-33333333-3333-3333-3333-333333333332',
          extracted_text: 'PIB Fact Check: A viral message claiming doubling of PM-KISAN installment to ₹12,000 is fake. Government has denied any such proposal.',
          relationship: 'REFUTES',
          sources: {
            id: 'src-33333333-3333-3333-3333-333333333332',
            title: 'PIB Fact Check Clarification',
            url: 'https://pib.gov.in/FactCheck/pmkisan-fake.html',
            domain: 'pib.gov.in',
            issuing_authority: 'Press Information Bureau',
            source_type: 'GROUNDED_SEARCH',
          },
        },
      ];

      const analysis = evaluateEvidenceForSubclaims('Compound PM-KISAN assertion', subclaims, verifiedEvidence);
      assert(
        analysis.verdict === 'PARTIALLY_SUPPORTED',
        `Expected PARTIALLY_SUPPORTED for mixed evidence, got ${analysis.verdict}`
      );
      assert(analysis.subclaims[0].verdict === 'SUPPORTED', 'First subclaim should be SUPPORTED');
      assert(analysis.subclaims[1].verdict === 'CONTRADICTED', 'Second subclaim should be CONTRADICTED');
    });

    await runTest('1.5. Complex claims with some subclaims unsupported result in qualified outcome', async () => {
      const subclaim1 = 'PM-KISAN gives ₹6,000 per year';
      const subclaim2 = 'Every farmer gets a free tractor certificate from the portal';
      const subclaims = [subclaim1, subclaim2];

      const verifiedEvidence = [
        {
          id: 'ev-44444444-4444-4444-4444-444444444441',
          source_id: 'src-44444444-4444-4444-4444-444444444441',
          extracted_text: 'PM-KISAN gives financial assistance of ₹6,000 per annum to all landholding farmer families.',
          relationship: 'SUPPORTS',
          sources: {
            id: 'src-44444444-4444-4444-4444-444444444441',
            title: 'Official Gazette Notification',
            url: 'https://agricoop.nic.in/notification',
            domain: 'agricoop.nic.in',
            issuing_authority: 'Department of Agriculture',
            source_type: 'GROUNDED_SEARCH',
          },
        },
      ];

      const analysis = evaluateEvidenceForSubclaims('Claim with one supported and one unsupported subclaim', subclaims, verifiedEvidence);
      assert(
        analysis.verdict === 'PARTIALLY_SUPPORTED',
        `Expected PARTIALLY_SUPPORTED when one subclaim is supported and one is insufficient, got ${analysis.verdict}`
      );
      assert(analysis.subclaims[1].verdict === 'INSUFFICIENT_EVIDENCE', 'Second subclaim should be INSUFFICIENT_EVIDENCE');
      assert(analysis.subclaims[1].relevance === 'ABSENT', 'Second subclaim relevance should be ABSENT');
    });

    await runTest('1.6. Zero verified evidence returns INSUFFICIENT_EVIDENCE with 0 confidence (Safeguard 3)', async () => {
      const claim = 'Unverified speculative rumor with zero official gazette records.';
      const subclaims = [claim];
      const analysis = evaluateEvidenceForSubclaims(claim, subclaims, []);

      assert(analysis.verdict === 'INSUFFICIENT_EVIDENCE', 'Must return INSUFFICIENT_EVIDENCE');
      assert(analysis.confidence === 0, `Confidence must be 0 for zero evidence, got ${analysis.confidence}`);
      assert(analysis.evidenceCount === 0, 'Evidence count must be 0');
      assert(analysis.citations.length === 0, 'Citations must be empty');
      assert(typeof analysis.limitation === 'string', 'Must record limitation');
    });

    await runTest('1.7. Candidate sources incorrectly offered as evidence are rejected (Safeguards 1 & 2)', async () => {
      const mixedEvidenceList = [
        {
          id: 'ev-candidate-1',
          source_id: 'src-cand-1',
          extracted_text: 'Candidate search query or model-generated summary',
          sources: {
            id: 'src-cand-1',
            title: 'Candidate Portal Search Query',
            url: 'https://pib.gov.in',
            source_type: 'UNVERIFIED_CANDIDATE', // ILLEGAL AS EVIDENCE
          },
        },
        {
          id: 'ev-candidate-2',
          source_id: 'src-cand-2',
          extracted_text: '', // Empty text is illegal
          sources: {
            id: 'src-cand-2',
            title: 'Empty text source',
            url: 'https://india.gov.in',
            source_type: 'GROUNDED_SEARCH',
          },
        },
        {
          id: 'ev-valid-1',
          source_id: 'src-valid-1',
          extracted_text: 'Official sovereign gazette excerpt with verified provenance.',
          sources: {
            id: 'src-valid-1',
            title: 'Official Gazette Notification',
            url: 'https://egazette.gov.in/notice-123.pdf',
            source_type: 'GROUNDED_SEARCH', // VALID
          },
        },
      ];

      const filtered = filterVerifiedEvidence(mixedEvidenceList);
      assert(filtered.length === 1, `Expected exactly 1 verified evidence item, got ${filtered.length}`);
      assert(filtered[0].id === 'ev-valid-1', 'Only GROUNDED_SEARCH with real text is accepted');
    });

    await runTest('1.8. Fabricated citations or unsupported quotations rejected by validator (Safeguard 9)', async () => {
      const verifiedEvidence = [
        {
          id: 'real-ev-1',
          source_id: 'real-src-1',
        },
      ];

      const fabricatedAnalysis: StructuredVerdictAnalysis = {
        verdict: 'SUPPORTED',
        confidence: 95,
        summaryExplanation: 'Fabricated claim explanation citing imaginary evidence.',
        subclaims: [
          {
            statement: 'Subclaim',
            verdict: 'SUPPORTED',
            explanation: 'Fabricated explanation',
            supportingEvidenceIds: ['phantom-evidence-id-999'], // PHANTOM ID
            contradictingEvidenceIds: [],
            relevance: 'DIRECT',
          },
        ],
        citations: [
          {
            id: 'phantom-evidence-id-999', // PHANTOM ID
            sourceId: 'phantom-source-id',
            sourceTitle: 'Hallucinated Gazette',
            sourceUrl: 'https://fake-government-portal.org',
            officialPublisher: 'Fake Ministry',
            relevantExcerpt: 'Invented quotation',
            relationship: 'SUPPORTS',
            verdictContribution: 'SUPPORTED',
          },
        ],
        evidenceCount: 1,
        verifiedSourcesCount: 1,
        completedAt: new Date().toISOString(),
      };

      const result = validateVerdictAnalysis(fabricatedAnalysis, verifiedEvidence);
      assert(!result.isValid, 'Validator MUST reject fabricated citation IDs');
      assert(
        result.error?.includes('Traceability violation') || false,
        `Expected Traceability violation, got: ${result.error}`
      );
    });

    await runTest('1.9. Malformed model output strictly rejected by validator (Safeguard 9)', async () => {
      const verifiedEvidence = [{ id: 'ev-1' }];

      // Case A: Invalid verdict string
      const malformedVerdict: any = {
        verdict: 'PROBABLY_TRUE', // Invalid enum
        confidence: 85,
        summaryExplanation: 'Valid explanation',
        subclaims: [],
        citations: [],
      };
      assert(!validateVerdictAnalysis(malformedVerdict, verifiedEvidence).isValid, 'Must reject invalid verdict');

      // Case B: Out-of-bounds confidence
      const invalidConfidence: any = {
        verdict: 'SUPPORTED',
        confidence: 150, // Invalid range (>100)
        summaryExplanation: 'Valid explanation',
        subclaims: [],
        citations: [],
      };
      assert(!validateVerdictAnalysis(invalidConfidence, verifiedEvidence).isValid, 'Must reject confidence > 100');

      // Case C: Empty summary explanation
      const emptyExplanation: any = {
        verdict: 'SUPPORTED',
        confidence: 85,
        summaryExplanation: '   ', // Empty
        subclaims: [],
        citations: [],
      };
      assert(!validateVerdictAnalysis(emptyExplanation, verifiedEvidence).isValid, 'Must reject empty explanation');
    });

    await runTest('1.10. Gemini quota exhaustion or transient failure recovers gracefully (Safeguard 3)', async () => {
      const claim = 'Government of India announces PM Surya Ghar Muft Bijli Yojana with subsidy for solar rooftop installation.';
      const subclaims = await decomposeClaimIntoSubclaims(claim, { forceModelFailure: true });
      assert(Array.isArray(subclaims) && subclaims.length > 0, 'Syntactic fallback must succeed when model fails');

      const verifiedEvidence = [
        {
          id: 'ev-sol-1',
          source_id: 'src-sol-1',
          extracted_text: 'PM Surya Ghar Muft Bijli Yojana provides financial assistance and subsidy up to 40% for rooftop solar installation.',
          relationship: 'SUPPORTS',
          sources: {
            id: 'src-sol-1',
            title: 'PM Surya Ghar National Portal',
            url: 'https://pmsuryaghar.gov.in',
            domain: 'pmsuryaghar.gov.in',
            issuing_authority: 'Ministry of New and Renewable Energy',
            source_type: 'GROUNDED_SEARCH',
          },
        },
      ];

      // Even if Gemini model generation is bypassed or rate-limited, deterministic evaluation produces defensible output
      const analysis = evaluateEvidenceForSubclaims(claim, subclaims, verifiedEvidence);
      assert(analysis.verdict === 'SUPPORTED', 'Should evaluate successfully via deterministic engine');
      assert(analysis.confidence > 0, 'Confidence must be calculated');
      assert(analysis.citations.length === 1, 'Citation must be traceable');
    });

    await runTest('1.11. Citations deduplicate correctly across multiple references', async () => {
      const subclaim1 = 'Aadhaar is required for PM-KISAN';
      const subclaim2 = 'Land verification is required for PM-KISAN';
      const subclaims = [subclaim1, subclaim2];

      // Single evidence supporting both subclaims
      const verifiedEvidence = [
        {
          id: 'ev-shared-1',
          source_id: 'src-shared-1',
          extracted_text: 'Under PM-KISAN, mandatory Aadhaar verification and land record verification must be completed.',
          relationship: 'SUPPORTS',
          sources: {
            id: 'src-shared-1',
            title: 'PM-KISAN Guidelines',
            url: 'https://pmkisan.gov.in/guidelines',
            domain: 'pmkisan.gov.in',
            issuing_authority: 'Ministry of Agriculture',
            source_type: 'GROUNDED_SEARCH',
          },
        },
      ];

      const analysis = evaluateEvidenceForSubclaims('PM-KISAN eligibility criteria', subclaims, verifiedEvidence);
      assert(analysis.citations.length === 1, `Expected 1 deduplicated citation, got ${analysis.citations.length}`);
    });

    await runTest('1.12. Ensuring invalid or insufficient analysis cannot produce confident verdict (Safeguard 3)', async () => {
      const zeroEvidence: any[] = [];
      const deceptiveAnalysis: StructuredVerdictAnalysis = {
        verdict: 'SUPPORTED', // ILLEGAL when zero evidence
        confidence: 99,
        summaryExplanation: 'I am claiming this is true despite zero evidence.',
        subclaims: [],
        citations: [],
        evidenceCount: 0,
        verifiedSourcesCount: 0,
        completedAt: new Date().toISOString(),
      };

      const val = validateVerdictAnalysis(deceptiveAnalysis, zeroEvidence);
      assert(!val.isValid, 'Validator MUST reject SUPPORTED verdict when verified evidence count is 0');
      assert(val.error?.includes('Integrity violation') || false, 'Should flag Integrity violation');
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

      await runTest('2.1. Request ownership and guest-token authorization on POST /api/v1/verify/:id/verdict', async () => {
        // 1. Create a guest verification request in Supabase
        const guestToken = 'secure-guest-token-abc123xyz789';
        const { data: reqRecord, error: insertErr } = await supabase
          .from('verification_requests')
          .insert({
            input_type: 'CLAIM',
            original_claim: 'Test claim for guest authorization check',
            status: 'QUEUED',
            guest_session_token: guestToken,
          })
          .select()
          .single();

        assert(!insertErr && reqRecord, `Failed to create test request: ${insertErr?.message}`);
        createdRequestIds.push(reqRecord.id);

        // 2. Attempt verdict generation with WRONG guest token -> must return 403 Forbidden
        const unauthorizedRes = await fetch(`${baseUrl}/api/v1/verify/${reqRecord.id}/verdict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Guest-Token': 'wrong-token',
          },
        });
        assert(unauthorizedRes.status === 403, `Expected 403 for wrong guest token, got ${unauthorizedRes.status}`);

        // 3. Attempt verdict generation with MISSING token -> must return 403 Forbidden
        const noTokenRes = await fetch(`${baseUrl}/api/v1/verify/${reqRecord.id}/verdict`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        assert(noTokenRes.status === 403, `Expected 403 for missing token, got ${noTokenRes.status}`);
      });

      await runTest('2.2. Invalid request ID handling on POST /api/v1/verify/:id/verdict', async () => {
        // Non-UUID
        const nonUuidRes = await fetch(`${baseUrl}/api/v1/verify/not-a-valid-uuid/verdict`, {
          method: 'POST',
        });
        assert(nonUuidRes.status === 400, `Expected 400 for non-UUID, got ${nonUuidRes.status}`);

        // Non-existent UUID
        const notFoundRes = await fetch(`${baseUrl}/api/v1/verify/00000000-0000-0000-0000-000000000000/verdict`, {
          method: 'POST',
        });
        assert(notFoundRes.status === 404, `Expected 404 for non-existent ID, got ${notFoundRes.status}`);
      });

      await runTest('2.3. End-to-end verdict persistence and retrieval via GET /api/v1/verify/:id', async () => {
        const guestToken = 'guest-token-persisted-test';
        // 1. Create request
        const { data: testReq, error: reqErr } = await supabase
          .from('verification_requests')
          .insert({
            input_type: 'CLAIM',
            original_claim: 'Government of India launches PM-KISAN installment to bank accounts of farmers.',
            status: 'QUEUED',
            guest_session_token: guestToken,
          })
          .select()
          .single();

        assert(!reqErr && testReq, `Failed to insert request: ${reqErr?.message}`);
        createdRequestIds.push(testReq.id);

        // 2. Create authoritative sovereign source
        const { data: testSrc, error: srcErr } = await supabase
          .from('sources')
          .insert({
            title: 'PM-KISAN Official Scheme Portal',
            url: 'https://pmkisan.gov.in/about.aspx',
            domain: 'pmkisan.gov.in',
            issuing_authority: 'Ministry of Agriculture and Farmers Welfare',
            source_type: 'GROUNDED_SEARCH',
          })
          .select()
          .single();

        assert(!srcErr && testSrc, `Failed to insert source: ${srcErr?.message}`);

        // 3. Create verified evidence record
        const { data: testEv, error: evErr } = await supabase
          .from('evidence')
          .insert({
            verification_request_id: testReq.id,
            source_id: testSrc.id,
            extracted_text:
              'Under the PM-KISAN scheme, an amount of ₹6,000 per year is transferred in three installments directly into farmer bank accounts.',
            relationship: 'SUPPORTS',
          })
          .select()
          .single();

        assert(!evErr && testEv, `Failed to insert evidence: ${evErr?.message}`);

        // 4. Call POST /api/v1/verify/:id/verdict with valid guest token
        const verdictRes = await fetch(`${baseUrl}/api/v1/verify/${testReq.id}/verdict`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Guest-Token': guestToken,
          },
          body: JSON.stringify({ autoDiscover: false }),
        });

        assert(verdictRes.status === 200, `Expected 200, got ${verdictRes.status}`);
        const verdictJson = await verdictRes.json();

        assert(verdictJson.success === true, 'Success must be true');
        assert(verdictJson.status === 'COMPLETED', `Expected status COMPLETED, got ${verdictJson.status}`);
        assert(verdictJson.verdict === 'SUPPORTED', `Expected verdict SUPPORTED, got ${verdictJson.verdict}`);
        assert(verdictJson.confidence >= 80, `Expected confidence >= 80, got ${verdictJson.confidence}`);
        assert(verdictJson.citations.length >= 1, 'Must contain verified citation');

        // 5. Query database verification_results directly to verify persistence
        const { data: dbResult, error: checkErr } = await supabase
          .from('verification_results')
          .select('*')
          .eq('verification_request_id', testReq.id)
          .single();

        assert(!checkErr && dbResult, `Verification result not found in DB: ${checkErr?.message}`);
        assert(dbResult.verdict === 'SUPPORTED', `DB verdict must be SUPPORTED, got ${dbResult.verdict}`);
        assert(Number(dbResult.confidence) >= 80, `DB confidence must be >= 80, got ${dbResult.confidence}`);

        // 6. Query request status in DB
        const { data: updatedReq } = await supabase
          .from('verification_requests')
          .select('status')
          .eq('id', testReq.id)
          .single();
        assert(updatedReq?.status === 'COMPLETED', `Request status must be updated to COMPLETED in DB`);

        // 7. Verify retrieval via GET /api/v1/verify/:id with guest token
        const getRes = await fetch(`${baseUrl}/api/v1/verify/${testReq.id}?token=${guestToken}`);
        assert(getRes.status === 200, `Expected 200 for GET /api/v1/verify/:id, got ${getRes.status}`);
        const getJson = await getRes.json();
        const vResult = Array.isArray(getJson.data?.verification_results)
          ? getJson.data.verification_results[0]
          : getJson.data?.verification_results;
        assert(vResult?.verdict === 'SUPPORTED', `GET returned correct verdict, got: ${JSON.stringify(vResult)}`);
      });

      await runTest('2.4. Decomposed subclaims are stored in public.claims', async () => {
        const guestToken = 'guest-token-subclaims-test';
        const { data: testReq } = await supabase
          .from('verification_requests')
          .insert({
            input_type: 'CLAIM',
            original_claim: 'Government increased PM-KISAN installment to ₹4,000 and mandatory face authentication starting 2026.',
            status: 'QUEUED',
            guest_session_token: guestToken,
          })
          .select()
          .single();

        if (testReq) {
          createdRequestIds.push(testReq.id);
          await analyzeAndPersistVerdictForRequest(testReq.id, { forceModelFailure: true });

          // Verify that subclaims were inserted into public.claims
          const { data: claimsInDb } = await supabase
            .from('claims')
            .select('*')
            .eq('verification_request_id', testReq.id)
            .eq('claim_type', 'SUBCLAIM');

          assert(Boolean(claimsInDb && claimsInDb.length >= 2), `Expected at least 2 SUBCLAIM rows in DB, got ${claimsInDb?.length}`);
        }
      });

      await runTest('2.5. Automatic verdict pipeline: Normal claim submission automatically proceeds to verdict analysis after successful discovery', async () => {
        const claim = 'PM-KISAN scheme provides financial benefit of ₹6,000 per year directly to eligible farmers.';
        const mockChunks = [
          {
            web: {
              uri: 'https://pmkisan.gov.in/guidelines.html',
              title: 'PM-KISAN Portal Operational Guidelines',
            },
          },
        ];
        const mockSupports = [
          {
            groundingChunkIndices: [0],
            segment: {
              text: 'Under PM-KISAN scheme, an amount of ₹6,000 per year is transferred in three installments directly into farmer bank accounts.',
            },
          },
        ];

        const res = await fetch(`${baseUrl}/api/v1/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim,
            discoveryOptions: {
              provider: 'gemini',
              mockGroundingChunks: mockChunks,
              mockGroundingSupports: mockSupports,
            },
          }),
        });

        assert(res.status === 201, `Expected 201, got ${res.status}`);
        const data = await res.json();
        assert(data.status === 'QUEUED', `Immediate intake status must be QUEUED, got ${data.status}`);
        assert(Boolean(data.id), 'Must return request ID');
        createdRequestIds.push(data.id);

        // Poll for background worker completion (max 4 seconds)
        let completed = false;
        let finalStatus = '';
        for (let i = 0; i < 40; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const { data: reqCheck } = await supabase
            .from('verification_requests')
            .select('status')
            .eq('id', data.id)
            .single();
          finalStatus = reqCheck?.status || '';
          if (finalStatus === 'COMPLETED') {
            completed = true;
            break;
          }
        }

        assert(completed, `Expected request to automatically complete, but status remained '${finalStatus}'`);

        // Verify verification_results was persisted in DB
        const { data: dbResult, error: resErr } = await supabase
          .from('verification_results')
          .select('*')
          .eq('verification_request_id', data.id)
          .single();

        assert(!resErr && dbResult, `Verification result record must exist in DB: ${resErr?.message}`);
        assert(dbResult.verdict === 'SUPPORTED', `Expected SUPPORTED verdict in DB, got ${dbResult.verdict}`);
        assert(Number(dbResult.confidence) >= 80, `Expected confidence >= 80, got ${dbResult.confidence}`);

        // Verify retrieval via GET /api/v1/verify/:id with guest token
        const getRes = await fetch(`${baseUrl}/api/v1/verify/${data.id}?token=${data.guestToken}`);
        assert(getRes.status === 200, `Expected 200 from GET, got ${getRes.status}`);
        const getJson = await getRes.json();
        const vResult = Array.isArray(getJson.data?.verification_results)
          ? getJson.data.verification_results[0]
          : getJson.data?.verification_results;
        assert(vResult?.verdict === 'SUPPORTED', `GET returned verdict ${vResult?.verdict}`);
      });

      await runTest('2.6. autoVerdict: false intentionally pauses pipeline after discovery without generating verdict', async () => {
        const claim = 'PM-KISAN scheme provides financial benefit of ₹6,000 per year directly to eligible farmers.';
        const mockChunks = [
          {
            web: {
              uri: 'https://pmkisan.gov.in/rules.html',
              title: 'PM-KISAN Rules',
            },
          },
        ];
        const mockSupports = [
          {
            groundingChunkIndices: [0],
            segment: { text: 'PM-KISAN transfers ₹6,000 per year directly to farmer bank accounts.' },
          },
        ];

        const res = await fetch(`${baseUrl}/api/v1/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim,
            autoVerdict: false, // EXPLICIT OPT-OUT
            discoveryOptions: {
              provider: 'gemini',
              mockGroundingChunks: mockChunks,
              mockGroundingSupports: mockSupports,
            },
          }),
        });

        assert(res.status === 201, `Expected 201, got ${res.status}`);
        const data = await res.json();
        createdRequestIds.push(data.id);

        // Poll for background discovery completion (status becomes PROCESSING with evidence)
        let processed = false;
        let finalStatus = '';
        let finalEvCount = 0;

        for (let i = 0; i < 30; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const { data: reqRecord } = await supabase
            .from('verification_requests')
            .select('status, evidence(count)')
            .eq('id', data.id)
            .single();

          finalStatus = reqRecord?.status || '';
          finalEvCount = (reqRecord?.evidence as any)?.[0]?.count || 0;

          if (finalStatus === 'PROCESSING' && finalEvCount > 0) {
            processed = true;
            break;
          }
        }

        assert(processed, `Expected status PROCESSING with evidence, got status '${finalStatus}' with ${finalEvCount} evidence records`);

        // Confirm verification_results remains completely empty
        const { data: vrList } = await supabase
          .from('verification_results')
          .select('*')
          .eq('verification_request_id', data.id);
        assert(!vrList || vrList.length === 0, 'verification_results must remain 0 when autoVerdict: false');
      });

      await runTest('2.7. skipDiscovery: true prevents background discovery during intake', async () => {
        const res = await fetch(`${baseUrl}/api/v1/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim: 'Government provides interest subvention for crop loans under revised scheme.',
            skipDiscovery: true, // EXPLICIT SKIP
          }),
        });

        assert(res.status === 201, `Expected 201, got ${res.status}`);
        const data = await res.json();
        createdRequestIds.push(data.id);

        await new Promise((resolve) => setTimeout(resolve, 200));

        const { data: reqRecord } = await supabase
          .from('verification_requests')
          .select('status, evidence(count)')
          .eq('id', data.id)
          .single();

        assert(reqRecord?.status === 'QUEUED', `Status must stay QUEUED when skipDiscovery: true, got ${reqRecord?.status}`);
        assert((reqRecord?.evidence as any)?.[0]?.count === 0, 'Zero evidence should be created when skipDiscovery: true');
      });

      await runTest('2.8. Controlled 429 quota failure never produces fabricated supported or contradicted verdict', async () => {
        const res = await fetch(`${baseUrl}/api/v1/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim: 'Unconfirmed claim tested under simulated 429 quota exhaustion.',
            discoveryOptions: {
              provider: 'gemini',
              forceGroundingError: { status: 429, message: 'Simulated RESOURCE_EXHAUSTED 429' },
            },
          }),
        });

        assert(res.status === 201, `Expected 201, got ${res.status}`);
        const data = await res.json();
        createdRequestIds.push(data.id);

        // Allow background task to handle quota error
        let finalStatus = '';
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          const { data: reqCheck } = await supabase
            .from('verification_requests')
            .select('status')
            .eq('id', data.id)
            .single();
          finalStatus = reqCheck?.status || '';
          if (finalStatus === 'FAILED') break;
        }

        assert(finalStatus === 'FAILED', `Request must transition to FAILED on quota error, got ${finalStatus}`);

        // Confirm NO evidence and NO verification_results were persisted
        const { data: evList } = await supabase
          .from('evidence')
          .select('id')
          .eq('verification_request_id', data.id);
        assert(!evList || evList.length === 0, 'Zero evidence must be saved on quota failure');

        const { data: vrList } = await supabase
          .from('verification_results')
          .select('*')
          .eq('verification_request_id', data.id);
        assert(!vrList || vrList.length === 0, 'Zero verification_results must be saved on discovery quota failure');
      });

      await runTest('2.9. Document workflow contract: intake with skipDiscovery=true prevents background race condition', async () => {
        const claimText = 'Extracted factual statement from verified document upload.';
        const res = await fetch(`${baseUrl}/api/v1/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            claim: claimText,
            inputType: 'DOCUMENT',
            skipDiscovery: true, // Matching updated VerificationWorkspace.tsx
          }),
        });

        assert(res.status === 201, `Expected 201, got ${res.status}`);
        const data = await res.json();
        assert(data.inputType === 'DOCUMENT', `Expected inputType DOCUMENT, got ${data.inputType}`);
        assert(data.status === 'QUEUED', `Expected status QUEUED, got ${data.status}`);
        createdRequestIds.push(data.id);

        // Background task should NOT run discovery
        await new Promise((resolve) => setTimeout(resolve, 200));

        const { data: reqRecord } = await supabase
          .from('verification_requests')
          .select('status, evidence(count)')
          .eq('id', data.id)
          .single();

        assert(reqRecord?.status === 'QUEUED', 'Status must stay QUEUED');
        assert((reqRecord?.evidence as any)?.[0]?.count === 0, 'No evidence created during intake');
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
  console.log(`PHASE 3 STEP 2 TEST SUMMARY:`);
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
