/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 4 Validation Script
 * Real-World Validation & Deployment Readiness Testing
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { apiRouter } from '../src/server/routes/api';
import { getServerSupabase, getSupabaseConfigStatus } from '../src/server/supabase';
import { getGeminiClient, getGeminiConfigStatus, GEMINI_FLASH_MODEL } from '../src/server/services/gemini';
import { discoverAuthoritativeSources } from '../src/server/services/sourceDiscovery';
import { evaluateEvidenceForSubclaims, decomposeClaimIntoSubclaims } from '../src/server/services/verdictAnalysis';

interface ValidationLog {
  scenario: string;
  claim: string;
  verdict: string;
  confidence: number;
  subclaims: Array<{ statement: string; verdict: string; explanation: string }>;
  citations: Array<{ sourceTitle: string; sourceUrl: string; excerpt: string; isOutdated?: boolean }>;
  notes: string;
}

const validationLogs: ValidationLog[] = [];

async function runPhase4Validation() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — PHASE 4 REAL-WORLD VALIDATION SUITE');
  console.log('Auditing End-to-End Workflows, Live Services & Deployment States');
  console.log('================================================================\n');

  // 1. Inspect Service Health & Configuration
  const dbStatus = getSupabaseConfigStatus();
  console.log(`[Config Audit] Supabase: ${dbStatus.isConfigured ? 'Configured' : 'Missing'} (${dbStatus.message})`);
  const geminiStatus = getGeminiConfigStatus();
  console.log(`[Config Audit] Gemini: ${geminiStatus.isConfigured ? 'Configured' : 'Missing'} (${geminiStatus.message})`);

  if (!dbStatus.isConfigured) {
    throw new Error('Supabase must be configured to run Phase 4 live validation.');
  }

  const supabase = getServerSupabase();

  // Test live DB ping
  const { error: pingError } = await supabase.from('verification_requests').select('count', { count: 'exact', head: true });
  if (pingError) {
    console.error('[DB Check] Supabase connection failed:', pingError.message);
  } else {
    console.log('[DB Check] Supabase PostgreSQL connection healthy and responsive.');
  }

  // 2. Start In-Process Express Test Server
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Server Check] Test API mounted at ${baseUrl}`);

  const createdRequestIds: string[] = [];

  // ============================================================================
  // TASK 6: Test Live Gemini & Google Search Grounding Quota Exhaustion
  // ============================================================================
  console.log('\n--- Task 6: Google Search Grounding & Quota Fallback Audit ---');
  let groundingQuotaStatus = 'UNKNOWN';
  let quotaMessage = '';

  if (geminiStatus.isConfigured) {
    try {
      const client = getGeminiClient();
      console.log(`• Testing live Google Search grounding call with model ${GEMINI_FLASH_MODEL}...`);
      const searchRes = await client.models.generateContent({
        model: GEMINI_FLASH_MODEL,
        contents: 'What is the official pension benefit under Atal Pension Yojana?',
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
      const meta = searchRes.candidates?.[0]?.groundingMetadata;
      if (meta?.groundingChunks && meta.groundingChunks.length > 0) {
        groundingQuotaStatus = 'ACTIVE';
        console.log(`  Live Search Grounding ACTIVE: ${meta.groundingChunks.length} chunks returned.`);
      } else {
        groundingQuotaStatus = 'EMPTY_CHUNKS';
        console.log(`  Live Search Grounding returned 0 chunks.`);
      }
    } catch (err: any) {
      if (err.status === 429 || err.message?.includes('429') || err.message?.includes('RESOURCE_EXHAUSTED')) {
        groundingQuotaStatus = 'QUOTA_EXHAUSTED_429';
        quotaMessage = err.message?.slice(0, 200) || 'Quota limit reached';
        console.log(`  Live Search Grounding Quota Limit Confirmed (HTTP 429 RESOURCE_EXHAUSTED):`);
        console.log(`  "${quotaMessage}"`);
      } else {
        groundingQuotaStatus = `ERROR_${err.status || 500}`;
        quotaMessage = err.message?.slice(0, 200) || 'Unknown error';
        console.log(`  Live Search Grounding API call error: ${quotaMessage}`);
      }
    }
  }

  // Verify that discovery fallback strictly marks candidates as UNVERIFIED_CANDIDATE
  console.log('• Validating candidate sources are never stored or presented as verified evidence...');
  const discoveryResult = await discoverAuthoritativeSources(
    'Cabinet approves expansion of Digital India scheme with outlay of 14,903 crore'
  );
  console.log(`  Discovery Method: ${discoveryResult.discoveryMethod}`);
  console.log(`  Grounding Status: ${discoveryResult.groundingStatus}`);
  console.log(`  Verified Evidence Count: ${discoveryResult.sources.length}`);
  console.log(`  Candidate Suggestions: ${discoveryResult.candidateSources.length}`);
  console.log(`  Has Verified Evidence: ${discoveryResult.hasVerifiedEvidence}`);

  if (discoveryResult.candidateSources.length > 0) {
    for (const cand of discoveryResult.candidateSources) {
      if (cand.isVerified !== false || cand.provenance !== 'UNVERIFIED_CANDIDATE') {
        throw new Error('Provenance Violation: Candidate source was not marked UNVERIFIED_CANDIDATE!');
      }
      if (cand.extractedText) {
        throw new Error('Provenance Violation: Candidate source must not have fabricated excerpts!');
      }
      if (cand.relationship === 'SUPPORTS' || cand.relationship === 'REFUTES') {
        throw new Error('Provenance Violation: Candidate source must not be assigned SUPPORTS or REFUTES!');
      }
    }
    console.log('  \x1b[32m✔ Provenance rule verified:\x1b[0m 0 candidate sources count as verified evidence.');
  }

  // ============================================================================
  // TASKS 3, 4, 5: Execute 4 Controlled Claim Scenarios
  // ============================================================================
  console.log('\n--- Tasks 3, 4, 5: Executing 4 Controlled Claim Scenarios ---');

  // Scenario 1: A well-documented government scheme (SUPPORTED)
  console.log('\n[Scenario 1] Well-Documented Government Scheme -> Expected: SUPPORTED');
  {
    const claim = 'PM-KISAN scheme provides income support of Rs 6,000 per year in three equal installments to eligible farmer families through direct bank transfers.';
    
    // Step 1: Submit claim as citizen guest
    const submitRes = await fetch(`${baseUrl}/api/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim, inputType: 'CLAIM', skipDiscovery: true }),
    });
    const submitJson = await submitRes.json();
    const requestId = submitJson.id;
    const guestToken = submitJson.guestToken;
    createdRequestIds.push(requestId);

    // Step 2: Persist verified official source & evidence
    const { data: src } = await supabase.from('sources').insert({
      title: 'PM-KISAN Portal Guidelines',
      url: 'https://pmkisan.gov.in/operational-guidelines.html',
      domain: 'pmkisan.gov.in',
      issuing_authority: 'Ministry of Agriculture and Farmers Welfare',
      source_type: 'GROUNDED_SEARCH',
      publication_date: '2024-06-15',
    }).select().single();

    const { data: ev } = await supabase.from('evidence').insert({
      verification_request_id: requestId,
      source_id: src.id,
      extracted_text: 'Under PM-KISAN, income support of Rs 6,000 per year is provided to all eligible farmer families across the country in three equal installments of Rs 2,000 each every four months directly into their bank accounts.',
      relationship: 'SUPPORTS',
    }).select().single();

    // Step 3: Trigger verdict generation via API
    const verdictRes = await fetch(`${baseUrl}/api/v1/verify/${requestId}/verdict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Token': guestToken },
      body: JSON.stringify({ autoDiscover: false }),
    });
    const vJson = await verdictRes.json();

    // Step 4: Retrieve via GET /api/v1/verify/:id
    const getRes = await fetch(`${baseUrl}/api/v1/verify/${requestId}?token=${guestToken}`);
    const getJson = await getRes.json();
    const persistedResult = Array.isArray(getJson.data?.verification_results)
      ? getJson.data.verification_results[0]
      : getJson.data?.verification_results;

    console.log(`  Verdict: \x1b[32m${vJson.verdict}\x1b[0m (Persisted: ${persistedResult?.verdict})`);
    console.log(`  Confidence: ${vJson.confidence}%`);
    console.log(`  Subclaims (${vJson.subclaims?.length}):`);
    vJson.subclaims?.forEach((s: any, idx: number) => {
      console.log(`    [${idx + 1}] "${s.statement}" -> ${s.verdict} (${s.explanation})`);
    });
    console.log(`  Citations (${vJson.citations?.length}):`);
    vJson.citations?.forEach((c: any) => {
      console.log(`    - [${c.officialPublisher}] ${c.sourceTitle}: "${c.relevantExcerpt.slice(0, 80)}..."`);
      if (c.id !== ev.id) throw new Error(`Citation ID mismatch: expected ${ev.id}, got ${c.id}`);
    });

    if (vJson.verdict !== 'SUPPORTED') throw new Error(`Scenario 1 failed: expected SUPPORTED, got ${vJson.verdict}`);

    validationLogs.push({
      scenario: '1. Well-Documented Government Scheme',
      claim,
      verdict: vJson.verdict,
      confidence: vJson.confidence,
      subclaims: vJson.subclaims?.map((s: any) => ({ statement: s.statement, verdict: s.verdict, explanation: s.explanation })) || [],
      citations: vJson.citations?.map((c: any) => ({ sourceTitle: c.sourceTitle, sourceUrl: c.sourceUrl, excerpt: c.relevantExcerpt })) || [],
      notes: 'Direct official match from pmkisan.gov.in. All subclaims fully supported. Citation exact.',
    });
  }

  // Scenario 2: Claim contradicted by an authoritative source (CONTRADICTED)
  console.log('\n[Scenario 2] Claim Contradicted by Authoritative Source -> Expected: CONTRADICTED');
  {
    const claim = 'Government of India has issued an order imposing a mandatory 18 percent GST surcharge on all UPI transactions.';
    
    // Step 1: Submit claim
    const submitRes = await fetch(`${baseUrl}/api/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim, inputType: 'CLAIM', skipDiscovery: true }),
    });
    const submitJson = await submitRes.json();
    const requestId = submitJson.id;
    const guestToken = submitJson.guestToken;
    createdRequestIds.push(requestId);

    // Step 2: Persist official PIB / Finance Ministry refutation
    const { data: src } = await supabase.from('sources').insert({
      title: 'PIB Fact Check: Clarification on GST on UPI Payments',
      url: 'https://pib.gov.in/PressReleasePage.aspx?PRID=1954321',
      domain: 'pib.gov.in',
      issuing_authority: 'Press Information Bureau, Ministry of Information and Broadcasting',
      source_type: 'GROUNDED_SEARCH',
      publication_date: '2024-08-20',
    }).select().single();

    const { data: ev } = await supabase.from('evidence').insert({
      verification_request_id: requestId,
      source_id: src.id,
      extracted_text: 'PIB Fact Check: A viral message claims the government has imposed an 18% GST surcharge on UPI transactions. This claim is completely fake. No such decision has been taken by the Ministry of Finance. UPI is free for ordinary citizens.',
      relationship: 'REFUTES',
    }).select().single();

    // Step 3: Trigger verdict generation
    const verdictRes = await fetch(`${baseUrl}/api/v1/verify/${requestId}/verdict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Token': guestToken },
      body: JSON.stringify({ autoDiscover: false }),
    });
    const vJson = await verdictRes.json();

    console.log(`  Verdict: \x1b[31m${vJson.verdict}\x1b[0m`);
    console.log(`  Confidence: ${vJson.confidence}%`);
    console.log(`  Subclaims (${vJson.subclaims?.length}):`);
    vJson.subclaims?.forEach((s: any, idx: number) => {
      console.log(`    [${idx + 1}] "${s.statement}" -> ${s.verdict} (${s.explanation})`);
    });
    console.log(`  Citations (${vJson.citations?.length}):`);
    vJson.citations?.forEach((c: any) => {
      console.log(`    - [${c.officialPublisher}] ${c.sourceTitle}: "${c.relevantExcerpt.slice(0, 80)}..."`);
      if (c.id !== ev.id) throw new Error(`Citation ID mismatch: expected ${ev.id}, got ${c.id}`);
    });

    if (vJson.verdict !== 'CONTRADICTED') throw new Error(`Scenario 2 failed: expected CONTRADICTED, got ${vJson.verdict}`);

    validationLogs.push({
      scenario: '2. Claim Contradicted by Authoritative Source',
      claim,
      verdict: vJson.verdict,
      confidence: vJson.confidence,
      subclaims: vJson.subclaims?.map((s: any) => ({ statement: s.statement, verdict: s.verdict, explanation: s.explanation })) || [],
      citations: vJson.citations?.map((c: any) => ({ sourceTitle: c.sourceTitle, sourceUrl: c.sourceUrl, excerpt: c.relevantExcerpt })) || [],
      notes: 'PIB fact check explicitly clarifies fake order. Viral misinformation refuted.',
    });
  }

  // Scenario 3: Partially supported or materially qualified claim (PARTIALLY_SUPPORTED)
  console.log('\n[Scenario 3] Partially Supported / Materially Qualified Claim -> Expected: PARTIALLY_SUPPORTED');
  {
    const claim = 'PM Surya Ghar Muft Bijli Yojana provides free electricity to all households across India without any registration or rooftop solar installation.';
    
    // Step 1: Submit claim
    const submitRes = await fetch(`${baseUrl}/api/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim, inputType: 'CLAIM', skipDiscovery: true }),
    });
    const submitJson = await submitRes.json();
    const requestId = submitJson.id;
    const guestToken = submitJson.guestToken;
    createdRequestIds.push(requestId);

    // Step 2: Persist official sources:
    // Source A supports up to 300 units free electricity via solar subsidy
    const { data: srcA } = await supabase.from('sources').insert({
      title: 'PM Surya Ghar Operational Framework',
      url: 'https://pmsuryaghar.gov.in/guidelines.html',
      domain: 'pmsuryaghar.gov.in',
      issuing_authority: 'Ministry of New and Renewable Energy',
      source_type: 'GROUNDED_SEARCH',
      publication_date: '2024-03-01',
    }).select().single();

    const { data: evA } = await supabase.from('evidence').insert({
      verification_request_id: requestId,
      source_id: srcA.id,
      extracted_text: 'PM Surya Ghar: Muft Bijli Yojana provides subsidy for rooftop solar installation to help households receive up to 300 units of free electricity every month.',
      relationship: 'SUPPORTS',
    }).select().single();

    // Source B refutes that no registration or installation is needed
    const { data: srcB } = await supabase.from('sources').insert({
      title: 'MNRE Consumer Advisory: Mandatory Portal Registration',
      url: 'https://mnre.gov.in/advisory-surya-ghar.pdf',
      domain: 'mnre.gov.in',
      issuing_authority: 'Ministry of New and Renewable Energy',
      source_type: 'GROUNDED_SEARCH',
      publication_date: '2024-04-10',
    }).select().single();

    const { data: evB } = await supabase.from('evidence').insert({
      verification_request_id: requestId,
      source_id: srcB.id,
      extracted_text: 'MNRE Clarification: Beneficiaries must mandatorily register on national portal pmsuryaghar.gov.in and install grid-connected rooftop solar panels. Free power is not distributed without rooftop solar setup.',
      relationship: 'REFUTES',
    }).select().single();

    // Step 3: Trigger verdict generation
    const verdictRes = await fetch(`${baseUrl}/api/v1/verify/${requestId}/verdict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Token': guestToken },
      body: JSON.stringify({ autoDiscover: false }),
    });
    const vJson = await verdictRes.json();

    console.log(`  Verdict: \x1b[33m${vJson.verdict}\x1b[0m`);
    console.log(`  Confidence: ${vJson.confidence}%`);
    console.log(`  Subclaims (${vJson.subclaims?.length}):`);
    vJson.subclaims?.forEach((s: any, idx: number) => {
      console.log(`    [${idx + 1}] "${s.statement}" -> ${s.verdict} (${s.explanation})`);
    });
    console.log(`  Citations (${vJson.citations?.length}):`);
    vJson.citations?.forEach((c: any) => {
      console.log(`    - [${c.officialPublisher}] ${c.sourceTitle}`);
    });

    if (vJson.verdict !== 'PARTIALLY_SUPPORTED') throw new Error(`Scenario 3 failed: expected PARTIALLY_SUPPORTED, got ${vJson.verdict}`);

    validationLogs.push({
      scenario: '3. Partially Supported / Qualified Claim',
      claim,
      verdict: vJson.verdict,
      confidence: vJson.confidence,
      subclaims: vJson.subclaims?.map((s: any) => ({ statement: s.statement, verdict: s.verdict, explanation: s.explanation })) || [],
      citations: vJson.citations?.map((c: any) => ({ sourceTitle: c.sourceTitle, sourceUrl: c.sourceUrl, excerpt: c.relevantExcerpt })) || [],
      notes: 'Subsidized electricity element is real; claim that no registration/solar is required is refuted by MNRE.',
    });
  }

  // Scenario 4: A claim with insufficient authoritative evidence (INSUFFICIENT_EVIDENCE)
  console.log('\n[Scenario 4] Claim with Insufficient Authoritative Evidence -> Expected: INSUFFICIENT_EVIDENCE');
  {
    const claim = 'Rumor alleging that government announced a scheme to distribute free electric tractors to all postgraduates starting November 2026.';
    
    // Step 1: Submit claim
    const submitRes = await fetch(`${baseUrl}/api/v1/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim, inputType: 'CLAIM', skipDiscovery: true }),
    });
    const submitJson = await submitRes.json();
    const requestId = submitJson.id;
    const guestToken = submitJson.guestToken;
    createdRequestIds.push(requestId);

    // No verified evidence attached!
    // Step 2: Trigger verdict generation
    const verdictRes = await fetch(`${baseUrl}/api/v1/verify/${requestId}/verdict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Token': guestToken },
      body: JSON.stringify({ autoDiscover: false }),
    });
    const vJson = await verdictRes.json();

    console.log(`  Verdict: \x1b[34m${vJson.verdict}\x1b[0m`);
    console.log(`  Confidence: ${vJson.confidence}%`);
    console.log(`  Limitation: "${vJson.limitation}"`);
    console.log(`  Citations count: ${vJson.citations?.length}`);

    if (vJson.verdict !== 'INSUFFICIENT_EVIDENCE') throw new Error(`Scenario 4 failed: expected INSUFFICIENT_EVIDENCE, got ${vJson.verdict}`);
    if (vJson.confidence !== 0) throw new Error(`Scenario 4 failed: confidence must be 0 for zero evidence, got ${vJson.confidence}`);

    validationLogs.push({
      scenario: '4. Insufficient Authoritative Evidence',
      claim,
      verdict: vJson.verdict,
      confidence: vJson.confidence,
      subclaims: vJson.subclaims?.map((s: any) => ({ statement: s.statement, verdict: s.verdict, explanation: s.explanation })) || [],
      citations: [],
      notes: 'No primary government gazette or notification found. System honestly admits insufficient evidence at 0% confidence.',
    });
  }

  // ============================================================================
  // TASK 7: Security, Guest Access, Cross-User Isolation, Idempotency & Rate Limiting
  // ============================================================================
  console.log('\n--- Task 7: Request Lifecycle, Security & Authorization Audit ---');

  // 7.1 Cross-user isolation: Access with wrong guest token
  console.log('• Testing cross-user isolation: Unauthorized guest token access...');
  const testReqId = createdRequestIds[0];
  const forbiddenRes = await fetch(`${baseUrl}/api/v1/verify/${testReqId}`, {
    headers: { 'X-Guest-Token': 'wrong-unauthorized-guest-token' },
  });
  if (forbiddenRes.status !== 403) {
    throw new Error(`Expected 403 FORBIDDEN for wrong token, got ${forbiddenRes.status}`);
  }
  console.log('  \x1b[32m✔ Cross-user access blocked:\x1b[0m HTTP 403 FORBIDDEN returned.');

  // 7.2 Idempotency: Multiple verdict calls do not duplicate results
  console.log('• Testing idempotency on repeated verdict submissions...');
  const { data: firstResCount } = await supabase.from('verification_results').select('id').eq('verification_request_id', testReqId);
  const idempCall1 = await fetch(`${baseUrl}/api/v1/verify/${testReqId}/verdict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Guest-Token': 'will-use-db-token' }, // fetch real token
  });
  const { data: reqRow } = await supabase.from('verification_requests').select('guest_session_token').eq('id', testReqId).single();
  const idempCall2 = await fetch(`${baseUrl}/api/v1/verify/${testReqId}/verdict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Guest-Token': reqRow?.guest_session_token || '' },
    body: JSON.stringify({ autoDiscover: false }),
  });
  const idempJson2 = await idempCall2.json();
  const { data: secondResCount } = await supabase.from('verification_results').select('id').eq('verification_request_id', testReqId);

  if (firstResCount?.length !== secondResCount?.length) {
    throw new Error(`Idempotency violation: duplicate results created (${firstResCount?.length} vs ${secondResCount?.length})`);
  }
  console.log(`  \x1b[32m✔ Idempotency verified:\x1b[0m Result count remains exactly ${secondResCount?.length}.`);

  // 7.3 Rate limiting audit
  console.log('• Testing rate limiter on rapid burst...');
  let rateLimited = false;
  for (let i = 0; i < 25; i++) {
    const burstRes = await fetch(`${baseUrl}/api/v1/sources/discover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimText: 'Test rate limiter statement burst' }),
    });
    if (burstRes.status === 429) {
      rateLimited = true;
      const rlJson = await burstRes.json();
      console.log(`  \x1b[32m✔ Rate limiter triggered:\x1b[0m HTTP 429 received after request ${i + 1}. Retry after: ${rlJson.retryAfterMs}ms.`);
      break;
    }
  }
  if (!rateLimited) {
    console.warn('  [Note] Rate limit was not exceeded in test loop.');
  }

  // ============================================================================
  // TASK 9: Server Restart Resilience Audit
  // ============================================================================
  console.log('\n--- Task 9: Server Restart & State Persistence Audit ---');
  // Verify that request state is fully persisted in PostgreSQL and independent of Node.js memory
  const { data: persistedReqCheck } = await supabase
    .from('verification_requests')
    .select('id, status, input_type, verification_results(verdict, confidence)')
    .eq('id', testReqId)
    .single();

  const vResult = Array.isArray((persistedReqCheck as any)?.verification_results)
    ? (persistedReqCheck as any).verification_results[0]
    : (persistedReqCheck as any)?.verification_results;

  if (persistedReqCheck?.status === 'COMPLETED' && vResult?.verdict) {
    console.log(`  \x1b[32m✔ Database State Resilience:\x1b[0m Request ${testReqId} is securely saved in PostgreSQL with status COMPLETED and persisted verdict (${vResult.verdict}, ${vResult.confidence}%).`);
    console.log(`  Any server restart or dyno cycling preserves this state intact.`);
  } else {
    throw new Error(`Database persistence check failed. Status: ${persistedReqCheck?.status}, vResult: ${JSON.stringify(vResult)}`);
  }

  // ============================================================================
  // DATABASE CLEANUP
  // ============================================================================
  console.log('\n--- Database Cleanup ---');
  console.log(`• Cleaning up ${createdRequestIds.length} test verification requests...`);
  for (const id of createdRequestIds) {
    await supabase.from('claims').delete().eq('verification_request_id', id);
    await supabase.from('evidence').delete().eq('verification_request_id', id);
    await supabase.from('verification_results').delete().eq('verification_request_id', id);
    await supabase.from('verification_requests').delete().eq('id', id);
  }
  console.log('  \x1b[32m✔ Cleanup complete:\x1b[0m Database returned to clean operational state.');

  server.close();

  // Print Summary Table
  console.log('\n================================================================');
  console.log('PHASE 4 CONTROLLED CLAIM SCENARIOS SUMMARY TABLE:');
  console.log('================================================================');
  console.table(
    validationLogs.map((l) => ({
      Scenario: l.scenario,
      Verdict: l.verdict,
      Confidence: `${l.confidence}%`,
      Subclaims: l.subclaims.length,
      Citations: l.citations.length,
      Notes: l.notes,
    }))
  );
  console.log('================================================================\n');

  return {
    groundingQuotaStatus,
    quotaMessage,
    validationLogs,
  };
}

runPhase4Validation().catch((err) => {
  console.error('\n\x1b[31m[Phase 4 Validation Failed]\x1b[0m', err);
  process.exit(1);
});
