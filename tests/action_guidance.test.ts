/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — "Verify & Take Action" Test Suite
 * Validates:
 * 1. SSRF prevention and safe URL validation
 * 2. Private IP and dangerous protocol rejection
 * 3. Sovereign domain verification
 * 4. Action guidance generation for SUPPORTED claims (PM-KISAN)
 * 5. Action guidance for PARTIALLY_SUPPORTED claims with conditions (PM Surya Ghar)
 * 6. Action guidance for CONTRADICTED claims (Scam alerts, zero false application guidance)
 * 7. Action guidance for INSUFFICIENT_EVIDENCE claims (Honest inconclusive state & safe directories)
 * 8. Missing official portal handling ("Official application link not verified")
 * 9. Non-invasive eligibility questionnaire evaluation logic
 * 10. Checklist task structure and required documents provenance
 * 11. Security & authorization on GET /api/v1/verify/:id/action-guidance
 * 12. Cross-user isolation and guest token enforcement
 */

import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import {
  validateOfficialServiceUrl,
  checkOfficialDestinationReachability,
  generateActionGuidance,
  evaluateEligibilityAnswers,
  getOrGenerateActionGuidance,
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

async function runActionGuidanceTestSuite() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — "VERIFY & TAKE ACTION" TEST SUITE');
  console.log('Validating SSRF Protection, Service Discovery, Questionnaire & Auth');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: SSRF Protection & URL Validation
  // --------------------------------------------------------------------------
  console.log('[SECTION 1] SSRF Protection & Safe URL Validation');

  await runTest('1.1. Valid sovereign government URLs (.gov.in, .nic.in) are verified', async () => {
    const res1 = validateOfficialServiceUrl('https://pmkisan.gov.in/registration');
    assert(res1.isValid === true, 'pmkisan.gov.in must be valid');
    assert(res1.isOfficialSovereign === true, 'pmkisan.gov.in must be sovereign');
    assert(res1.validationStatus === 'VERIFIED_OFFICIAL', 'Must have VERIFIED_OFFICIAL status');

    const res2 = validateOfficialServiceUrl('https://pmsuryaghar.gov.in');
    assert(res2.isOfficialSovereign === true, 'pmsuryaghar.gov.in must be sovereign');
  });

  await runTest('1.2. Loopback and private IP addresses are blocked (SSRF Protection)', async () => {
    const localhostRes = validateOfficialServiceUrl('http://localhost:3000/internal-admin');
    assert(localhostRes.validationStatus === 'UNVERIFIED_OR_UNSAFE', 'localhost must be blocked');

    const ip127 = validateOfficialServiceUrl('http://127.0.0.1:8080');
    assert(ip127.validationStatus === 'UNVERIFIED_OR_UNSAFE', '127.0.0.1 must be blocked');

    const ip10 = validateOfficialServiceUrl('http://10.0.0.1/admin');
    assert(ip10.validationStatus === 'UNVERIFIED_OR_UNSAFE', '10.x private range must be blocked');

    const ip192 = validateOfficialServiceUrl('http://192.168.1.1/router');
    assert(ip192.validationStatus === 'UNVERIFIED_OR_UNSAFE', '192.168.x private range must be blocked');

    const ip172 = validateOfficialServiceUrl('http://172.16.0.5/api');
    assert(ip172.validationStatus === 'UNVERIFIED_OR_UNSAFE', '172.16-31.x private range must be blocked');
  });

  await runTest('1.3. Unsafe protocols (javascript:, file:, data:) are rejected', async () => {
    const jsUrl = validateOfficialServiceUrl('javascript:alert(1)');
    assert(jsUrl.isValid === false, 'javascript: scheme must be invalid');

    const fileUrl = validateOfficialServiceUrl('file:///etc/passwd');
    assert(fileUrl.isValid === false, 'file: scheme must be invalid');

    const dataUrl = validateOfficialServiceUrl('data:text/html,<script>alert(1)</script>');
    assert(dataUrl.isValid === false, 'data: scheme must be invalid');
  });

  await runTest('1.4. Commercial or non-sovereign domains are marked INFORMATIONAL_ONLY', async () => {
    const commercialRes = validateOfficialServiceUrl('https://sarkariyojana.com/pmkisan');
    assert(commercialRes.isValid === true, 'Can be parsed as valid URL');
    assert(commercialRes.isOfficialSovereign === false, 'Commercial domain is not sovereign');
    assert(commercialRes.validationStatus === 'INFORMATIONAL_ONLY', 'Must be marked INFORMATIONAL_ONLY');
  });

  await runTest('1.5. Malformed or empty URLs return clean fallback', async () => {
    const emptyRes = validateOfficialServiceUrl('');
    assert(emptyRes.validationNote === 'Official application link not verified.', 'Must return unverified note');

    const malformedRes = validateOfficialServiceUrl('not-a-valid-url-format');
    assert(malformedRes.validationStatus === 'UNVERIFIED_OR_UNSAFE', 'Malformed must be unsafe');
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Verdict-Matched Action Guidance
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 2] Verdict-Matched Action Guidance (Requirement 3)');

  await runTest('2.1. SUPPORTED claim produces verified official application steps and portal', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: 'b1000000-0000-4000-a000-000000000001',
      originalClaim: 'Government provides ₹6,000 per year to farmers under PM Kisan scheme.',
      verdict: 'SUPPORTED',
      summaryExplanation: 'Official gazette confirms direct income support under PM-KISAN scheme.',
    });

    assert(guidance.verdict === 'SUPPORTED', 'Verdict must be SUPPORTED');
    assert(guidance.hasActionableService === true, 'Must identify actionable service');
    assert(Boolean(guidance.service?.schemeOrServiceName.includes('PM-KISAN')), 'Must match PM-KISAN');
    assert(guidance.service?.isPortalVerified === true, 'Portal must be verified');
    assert(guidance.service?.officialPortalUrl === 'https://pmkisan.gov.in', 'Portal URL must be pmkisan.gov.in');
    assert((guidance.service?.applicationSteps?.length ?? 0) >= 3, 'Must have at least 3 application steps');
    assert(guidance.checklist.length >= 3, 'Must provide interactive checklist');
    assert(guidance.eligibilityCriteria.length > 0, 'Must provide eligibility criteria questions');
  });

  await runTest('2.2. PARTIALLY_SUPPORTED claim highlights mandatory conditions & prerequisites', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: 'b1000000-0000-4000-a000-000000000002',
      originalClaim: 'PM Surya Ghar Muft Bijli Yojana provides free electricity to all households without solar installation.',
      verdict: 'PARTIALLY_SUPPORTED',
      summaryExplanation: 'Rooftop solar scheme is real but free electricity is conditioned on grid solar installation.',
    });

    assert(guidance.verdict === 'PARTIALLY_SUPPORTED', 'Verdict must be PARTIALLY_SUPPORTED');
    assert(guidance.advisoryType === 'CONDITIONAL_ACTION', 'Must use CONDITIONAL_ACTION advisory');
    assert(guidance.verdictActionHeading.includes('Conditions'), 'Heading must highlight conditions');
    assert(Boolean(guidance.service?.schemeOrServiceName.includes('PM Surya Ghar')), 'Must identify PM Surya Ghar');
    assert(guidance.service?.isPortalVerified === true, 'Portal must be pmsuryaghar.gov.in');
  });

  await runTest('2.3. CONTRADICTED claim blocks application links and provides scam alert (Zero false guidance)', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: 'b1000000-0000-4000-a000-000000000003',
      originalClaim: 'Ministry of Finance ordered mandatory 18% GST surcharge on all UPI payments.',
      verdict: 'CONTRADICTED',
      summaryExplanation: 'PIB Fact Check clarified this viral order is fake. No surcharge exists.',
    });

    assert(guidance.verdict === 'CONTRADICTED', 'Verdict must be CONTRADICTED');
    assert(guidance.hasActionableService === false, 'Must NOT present false actionable service');
    assert(guidance.advisoryType === 'CONTRADICTED_ALERT', 'Must trigger CONTRADICTED_ALERT');
    assert(guidance.service?.isPortalVerified === false, 'Must NOT verify portal for fake claim');
    assert(Boolean(guidance.service?.portalValidationNote?.includes('not verified')), 'Note must state link not verified');
    // Ensure scam reporting channels are provided
    assert(guidance.service?.grievanceOrContact.helplinePhone === '1930 (National Cyber Crime Helpline)', 'Must provide Cyber Crime helpline');
  });

  await runTest('2.4. INSUFFICIENT_EVIDENCE claim does not recommend applying & provides safe directories', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: 'b1000000-0000-4000-a000-000000000004',
      originalClaim: 'Government launched New Yuva Vikas scheme with ₹10,000 monthly cash grant.',
      verdict: 'INSUFFICIENT_EVIDENCE',
      summaryExplanation: 'No primary government gazette or notification found.',
    });

    assert(guidance.verdict === 'INSUFFICIENT_EVIDENCE', 'Verdict must be INSUFFICIENT_EVIDENCE');
    assert(guidance.hasActionableService === false, 'Must NOT claim actionable service');
    assert(guidance.advisoryType === 'UNVERIFIED_SAFE_SEARCH', 'Must advise safe search');
    assert(guidance.service?.isPortalVerified === false, 'Portal must be unverified');
    assert(guidance.service?.portalValidationNote === 'Official application link not verified (No authentic government gazette found).', 'Exact unverified note');
    // Safe directories must be present
    assert(guidance.checklist.some((c) => c.task.includes('myScheme')), 'Must suggest myScheme portal');
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Eligibility Questionnaire Evaluation (Requirement 6)
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 3] Eligibility Questionnaire Evaluation');

  await runTest('3.1. Questionnaire compares answers against criteria without storing private data', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: 'b1000000-0000-4000-a000-000000000001',
      originalClaim: 'PM Kisan scheme farmer eligibility rules.',
      verdict: 'SUPPORTED',
    });

    const criteria = guidance.eligibilityCriteria;
    assert(criteria.length >= 2, 'Must have at least 2 criteria questions');

    // Case A: All eligible answers
    const answersEligible = {
      'pmk-crit-land': 'yes_land',
      'pmk-crit-tax': 'no_tax',
      'pmk-crit-ekyc': 'yes_ekyc',
    };
    const evalEligible = evaluateEligibilityAnswers(criteria, answersEligible);
    assert(evalEligible.matchingCriteria.length >= 2, 'Must have matching criteria');
    assert(evalEligible.unmatchingCriteria.length === 0, 'Zero unmet conditions');
    assert(evalEligible.disclaimer.includes('preliminary'), 'Must include preliminary disclaimer');

    // Case B: Ineligible answer (e.g. paid income tax)
    const answersIneligible = {
      'pmk-crit-land': 'yes_land',
      'pmk-crit-tax': 'yes_tax', // fails income tax exclusion rule
    };
    const evalIneligible = evaluateEligibilityAnswers(criteria, answersIneligible);
    assert(evalIneligible.unmatchingCriteria.length >= 1, 'Must record unmet tax criteria');
    assert(evalIneligible.unmatchingCriteria[0].id === 'pmk-crit-tax', 'Failed criteria must be income tax');
  });

  // --------------------------------------------------------------------------
  // SECTION 4: Live API Endpoints & Authorization (Requirement 10 & 12)
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 4] Live API Endpoints & Authorization');

  const app = express();
  app.use(express.json());
  app.use('/api', apiRouter);

  let server: any;
  let baseUrl = '';

  await new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const createdRequestIds: string[] = [];

  try {
    const supabase = getServerSupabase();

    // Create test verification request with completed verdict
    const { data: testReq } = await supabase
      .from('verification_requests')
      .insert({
        input_type: 'CLAIM',
        original_claim: 'Test Action Claim: Farmers receive PM-KISAN installment directly.',
        status: 'COMPLETED',
        guest_session_token: 'valid-test-guest-token-12345',
      })
      .select()
      .single();

    assert(Boolean(testReq), 'Test request must be created');
    createdRequestIds.push(testReq.id);

    // Insert verification result
    await supabase.from('verification_results').insert({
      verification_request_id: testReq.id,
      verdict: 'SUPPORTED',
      confidence: 90,
      explanation: 'Verified official notification confirms PM-KISAN guidelines.',
    });

    await runTest('4.1. GET /api/v1/verify/:id/action-guidance with guest token returns verified action data', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/${testReq.id}/action-guidance`, {
        headers: {
          'X-Guest-Token': 'valid-test-guest-token-12345',
        },
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const json = await res.json();
      assert(json.success === true, 'Response must have success=true');
      assert(Boolean(json.data), 'Response must have data object');
      assert(json.data.verdict === 'SUPPORTED', 'Verdict must match');
      assert(json.data.hasActionableService === true, 'Must have actionable service');
      assert(Boolean(json.data.service.officialPortalUrl), 'Must have official portal URL');
    });

    await runTest('4.2. Cross-user isolation: Unauthorized guest token access is rejected with 403', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/${testReq.id}/action-guidance`, {
        headers: {
          'X-Guest-Token': 'wrong-unauthorized-token-99999',
        },
      });

      assert(res.status === 403, `Expected 403 Forbidden, got ${res.status}`);
    });

    await runTest('4.3. POST /api/v1/verify/:id/action-guidance/evaluate-eligibility evaluates answers without saving PII', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/${testReq.id}/action-guidance/evaluate-eligibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Token': 'valid-test-guest-token-12345',
        },
        body: JSON.stringify({
          answers: {
            'pmk-crit-land': 'yes_land',
            'pmk-crit-tax': 'no_tax',
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const json = await res.json();
      assert(json.success === true, 'Must have success=true');
      assert(Boolean(json.evaluation), 'Must return evaluation');
      assert(json.evaluation.matchingCriteria.length >= 1, 'Must identify matching criteria');
    });

    await runTest('4.4. Invalid UUID parameter rejected with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/not-a-valid-uuid/action-guidance`);
      assert(res.status === 400, `Expected 400 Bad Request, got ${res.status}`);
    });
  } finally {
    // Cleanup test records
    if (createdRequestIds.length > 0) {
      const supabase = getServerSupabase();
      await supabase.from('verification_requests').delete().in('id', createdRequestIds);
    }
    server.close();
  }

  console.log('\n================================================================');
  console.log(`ACTION GUIDANCE TEST SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runActionGuidanceTestSuite();
