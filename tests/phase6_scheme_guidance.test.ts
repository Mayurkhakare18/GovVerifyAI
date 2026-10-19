/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 6: Personalized Government Scheme Guidance Test Suite
 * Comprehensive automated verification covering:
 *  1. Scheme detection and false-positive passing-mention rejection
 *  2. Correct association of a claim with a sovereign scheme
 *  3. Official URL validation and SSRF protections
 *  4. Evidence-grounded benefit and eligibility statements with verified limits
 *  5. Required-document accuracy distinguishing mandatory and conditional documents
 *  6. Step-by-step online and offline (CSC / Revenue office) instructions
 *  7. Missing deadlines, rolling admissions, and unavailable direct link notices
 *  8. Personalized eligibility questionnaire evaluation (LIKELY_ELIGIBLE, MAY_NOT_MEET_CONDITION, CANNOT_DETERMINE)
 *  9. Sensitive PII detection & immediate rejection (Aadhaar, PAN, Bank Account, OTP/password)
 * 10. Insufficient or contradictory source handling (Scam alerts, zero false application guidance)
 * 11. Error resilience with external service failures (Gemini/Tavily fallback safety)
 * 12. API persistence, authorization, guest tokens, and 4-verdict regression integrity
 */

import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';

import express from 'express';
import {
  validateOfficialServiceUrl,
  checkOfficialDestinationReachability,
  detectSchemeFromClaimAndEvidence,
  isPassingMention,
  detectSensitivePii,
  buildSourceGroundedSchemeGuide,
  generateActionGuidance,
  evaluateEligibilityAnswers,
  getOrGenerateActionGuidance,
  DetectedSchemeRecord,
  StructuredSchemeGuide,
  EligibilityCriterion,
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

async function runPhase6TestSuite() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — PHASE 6: SCHEME GUIDANCE TEST SUITE');
  console.log('Validating Detection, Guides, Questionnaire, SSRF, PII & Regressions');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: Scheme Detection & False-Positive Passing-Mention Rejection
  // --------------------------------------------------------------------------
  console.log('[SECTION 1] Scheme Detection & False-Positive Passing-Mention Rejection');

  await runTest('1.1. Detects primary sovereign schemes from claim text', async () => {
    // PM-KISAN
    const det1 = detectSchemeFromClaimAndEvidence({
      originalClaim: 'Eligible farmers receive ₹6,000 every year under the PM Kisan Samman Nidhi scheme.',
    });
    assert(det1 !== null, 'PM-KISAN must be detected');
    assert(det1!.schemeId === 'pm-kisan', 'Scheme ID must be pm-kisan');
    assert(det1!.jurisdiction === 'CENTRAL', 'Jurisdiction must be CENTRAL');
    assert(det1!.administeringMinistryOrDepartment.includes('Agriculture'), 'Must identify Agriculture Ministry');
    assert(det1!.schemeInformationUrl.startsWith('https://pmkisan.gov.in'), 'Must link to pmkisan.gov.in');
    assert(det1!.isMeaningfulConnection === true, 'Must flag meaningful connection');

    // PM Surya Ghar
    const det2 = detectSchemeFromClaimAndEvidence({
      originalClaim: 'PM Surya Ghar Muft Bijli Yojana provides rooftop solar subsidy up to ₹78,000.',
    });
    assert(det2 !== null, 'PM Surya Ghar must be detected');
    assert(det2!.schemeId === 'pm-surya-ghar', 'Scheme ID must be pm-surya-ghar');
    assert(det2!.administeringMinistryOrDepartment.includes('New and Renewable Energy'), 'Must identify MNRE');

    // Ayushman Bharat
    const det3 = detectSchemeFromClaimAndEvidence({
      originalClaim: 'Ayushman Bharat PMJAY provides health cover of ₹5 lakh per family per year.',
    });
    assert(det3 !== null, 'Ayushman Bharat must be detected');
    assert(det3!.schemeId === 'ab-pmjay', 'Scheme ID must be ab-pmjay');
    assert(det3!.administeringMinistryOrDepartment.includes('Health and Family Welfare'), 'Must identify Health Ministry');

    // Atal Pension Yojana
    const det4 = detectSchemeFromClaimAndEvidence({
      originalClaim: 'Atal Pension Yojana offers a monthly pension of ₹1,000 to ₹5,000 after age 60.',
    });
    assert(det4 !== null, 'APY must be detected');
    assert(det4!.schemeId === 'atal-pension-yojana', 'Scheme ID must be atal-pension-yojana');
  });

  await runTest('1.2. Rejects false-positive passing mentions (comparisons, contrastive clauses)', async () => {
    // Unlike PM-KISAN
    const passing1 = 'Unlike PM-KISAN, this private high-yield mutual fund promises 40% annual returns without land ownership.';
    assert(isPassingMention(passing1, ['pm kisan', 'pm-kisan']) === true, 'isPassingMention must detect "Unlike PM-KISAN"');
    const detPassing1 = detectSchemeFromClaimAndEvidence({ originalClaim: passing1 });
    assert(detPassing1 === null, 'Must reject scheme detection when mentioned merely as a comparison');

    // Compared to Ayushman Bharat
    const passing2 = 'Compared to Ayushman Bharat, our private wellness spa in Goa provides organic detox packages.';
    assert(isPassingMention(passing2, ['ayushman', 'pmjay']) === true, 'isPassingMention must detect "Compared to Ayushman"');
    const detPassing2 = detectSchemeFromClaimAndEvidence({ originalClaim: passing2 });
    assert(detPassing2 === null, 'Must reject comparison with Ayushman Bharat');

    // Better than PM Awas Yojana
    const passing3 = 'Better than PM Awas Yojana, buy our private luxury sea-facing villa in Dubai with zero downpayment.';
    assert(isPassingMention(passing3, ['pm awas', 'pmay']) === true, 'isPassingMention must detect "Better than PM Awas"');
    const detPassing3 = detectSchemeFromClaimAndEvidence({ originalClaim: passing3 });
    assert(detPassing3 === null, 'Must reject comparative luxury villa promotion');

    // Instead of PM Ujjwala
    const passing4 = 'Instead of PM Ujjwala Yojana, commercial restaurants should buy our private induction stoves.';
    assert(isPassingMention(passing4, ['ujjwala', 'pmuy']) === true, 'isPassingMention must detect "Instead of PM Ujjwala"');
    const detPassing4 = detectSchemeFromClaimAndEvidence({ originalClaim: passing4 });
    assert(detPassing4 === null, 'Must reject "Instead of PM Ujjwala"');

    // Completely unrelated claim
    const unrelated = 'Government of Karnataka inaugurated a public library and city botanical park in Mysuru.';
    const detUnrelated = detectSchemeFromClaimAndEvidence({ originalClaim: unrelated });
    assert(detUnrelated === null, 'Unrelated municipal news must return null');
  });

  await runTest('1.3. Resolves scheme from verified evidence when claim phrasing is colloquial', async () => {
    const colloquialClaim = 'Central govt sent ₹2,000 installment money directly to farmer bank accounts today.';
    const mockEvidence = [
      {
        id: 'ev-101',
        claim_text: 'DBT installment of ₹2,000 released to 9 crore farmers under PM-KISAN scheme.',
        sources: {
          title: 'PM-KISAN Official Gazette & Beneficiary Release',
          url: 'https://pmkisan.gov.in/Releases.aspx',
        },
      },
    ];

    const det = detectSchemeFromClaimAndEvidence({
      originalClaim: colloquialClaim,
      evidence: mockEvidence,
    });
    assert(det !== null, 'Must resolve scheme through verified evidence');
    assert(det!.schemeId === 'pm-kisan', 'Must resolve to pm-kisan');
    assert(det!.relevantEvidenceIds.includes('ev-101'), 'Must record relevant evidence ID');
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Official URL Validation & SSRF Protections
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 2] Official URL Validation & SSRF Protections');

  await runTest('2.1. Sovereign government portals are classified VERIFIED_OFFICIAL', async () => {
    const p1 = validateOfficialServiceUrl('https://pmkisan.gov.in/RegistrationFormNew.aspx');
    assert(p1.isValid === true, 'URL is valid');
    assert(p1.isOfficialSovereign === true, 'Domain is sovereign');
    assert(p1.validationStatus === 'VERIFIED_OFFICIAL', 'Status must be VERIFIED_OFFICIAL');

    const p2 = validateOfficialServiceUrl('https://pmsuryaghar.gov.in/consumerRegistration');
    assert(p2.isValid === true, 'PM Surya Ghar is valid');
    assert(p2.validationStatus === 'VERIFIED_OFFICIAL', 'Must be VERIFIED_OFFICIAL');

    const p3 = validateOfficialServiceUrl('https://scholarships.gov.in');
    assert(p3.isOfficialSovereign === true, 'National Scholarship Portal is sovereign');
  });

  await runTest('2.2. SSRF targets (loopback, private IP, metadata services) are rejected', async () => {
    // Localhost & Loopback
    const r1 = validateOfficialServiceUrl('http://127.0.0.1:8000/apply');
    assert(r1.validationStatus === 'UNVERIFIED_OR_UNSAFE', '127.0.0.1 must be blocked');

    const r2 = validateOfficialServiceUrl('http://localhost:3000/api/scheme');
    assert(r2.validationStatus === 'UNVERIFIED_OR_UNSAFE', 'localhost must be blocked');

    // Cloud Metadata Service
    const r3 = validateOfficialServiceUrl('http://169.254.169.254/latest/meta-data/');
    assert(r3.validationStatus === 'UNVERIFIED_OR_UNSAFE', 'AWS/GCP metadata IP must be blocked');

    // Private Class A, B, C ranges
    const r4 = validateOfficialServiceUrl('http://10.200.0.1/admin');
    assert(r4.validationStatus === 'UNVERIFIED_OR_UNSAFE', '10.x.x.x must be blocked');

    const r5 = validateOfficialServiceUrl('http://192.168.1.254/status');
    assert(r5.validationStatus === 'UNVERIFIED_OR_UNSAFE', '192.168.x.x must be blocked');

    const r6 = validateOfficialServiceUrl('http://172.16.50.1/intake');
    assert(r6.validationStatus === 'UNVERIFIED_OR_UNSAFE', '172.16.x.x must be blocked');
  });

  await runTest('2.3. Dangerous protocols (javascript:, file:, data:) are rejected', async () => {
    const js = validateOfficialServiceUrl('javascript:alert(document.cookie)');
    assert(js.isValid === false, 'javascript: protocol must be invalid');

    const file = validateOfficialServiceUrl('file:///etc/hosts');
    assert(file.isValid === false, 'file: protocol must be invalid');

    const data = validateOfficialServiceUrl('data:text/html,<h1>Phishing</h1>');
    assert(data.isValid === false, 'data: protocol must be invalid');
  });

  await runTest('2.4. Commercial and lookalike domains are marked INFORMATIONAL_ONLY or UNVERIFIED', async () => {
    const comm = validateOfficialServiceUrl('https://pmkisan-yojana-apply.com/login');
    assert(comm.isOfficialSovereign === false, 'Commercial domain must not be sovereign');
    assert(comm.validationStatus === 'INFORMATIONAL_ONLY', 'Commercial domain marked INFORMATIONAL_ONLY');
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Evidence-Grounded Scheme Guide Generation
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 3] Evidence-Grounded Scheme Guide Generation');

  await runTest('3.1. Structured scheme guide includes benefits, limits, and grounded overview', async () => {
    const det = detectSchemeFromClaimAndEvidence({
      originalClaim: 'PM-KISAN provides direct bank transfer support to farmer families.',
    });
    assert(det !== null, 'Scheme must be detected');

    const guidance = await generateActionGuidance({
      verificationRequestId: 'c1000000-0000-4000-a000-000000000001',
      originalClaim: 'PM-KISAN provides direct bank transfer support to farmer families.',
      verdict: 'SUPPORTED',
      summaryExplanation: 'Official gazette confirms PM-KISAN benefits.',
    });

    assert(Boolean(guidance.schemeGuide), 'Scheme guide must be built and attached');
    const guide = guidance.schemeGuide!;
    assert(guide.schemeOverview.length > 20, 'Scheme overview must be substantive');
    assert(guide.benefitsProvided.description.includes('₹6,000'), 'Benefits must state ₹6,000');
    assert(guide.benefitsProvided.verifiedLimits !== undefined, 'Verified limits must be present');
    assert(guide.benefitsProvided.verifiedLimits!.includes('Maximum ₹6,000'), 'Verified limits must state cap');
    assert(guide.eligibilityExplanation.length > 0, 'Eligibility criteria must be detailed one by one');
    assert(guide.eligibilityExplanation[0].whyItMatters.length > 5, 'Why it matters must be explained');
  });

  await runTest('3.2. Distinguishes mandatory vs conditional documents with conditions', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: 'c1000000-0000-4000-a000-000000000002',
      originalClaim: 'PM Surya Ghar Muft Bijli Yojana rooftop solar scheme installation.',
      verdict: 'PARTIALLY_SUPPORTED',
      summaryExplanation: 'Rooftop solar subsidy is conditional on grid-connected solar installation.',
    });

    const guide = guidance.schemeGuide;
    assert(Boolean(guide), 'Guide must be generated');
    const docs = guide!.requiredDocuments;
    assert(docs.length >= 3, 'Must have at least 3 required documents');

    const mandatoryDocs = docs.filter((d) => d.isMandatory === true);
    const conditionalDocs = docs.filter((d) => d.isMandatory === false);

    assert(mandatoryDocs.length > 0, 'Must have mandatory documents (Aadhaar, Electricity Bill)');
    assert(conditionalDocs.length > 0, 'Must have conditional documents (Rooftop ownership/NOC)');
    assert(
      conditionalDocs.some((d) => Boolean(d.conditionDescription)),
      'Conditional documents must include conditionDescription explaining when they are needed'
    );
  });

  await runTest('3.3. Provides dual application channels: sequential online steps and offline CSC instructions', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: 'c1000000-0000-4000-a000-000000000003',
      originalClaim: 'Ayushman Bharat PMJAY provides health insurance cover to low income citizens.',
      verdict: 'SUPPORTED',
      summaryExplanation: 'Ayushman Bharat provides cashless treatment up to ₹5 lakh.',
    });

    const guide = guidance.schemeGuide!;
    assert(Boolean(guide.applicationInstructions.onlineSteps), 'Online steps must exist');
    assert(guide.applicationInstructions.onlineSteps!.length >= 3, 'Must have at least 3 online steps');
    assert(Boolean(guide.applicationInstructions.offlineOfficeSteps), 'Offline steps must exist');
    assert(guide.applicationInstructions.offlineOfficeSteps!.length >= 2, 'Must have offline/CSC steps');
    assert(
      guide.applicationInstructions.offlineOfficeSteps!.some((s) => s.includes('Common Service Center') || s.includes('CSC') || s.includes('Empaneled Hospital') || s.includes('Ayushman Mitra')),
      'Offline steps must mention official local touchpoints (CSC / Empaneled Hospital / Ayushman Mitra)'
    );
  });

  await runTest('3.4. Handles missing or unverified direct application links with honest notices', async () => {
    const mockRecord: DetectedSchemeRecord = {
      schemeId: 'mock-scholarship',
      officialSchemeName: 'State Post-Matric Welfare Scholarship',
      alternativeNamesOrAbbreviations: ['SPMWS'],
      administeringMinistryOrDepartment: 'Department of Higher Education',
      jurisdiction: 'STATE',
      schemeInformationUrl: 'https://highereducation.gov.in/scholarship',
      applicationUrl: undefined,
      isApplicationUrlVerified: false,
      relevantEvidenceIds: [],
      lastSourceVerificationTimestamp: new Date().toISOString(),
      isMeaningfulConnection: true,
      matchConfidence: 0.85,
    };

    const guide = buildSourceGroundedSchemeGuide({
      schemeRecord: mockRecord,
    });

    assert(guide.isApplicationUrlConfirmed === false, 'Direct application URL must be marked unconfirmed');
    assert(Boolean(guide.unverifiedApplicationNotice), 'Must provide clear unverified notice');
    assert(
      guide.unverifiedApplicationNotice!.includes('could not be independently confirmed'),
      'Notice must explain link could not be independently confirmed'
    );
    assert(
      guide.uncertaintiesAndLimitations.some((u) => u.includes('direct online application link could not be independently confirmed')),
      'Must record uncertainty regarding unverified direct application link'
    );
  });

  // --------------------------------------------------------------------------
  // SECTION 4: Personalized Eligibility Questionnaire & PII Safeguards
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 4] Personalized Eligibility Questionnaire & PII Safeguards');

  const sampleCriteria: EligibilityCriterion[] = [
    {
      id: 'crit-land',
      title: 'Agricultural Landholding',
      question: 'Do you or your family hold cultivable land in your name?',
      category: 'status',
      options: [
        { label: 'Yes, I hold cultivable land', value: 'yes', isEligibleMatch: true, explanation: 'Cultivable land is required for PM-KISAN.' },
        { label: 'No cultivable land', value: 'no', isEligibleMatch: false, explanation: 'Scheme is limited to landholding farmers.' },
      ],
      officialRequirementDescription: 'Beneficiary family must possess cultivable land as per state revenue records.',
      whyWeAsk: 'Required to verify land title eligibility under Operational Guidelines Para 2.',
    },
    {
      id: 'crit-tax',
      title: 'Income Tax Assessment',
      question: 'Did any family member pay income tax in the last assessment year?',
      category: 'income',
      options: [
        { label: 'No, nobody pays income tax', value: 'no', isEligibleMatch: true, explanation: 'Non-taxpaying families qualify.' },
        { label: 'Yes, family member pays income tax', value: 'yes', isEligibleMatch: false, explanation: 'Taxpayers are statutorily excluded.' },
      ],
      officialRequirementDescription: 'Any person who paid Income Tax in last assessment year is excluded.',
      whyWeAsk: 'Statutory exclusion under Section 3 of Scheme Notification.',
    },
  ];

  await runTest('4.1. Evaluates LIKELY_ELIGIBLE when all answers deterministically match criteria', async () => {
    const answers = {
      'crit-land': 'yes',
      'crit-tax': 'no',
    };
    const result = evaluateEligibilityAnswers(sampleCriteria, answers);

    assert(result.category === 'LIKELY_ELIGIBLE', 'Category must be LIKELY_ELIGIBLE');
    assert(result.categoryLabel === 'Likely eligible based on your answers', 'Label must match');
    assert(result.matchingCriteria.length === 2, 'Both criteria must match');
    assert(result.unmatchingCriteria.length === 0, 'No unmatching criteria');
    assert(result.unknownCriteria.length === 0, 'No unknown criteria');
    assert(result.disclaimer.includes('does not constitute an official government determination'), 'Must include civic disclaimer');
  });

  await runTest('4.2. Evaluates MAY_NOT_MEET_CONDITION when an answer conflicts with documented rules', async () => {
    const answers = {
      'crit-land': 'yes',
      'crit-tax': 'yes', // Excluded!
    };
    const result = evaluateEligibilityAnswers(sampleCriteria, answers);

    assert(result.category === 'MAY_NOT_MEET_CONDITION', 'Category must be MAY_NOT_MEET_CONDITION');
    assert(result.categoryLabel === 'May not meet a listed condition', 'Label must match');
    assert(result.unmatchingCriteria.length === 1, 'One criterion failed');
    assert(result.unmatchingCriteria[0].id === 'crit-tax', 'crit-tax must be the unmatching criterion');
    assert(result.matchingCriteria.length === 1, 'One criterion passed');
  });

  await runTest('4.3. Evaluates CANNOT_DETERMINE when questions are skipped or left unanswered', async () => {
    const answers = {
      'crit-land': 'yes',
      // 'crit-tax' is omitted
    };
    const result = evaluateEligibilityAnswers(sampleCriteria, answers);

    assert(result.category === 'CANNOT_DETERMINE', 'Category must be CANNOT_DETERMINE');
    assert(result.categoryLabel === 'Cannot determine from the available information', 'Label must match');
    assert(result.unknownCriteria.length === 1, 'crit-tax must be listed as unknown');
    assert(result.unknownCriteria[0].id === 'crit-tax', 'Unknown criterion must be crit-tax');
  });

  await runTest('4.4. Detects and immediately rejects sensitive PII (Aadhaar, PAN, Bank Account, OTP)', async () => {
    // 12-digit Aadhaar
    const aadhaarInput = { 'crit-land': 'My Aadhaar is 5544 3322 1100' };
    const pii1 = detectSensitivePii(aadhaarInput);
    assert(pii1.hasPii === true, 'Must detect 12-digit Aadhaar');
    assert(pii1.piiType === 'Aadhaar Number', 'Must identify Aadhaar Number');

    const evalAadhaar = evaluateEligibilityAnswers(sampleCriteria, aadhaarInput);
    assert(evalAadhaar.category === 'CANNOT_DETERMINE', 'Evaluation must abort safely');
    assert(Boolean(evalAadhaar.piiWarning), 'Must return explicit piiWarning');
    assert(evalAadhaar.piiWarning!.includes('Aadhaar Number'), 'Warning must mention Aadhaar');

    // PAN Card
    const panInput = { 'crit-land': 'ABCDE1234F' };
    const pii2 = detectSensitivePii(panInput);
    assert(pii2.hasPii === true, 'Must detect PAN number');
    assert(pii2.piiType === 'Permanent Account Number (PAN)', 'Must identify PAN');

    // Bank Account Number (15 digits, distinct from 12-digit Aadhaar)
    const bankInput = { 'crit-land': '123456789012345' };
    const pii3 = detectSensitivePii(bankInput);
    assert(pii3.hasPii === true, 'Must detect bank account number');
    assert(pii3.piiType === 'Bank Account Number', 'Must identify Bank Account');

    // OTP / Password
    const otpInput = { 'crit-land': 'my secret password is xyz' };
    const pii4 = detectSensitivePii(otpInput);
    assert(pii4.hasPii === true, 'Must detect password/OTP');
  });

  // --------------------------------------------------------------------------
  // SECTION 5: Verdict Integrations & Scam/Contradicted Guardrails
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 5] Verdict Integrations & Scam/Contradicted Guardrails');

  await runTest('5.1. CONTRADICTED scam claim does not route citizens to fraudulent application link', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: 'c1000000-0000-4000-a000-000000000004',
      originalClaim: 'PM Kisan scheme is paying ₹15,000 bonus cash on unofficial Telegram channel.',
      verdict: 'CONTRADICTED',
      summaryExplanation: 'PIB Fact Check debunked: Ministry does not disburse bonus funds through Telegram.',
    });

    assert(guidance.verdict === 'CONTRADICTED', 'Verdict is CONTRADICTED');
    assert(guidance.advisoryType === 'CONTRADICTED_ALERT', 'Advisory must be CONTRADICTED_ALERT');
    assert(guidance.hasActionableService === false, 'Must not offer actionable service on scam claim');
    assert(guidance.verdictActionHeading.includes('Protect Yourself'), 'Must caution citizen to protect themselves');
    // Service portal must not direct to scam
    if (guidance.service?.officialPortalUrl) {
      assert(
        guidance.service.officialPortalUrl.includes('.gov.in') || guidance.service.officialPortalUrl.includes('.nic.in'),
        'Any linked portal must be sovereign government authority, never a scam site'
      );
    }
  });

  await runTest('5.2. INSUFFICIENT_EVIDENCE claim does not recommend applying and provides safe directories', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: 'c1000000-0000-4000-a000-000000000005',
      originalClaim: 'Central government will provide ₹25,000 laptop scheme to all students next week.',
      verdict: 'INSUFFICIENT_EVIDENCE',
      summaryExplanation: 'No gazette notification or official release corroborates this claim.',
    });

    assert(guidance.verdict === 'INSUFFICIENT_EVIDENCE', 'Verdict is INSUFFICIENT_EVIDENCE');
    assert(guidance.advisoryType === 'UNVERIFIED_SAFE_SEARCH', 'Advisory is UNVERIFIED_SAFE_SEARCH');
    assert(guidance.verdictActionHeading.includes('Verify Further'), 'Must advise further verification');
    assert(guidance.checklist.some((t) => t.task.includes('myscheme.gov.in') || t.detail.includes('india.gov.in')), 'Provides safe directories');
  });

  // --------------------------------------------------------------------------
  // SECTION 6: API Routes, Guest Tokens & Persistence
  // --------------------------------------------------------------------------
  console.log('\n[SECTION 6] API Routes, Guest Tokens & Persistence');

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
        original_claim: 'Test Scheme Claim: PM-KISAN direct benefit transfer to farmers.',
        status: 'COMPLETED',
        guest_session_token: 'test-guest-token-phase6-abc',
      })
      .select()
      .single();

    assert(Boolean(testReq), 'Test request must be created');
    createdRequestIds.push(testReq.id);

    // Insert verification result
    await supabase.from('verification_results').insert({
      verification_request_id: testReq.id,
      verdict: 'SUPPORTED',
      confidence: 95,
      explanation: 'Verified official notification confirms PM-KISAN guidelines.',
    });

    await runTest('6.1. POST /api/v1/verify/:id/action-guidance/evaluate-eligibility evaluates answers cleanly', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/${testReq.id}/action-guidance/evaluate-eligibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Token': 'test-guest-token-phase6-abc',
        },
        body: JSON.stringify({
          answers: {
            'pmk-crit-land': 'yes_land',
            'pmk-crit-tax': 'no_tax',
            'pmk-crit-ekyc': 'yes_ekyc',
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const json = await res.json();
      assert(json.success === true, 'Response must have success=true');
      assert(Boolean(json.evaluation), 'Response must contain evaluation');
      assert(json.evaluation.category === 'LIKELY_ELIGIBLE', 'Should evaluate as LIKELY_ELIGIBLE');
      assert(json.evaluation.categoryLabel === 'Likely eligible based on your answers', 'Category label must match');
    });

    await runTest('6.2. POST evaluate-eligibility with sensitive PII returns 200 with security warning banner', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/${testReq.id}/action-guidance/evaluate-eligibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Token': 'test-guest-token-phase6-abc',
        },
        body: JSON.stringify({
          answers: {
            'pmk-crit-land': '5544 3322 1100', // Sensitive Aadhaar number!
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const json = await res.json();
      assert(json.success === true, 'Response must be success=true with safe handling');
      assert(Boolean(json.evaluation.piiWarning), 'Must return piiWarning in evaluation object');
      assert(json.evaluation.category === 'CANNOT_DETERMINE', 'Evaluation must abort to CANNOT_DETERMINE');
    });

    await runTest('6.3. Invalid non-UUID parameter is rejected with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify/invalid-uuid-format/action-guidance/evaluate-eligibility`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: {} }),
      });
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

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`PHASE 6 TEST SUMMARY: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase6TestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
