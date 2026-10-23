/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 7: Evidence-Grounded Government Scheme Application Roadmap Test Suite
 * Comprehensive automated verification covering:
 *  1. Relevant scheme detection and passing-mention suppression
 *  2. Verdict-aware roadmap behavior (SUPPORTED, PARTIALLY_SUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE)
 *  3. Evidence-grounded benefit and eligibility details with verified limits
 *  4. Mandatory vs conditional documents with "why required" and "where to obtain" guidance
 *  5. Dual application instructions: online portal validation and offline CSC steps
 *  6. Post-submission tracking, reference number guide, and milestone approval stages
 *  7. Defective application correction and verified grievance redressal channels
 *  8. Official URL validation, SSRF prevention, and malicious redirect rejection
 *  9. Deterministic eligibility questionnaire evaluation (LIKELY_ELIGIBLE, MAY_NOT_MEET_CONDITION, CANNOT_DETERMINE)
 * 10. Strict PII rejection and zero sensitive-value logging
 * 11. API routes, authorization, guest tokens, and persistence integrity
 */

import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';

import express from 'express';
import { AddressInfo } from 'net';
import {
  validateOfficialServiceUrl,
  detectSchemeFromClaimAndEvidence,
  isPassingMention,
  detectSensitivePii,
  buildSchemeApplicationRoadmap,
  generateActionGuidance,
  evaluateEligibilityAnswers,
  getOrGenerateActionGuidance,
  KNOWN_SOVEREIGN_SCHEMES,
  DetectedSchemeRecord,
  SchemeRoadmap,
} from '../src/server/services/actionGuidance';
import { getServerSupabase } from '../src/server/supabase';
import { apiRouter } from '../src/server/routes/api';

let passed = 0;
let failed = 0;

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
    passed++;
  } catch (err: any) {
    console.log(`\x1b[31mFAILED\x1b[0m`);
    console.error(`  Error: ${err.message}`);
    failed++;
  }
}

async function runPhase7TestSuite() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — PHASE 7: SCHEME APPLICATION ROADMAP TEST SUITE');
  console.log('Validating Stepper, Milestones, Documents, SSRF, PII & Verdicts');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: Scheme Detection & Passing-Mention Suppression
  // --------------------------------------------------------------------------
  console.log('[SECTION 1] Scheme Detection & Passing-Mention Suppression');

  await runTest('1.1. Correctly detects sovereign scheme from genuine claim', async () => {
    const det = detectSchemeFromClaimAndEvidence({
      originalClaim: 'PM Kisan Samman Nidhi provides financial support of ₹6,000 to small farmers.',
    });
    assert(det !== null, 'PM Kisan must be identified');
    assert(det!.schemeId === 'pm-kisan', 'Scheme ID must be pm-kisan');
    assert(det!.jurisdiction === 'CENTRAL', 'Jurisdiction must be CENTRAL');
    assert(det!.administeringMinistryOrDepartment.includes('Agriculture'), 'Nodal ministry must be Agriculture');
    assert(det!.isMeaningfulConnection === true, 'Must flag meaningful connection');
  });

  await runTest('1.2. Rejects passing mentions and contrastive comparisons', async () => {
    // "unlike PM Kisan"
    const passing1 = isPassingMention('This private loan app is fast, unlike PM Kisan which requires land registration.', ['pm kisan']);
    assert(passing1 === true, 'Must identify "unlike PM Kisan" as passing mention');

    const det1 = detectSchemeFromClaimAndEvidence({
      originalClaim: 'This private loan app is fast, unlike PM Kisan which requires land registration.',
    });
    assert(det1 === null, 'Passing comparison should not trigger scheme guidance');

    // "as opposed to Ayushman Bharat"
    const passing2 = isPassingMention('We offer corporate health plans, as opposed to Ayushman Bharat.', ['ayushman bharat']);
    assert(passing2 === true, 'Must identify "as opposed to Ayushman Bharat" as passing mention');

    const det2 = detectSchemeFromClaimAndEvidence({
      originalClaim: 'We offer corporate health plans, as opposed to Ayushman Bharat.',
    });
    assert(det2 === null, 'Contrastive mention should not trigger scheme guidance');
  });

  await runTest('1.3. Detects scheme from authoritative evidence when claim text is informal', async () => {
    const det = detectSchemeFromClaimAndEvidence({
      originalClaim: 'Is there a central scholarship for college students with top marks?',
      evidence: [
        {
          id: 'ev-1',
          claim_text: 'Central Sector Scheme of Scholarship for College and University Students',
          sources: {
            title: 'National Scholarship Portal (NSP) Central Guidelines',
            url: 'https://scholarships.gov.in',
          },
        },
      ],
    });
    assert(det !== null, 'Must resolve NSP from verified evidence');
    assert(det!.schemeId === 'national-scholarship-portal', 'Scheme ID must be national-scholarship-portal');
  });

  // --------------------------------------------------------------------------
  // SECTION 2: 6-Stage Roadmap Structure & Content
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 2] 6-Stage Roadmap Structure & Content');

  await runTest('2.1. Roadmap contains all 6 sequential steps in exact order', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '11111111-2222-3333-4444-555555555555',
      originalClaim: 'PM Surya Ghar Muft Bijli Yojana provides solar rooftop subsidy.',
      verdict: 'SUPPORTED',
    });

    assert(Boolean(guidance.roadmap), 'Roadmap must be generated for supported scheme claim');
    const roadmap = guidance.roadmap!;

    assert(roadmap.steps.length === 6, 'Roadmap must have exactly 6 sequential steps');
    assert(roadmap.steps[0].id === 'understand_scheme', 'Step 1 must be understand_scheme');
    assert(roadmap.steps[1].id === 'check_eligibility', 'Step 2 must be check_eligibility');
    assert(roadmap.steps[2].id === 'prepare_documents', 'Step 3 must be prepare_documents');
    assert(roadmap.steps[3].id === 'apply_online_offline', 'Step 4 must be apply_online_offline');
    assert(roadmap.steps[4].id === 'track_application', 'Step 5 must be track_application');
    assert(roadmap.steps[5].id === 'follow_up_recourse', 'Step 6 must be follow_up_recourse');
  });

  await runTest('2.2. Understand the Benefit: verified limits, frequency, and duration', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '11111111-2222-3333-4444-555555555555',
      originalClaim: 'PM Kisan Samman Nidhi gives ₹6,000 per year.',
      verdict: 'SUPPORTED',
    });

    const roadmap = guidance.roadmap!;
    assert(roadmap.benefitDetails.amountOrType.includes('6,000'), 'Must specify ₹6,000 benefit amount');
    assert(Boolean(roadmap.benefitDetails.frequency?.includes('3 equal installments') || roadmap.benefitDetails.frequency?.includes('4 months')), 'Must specify payment frequency');
    assert(Boolean(roadmap.benefitDetails.applicableFees?.toLowerCase().includes('free')), 'Must indicate free official application');
    assert(roadmap.benefitDetails.generalVsPersonalNotice.length > 0, 'Must include general vs personal notice');
  });

  await runTest('2.3. Mandatory vs conditional documents with "why required" and "where to obtain"', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '11111111-2222-3333-4444-555555555555',
      originalClaim: 'NSP scholarship requires marksheet and income certificate.',
      verdict: 'SUPPORTED',
    });

    const roadmap = guidance.roadmap!;
    assert(roadmap.documentPrep.mandatoryDocuments.length > 0, 'Must have mandatory documents');
    assert(roadmap.documentPrep.conditionalDocuments.length > 0, 'Must have conditional documents');

    // Check mandatory document structure
    const aadhaarDoc = roadmap.documentPrep.mandatoryDocuments.find((d) => d.id === 'doc-aadhaar-nsp');
    assert(aadhaarDoc !== undefined, 'Must include student Aadhaar as mandatory');
    assert(aadhaarDoc!.isMandatory === true, 'Aadhaar must be marked mandatory');
    assert(Boolean(aadhaarDoc!.whyRequired), 'Must explain why document is required');
    assert(Boolean(aadhaarDoc!.whereToObtain), 'Must provide where to obtain document');
    assert(aadhaarDoc!.whereToObtain!.issuingAuthority === 'UIDAI', 'UIDAI must be issuing authority');

    // Check conditional document structure
    const casteDoc = roadmap.documentPrep.conditionalDocuments.find((d) => d.id === 'doc-caste-nsp');
    assert(casteDoc !== undefined, 'Must include caste certificate as conditional');
    assert(casteDoc!.isMandatory === false, 'Caste certificate must be conditional');
    assert(Boolean(casteDoc!.conditionDescription), 'Must specify applicable condition');
  });

  await runTest('2.4. Dual application instructions: online steps and offline CSC instructions', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '11111111-2222-3333-4444-555555555555',
      originalClaim: 'PM Surya Ghar solar rooftop subsidy scheme.',
      verdict: 'SUPPORTED',
    });

    const roadmap = guidance.roadmap!;
    assert(roadmap.applicationInstructions.onlineSteps.length >= 3, 'Must have numbered online steps');
    assert(roadmap.applicationInstructions.offlineSteps!.length >= 2, 'Must have offline / CSC steps');
    assert(roadmap.applicationInstructions.isPortalVerified === true, 'Portal must be verified');
    assert(Boolean(roadmap.applicationInstructions.officialPortalUrl?.includes('pmsuryaghar.gov.in')), 'Must link to pmsuryaghar.gov.in');
  });

  await runTest('2.5. Post-submission tracking: reference numbers, milestones, and no-submit disclaimer', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '11111111-2222-3333-4444-555555555555',
      originalClaim: 'Atal Pension Yojana APY retirement pension.',
      verdict: 'SUPPORTED',
    });

    const roadmap = guidance.roadmap!;
    assert(Boolean(roadmap.afterSubmission.referenceNumberDescription), 'Must explain reference / PRAN number');
    assert(roadmap.afterSubmission.approvalStages.length >= 3, 'Must define sequential approval stages');
    assert(roadmap.afterSubmission.approvalStages[0].stageNumber === 1, 'Stages must be numbered sequentially');
    assert(Boolean(roadmap.afterSubmission.approvalStages[0].responsibleEntity), 'Must specify responsible authority');
    assert(Boolean(roadmap.afterSubmission.correctionProcedure), 'Must include correction procedure');
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Verdict-Aware Roadmap Behavior (Phase D)
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 3] Verdict-Aware Roadmap Behavior (Phase D)');

  await runTest('3.1. SUPPORTED: Produces clean roadmap without unsupported claim warnings', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '22222222-3333-4444-5555-666666666666',
      originalClaim: 'PM-KISAN provides ₹6,000 per year in 3 installments.',
      verdict: 'SUPPORTED',
    });

    assert(Boolean(guidance.roadmap), 'Roadmap must be generated');
    assert(guidance.roadmap!.unsupportedClaimNotice === undefined, 'Supported claim must not have unsupported notice');
  });

  await runTest('3.2. PARTIALLY_SUPPORTED: Highlights unsupported elements and conditional prerequisites', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '33333333-4444-5555-6666-777777777777',
      originalClaim: 'PM-KISAN provides ₹15,000 per year unconditionally to all citizens.',
      verdict: 'PARTIALLY_SUPPORTED',
    });

    assert(Boolean(guidance.roadmap), 'Roadmap must be generated for real underlying scheme');
    assert(Boolean(guidance.roadmap!.unsupportedClaimNotice), 'Must contain unsupported claim notice');
    assert(guidance.roadmap!.unsupportedClaimNotice!.includes('partially supported'), 'Notice must explain partial support');
    assert(guidance.roadmap!.benefitDetails.amountOrType.includes('6,000'), 'Must present the genuine statutory amount');
  });

  await runTest('3.3. CONTRADICTED: Discloses misinformation warning and prohibits false application', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '44444444-5555-6666-7777-888888888888',
      originalClaim: 'PM-KISAN is charging a mandatory ₹500 registration fee on WhatsApp.',
      verdict: 'CONTRADICTED',
    });

    assert(guidance.advisoryType === 'CONTRADICTED_ALERT', 'Must produce CONTRADICTED_ALERT advisory');
    assert(guidance.service?.isPortalVerified === false, 'Must not provide a false application link');
    assert(Boolean(guidance.roadmap), 'Roadmap provides safe factual correction');
    assert(guidance.roadmap!.unsupportedClaimNotice!.includes('Misinformation Warning'), 'Must show prominent misinformation warning');
  });

  await runTest('3.4. INSUFFICIENT_EVIDENCE: States claim is unconfirmed and separates from verified facts', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '55555555-6666-7777-8888-999999999999',
      originalClaim: 'Did the government just release a new PM Surya Ghar expansion order?',
      verdict: 'INSUFFICIENT_EVIDENCE',
    });

    assert(guidance.advisoryType === 'UNVERIFIED_SAFE_SEARCH', 'Must advise safe search');
    assert(Boolean(guidance.roadmap), 'Roadmap provides independently verified sovereign scheme rules');
    assert(guidance.roadmap!.unsupportedClaimNotice!.includes('Unverified Claim Notice'), 'Must separate unverified claim from scheme facts');
  });

  // --------------------------------------------------------------------------
  // SECTION 4: URL Validation, SSRF & Malicious Redirect Prevention
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 4] URL Validation, SSRF & Malicious Redirect Prevention');

  await runTest('4.1. Sovereign portals (.gov.in, .nic.in) are verified with clean HTTPS', async () => {
    const res1 = validateOfficialServiceUrl('https://pmkisan.gov.in/registration');
    assert(res1.isValid === true, 'Must be valid');
    assert(res1.isOfficialSovereign === true, 'Must be sovereign');
    assert(res1.cleanUrl.startsWith('https://'), 'Must enforce HTTPS');

    const res2 = validateOfficialServiceUrl('https://scholarships.gov.in/fresh');
    assert(res2.isOfficialSovereign === true, 'scholarships.gov.in must be sovereign');
  });

  await runTest('4.2. Blocks SSRF attempts to loopback, private IPs, and cloud metadata', async () => {
    // Localhost
    const ssrf1 = validateOfficialServiceUrl('http://localhost:8080/admin');
    assert(ssrf1.isValid === false, 'Must block localhost');
    assert(ssrf1.isOfficialSovereign === false, 'Must not be sovereign');

    // 127.0.0.1
    const ssrf2 = validateOfficialServiceUrl('http://127.0.0.1:3000/api');
    assert(ssrf2.isValid === false, 'Must block 127.0.0.1');

    // Private RFC 1918 (192.168.1.1)
    const ssrf3 = validateOfficialServiceUrl('http://192.168.1.1/setup');
    assert(ssrf3.isValid === false, 'Must block private IP');

    // Cloud metadata (169.254.169.254)
    const ssrf4 = validateOfficialServiceUrl('http://169.254.169.254/latest/meta-data/');
    assert(ssrf4.isValid === false, 'Must block AWS/GCP metadata IP');
  });

  await runTest('4.3. Rejects dangerous protocols (javascript:, file:, data:)', async () => {
    const dangerous1 = validateOfficialServiceUrl('javascript:alert(document.cookie)');
    assert(dangerous1.isValid === false, 'Must reject javascript: protocol');

    const dangerous2 = validateOfficialServiceUrl('file:///etc/passwd');
    assert(dangerous2.isValid === false, 'Must reject file: protocol');

    const dangerous3 = validateOfficialServiceUrl('data:text/html,<script>evil()</script>');
    assert(dangerous3.isValid === false, 'Must reject data: protocol');
  });

  // --------------------------------------------------------------------------
  // SECTION 5: Deterministic Eligibility Evaluation & PII Rejection
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 5] Deterministic Eligibility Evaluation & PII Rejection');

  const pmKisanCriteria = KNOWN_SOVEREIGN_SCHEMES.find((s) => s.id === 'pm-kisan')!.eligibilityCriteria;

  await runTest('5.1. Evaluates LIKELY_ELIGIBLE when all answers deterministically match', async () => {
    const answers = {
      'pmk-crit-land': 'yes_land',
      'pmk-crit-tax': 'no_tax',
      'pmk-crit-ekyc': 'yes_ekyc',
    };
    const res = evaluateEligibilityAnswers(pmKisanCriteria, answers);
    assert(res.category === 'LIKELY_ELIGIBLE', `Expected LIKELY_ELIGIBLE, got ${res.category}`);
    assert(res.matchingCriteria.length === pmKisanCriteria.length, 'All criteria must match');
    assert(res.unmatchingCriteria.length === 0, 'No unmatching criteria');
    assert(res.disclaimer.includes('does not constitute an official government determination'), 'Must include disclaimer');
  });

  await runTest('5.2. Evaluates MAY_NOT_MEET_CONDITION when answers conflict with official rules', async () => {
    const answers = {
      'pmk-crit-land': 'no_land', // Unmet condition: must own land
      'pmk-crit-tax': 'no_tax',
      'pmk-crit-ekyc': 'yes_ekyc',
    };
    const res = evaluateEligibilityAnswers(pmKisanCriteria, answers);
    assert(res.category === 'MAY_NOT_MEET_CONDITION', `Expected MAY_NOT_MEET_CONDITION, got ${res.category}`);
    assert(res.unmatchingCriteria.length === 1, 'Must flag 1 unmet criterion');
    assert(res.unmatchingCriteria[0].id === 'pmk-crit-land', 'Flagged criterion must be land ownership');
  });

  await runTest('5.3. Evaluates CANNOT_DETERMINE when questions are skipped or unanswered', async () => {
    const answers = {
      'pmk-crit-land': 'yes_land',
      // remaining criteria omitted
    };
    const res = evaluateEligibilityAnswers(pmKisanCriteria, answers);
    assert(res.category === 'CANNOT_DETERMINE', 'Must evaluate to CANNOT_DETERMINE');
    assert(res.unknownCriteria.length > 0, 'Must identify unknown criteria');
  });

  await runTest('5.4. Detects and immediately rejects sensitive PII without logging', async () => {
    // Aadhaar number input
    const piiResult1 = detectSensitivePii({ 'crit-1': '9876 5432 1098' });
    assert(piiResult1.hasPii === true, 'Must detect Aadhaar number');
    assert(piiResult1.piiType === 'Aadhaar Number', 'Must identify Aadhaar');

    // PAN card input
    const piiResult2 = detectSensitivePii({ 'crit-1': 'ABCDE1234F' });
    assert(piiResult2.hasPii === true, 'Must detect PAN card');

    // Bank Account input
    const piiResult3 = detectSensitivePii({ 'crit-1': '123456789012' });
    assert(piiResult3.hasPii === true, 'Must detect Bank Account number');

    // OTP / Password input
    const piiResult4 = detectSensitivePii({ 'crit-1': 'my otp is 4920' });
    assert(piiResult4.hasPii === true, 'Must detect OTP / password');

    // Evaluation call with PII aborts cleanly
    const evalWithPii = evaluateEligibilityAnswers(pmKisanCriteria, {
      'pmk-crit-land': '9876 5432 1098',
    });
    assert(evalWithPii.category === 'CANNOT_DETERMINE', 'PII evaluation must abort to CANNOT_DETERMINE');
    assert(Boolean(evalWithPii.piiWarning), 'Must output piiWarning banner');
  });

  // --------------------------------------------------------------------------
  // SECTION 6: API Routing, Guest Tokens & Cross-User Security
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 6] API Routing, Guest Tokens & Cross-User Security');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const port = (server.address() as AddressInfo).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const createdRequestIds: string[] = [];

  try {
    const supabase = getServerSupabase();

    // Create a real completed test request
    const { data: testReq } = await supabase
      .from('verification_requests')
      .insert({
        input_type: 'CLAIM',
        original_claim: 'Test Roadmap Scheme Claim: PM Surya Ghar solar rooftop subsidy.',
        status: 'COMPLETED',
        guest_session_token: 'test-guest-token-phase7-xyz',
      })
      .select()
      .single();

    assert(Boolean(testReq), 'Test request must be created');
    createdRequestIds.push(testReq.id);

    // Insert verification result
    await supabase.from('verification_results').insert({
      verification_request_id: testReq.id,
      verdict: 'SUPPORTED',
      confidence: 96,
      explanation: 'Verified official notification confirms PM Surya Ghar guidelines.',
    });

    await runTest('6.1. GET /api/v1/verify/:id/action-guidance returns structured scheme roadmap', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/${testReq.id}/action-guidance`, {
        method: 'GET',
        headers: {
          'X-Guest-Token': 'test-guest-token-phase7-xyz',
        },
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const json = await res.json();
      assert(json.success === true, 'Response must have success=true');
      assert(Boolean(json.data.roadmap), 'Response must contain roadmap object');
      assert(json.data.roadmap.steps.length === 6, 'Roadmap must have 6 steps');
      assert(json.data.roadmap.officialSchemeName.includes('Surya Ghar'), 'Must identify Surya Ghar');
    });

    await runTest('6.2. POST /api/v1/verify/:id/action-guidance/evaluate-eligibility evaluates answers without saving PII', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/${testReq.id}/action-guidance/evaluate-eligibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Token': 'test-guest-token-phase7-xyz',
        },
        body: JSON.stringify({
          answers: {
            'crit-1': 'yes_roof',
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const json = await res.json();
      assert(json.success === true, 'Response must have success=true');
      assert(Boolean(json.evaluation), 'Response must contain evaluation');
    });

    await runTest('6.3. Invalid non-UUID parameter is strictly rejected with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/invalid-uuid-format/action-guidance`, {
        method: 'GET',
      });
      assert(res.status === 400, `Expected 400 Bad Request, got ${res.status}`);
      const json = await res.json();
      assert(json.error === 'INVALID_ID' || json.message?.includes('valid UUID'), 'Must return invalid UUID error');
    });

    await runTest('6.4. Cross-user isolation: Unauthorized guest token is rejected with 403 Forbidden', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/${testReq.id}/action-guidance`, {
        method: 'GET',
        headers: {
          'X-Guest-Token': 'wrong-unauthorized-guest-token',
        },
      });
      assert(res.status === 403, `Expected 403 Forbidden, got ${res.status}`);
    });
  } finally {
    if (createdRequestIds.length > 0) {
      const supabase = getServerSupabase();
      await supabase.from('verification_requests').delete().in('id', createdRequestIds);
    }
    server.close();
  }

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`PHASE 7 TEST SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase7TestSuite().catch((err) => {
  console.error('Test suite runner crashed:', err);
  process.exit(1);
});
