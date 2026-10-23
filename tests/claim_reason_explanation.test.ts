/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Claim Reason Explanation Test Suite
 * 
 * Validates:
 * 1. SUPPORTED claims: heading "Why this claim is correct", direct plain-language answer,
 *    specific confirmed facts, source quotations, authoritative citations, and conditions.
 * 2. CONTRADICTED claims: heading "Why this claim is wrong", exact statement contradicted,
 *    what official records say instead, clear explanation, direct citation, and no false refutation on missing evidence.
 * 3. PARTIALLY_SUPPORTED claims: heading "What is correct and what is wrong", assertion-by-assertion
 *    separation into supported, contradicted, or not established.
 * 4. INSUFFICIENT_EVIDENCE claims: heading "Why we cannot verify this claim yet", explanation of missing
 *    evidence, and explicit non-falsity safeguard notice (absence of proof != falsehood).
 * 5. Guardrail enforcement: rejection of invalid headings or fabricated contradictions without evidence.
 * 6. Non-use of confidence score as the explanation text.
 * 7. VerificationConsole and VerificationResultView integration, verifying the Scheme Roadmap remains mounted.
 */

import dotenv from 'dotenv';
dotenv.config();

import {
  evaluateEvidenceForSubclaims,
  buildClaimReasonExplanation,
  validateVerdictAnalysis,
  StructuredVerdictAnalysis,
} from '../src/server/services/verdictAnalysis';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTest(name: string, fn: () => Promise<void> | void) {
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

async function main() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — CLAIM REASON EXPLANATION TEST SUITE');
  console.log('Validating Plain-Language Reasons for Correct, Incorrect, and Unverified Claims');
  console.log('================================================================\n');

  // =========================================================================
  // SCENARIO 1: SUPPORTED — Why is this claim correct?
  // =========================================================================
  console.log('[SCENARIO 1: SUPPORTED CLAIMS]');
  await runTest('1.1. SUPPORTED claim produces heading "Why this claim is correct" with direct answer', () => {
    const claim = 'Under PM-KISAN, eligible farmers receive direct income support of ₹6,000 per year in three installments.';
    const subclaims = [
      'Under PM-KISAN, eligible farmers receive direct income support of ₹6,000 per year',
      'The benefit is payable in three installments of ₹2,000 each',
    ];
    const evidence = [
      {
        id: 'ev-pmk-101',
        verification_request_id: 'req-sup-1',
        source_id: 'src-pmk-1',
        extracted_text: 'Under PM-KISAN, eligible landholding farmer families receive direct income support of ₹6,000 per year payable in three equal installments of ₹2,000 every four months through direct benefit transfer.',
        relationship: 'SUPPORTS',
        sources: {
          id: 'src-pmk-1',
          title: 'PM-KISAN Scheme Guidelines',
          url: 'https://pmkisan.gov.in/guidelines.html',
          domain: 'pmkisan.gov.in',
          issuing_authority: 'Ministry of Agriculture and Farmers Welfare',
          source_type: 'GROUNDED_SEARCH',
        },
      },
    ];

    const result = evaluateEvidenceForSubclaims(claim, subclaims, evidence);

    assert(result.verdict === 'SUPPORTED', `Verdict should be SUPPORTED, got ${result.verdict}`);
    assert(Boolean(result.reasonExplanation), 'reasonExplanation must be present');
    assert(
      result.reasonExplanation?.verdictHeading === 'Why this claim is correct',
      `Expected heading "Why this claim is correct", got "${result.reasonExplanation?.verdictHeading}"`
    );
    assert(
      typeof result.reasonExplanation?.directAnswer === 'string' &&
        result.reasonExplanation.directAnswer.length > 20,
      'Direct answer must be a clear plain-language statement'
    );
    assert(
      !result.reasonExplanation?.directAnswer.toLowerCase().includes('confidence'),
      'Direct answer must not rely on confidence percentage as explanation'
    );
  });

  await runTest('1.2. SUPPORTED claim links confirmed facts to official evidence and provides conditions', () => {
    const claim = 'PM-KISAN pays ₹6,000 per year in three equal installments.';
    const subclaims = ['PM-KISAN pays ₹6,000 per year in three equal installments'];
    const evidence = [
      {
        id: 'ev-pmk-102',
        verification_request_id: 'req-sup-2',
        source_id: 'src-pmk-2',
        extracted_text: 'Income support of ₹6,000 per year in three equal installments to all landholding farmer families subject to e-KYC verification.',
        relationship: 'SUPPORTS',
        sources: {
          id: 'src-pmk-2',
          title: 'Operational Modalities',
          url: 'https://pmkisan.gov.in/portal.html',
          domain: 'pmkisan.gov.in',
          issuing_authority: 'Ministry of Agriculture',
          source_type: 'GROUNDED_SEARCH',
        },
      },
    ];

    const result = evaluateEvidenceForSubclaims(claim, subclaims, evidence);
    const explanation = result.reasonExplanation!;

    assert(explanation.assertions.length > 0, 'Assertions breakdown must have entries');
    const firstAssertion = explanation.assertions[0];
    assert(firstAssertion.status === 'SUPPORTED', 'Assertion status must be SUPPORTED');
    assert(
      Boolean(firstAssertion.sourceQuote && firstAssertion.sourceQuote.includes('₹6,000')),
      'Assertion must include exact source quote'
    );
    assert(
      firstAssertion.sourceUrl === 'https://pmkisan.gov.in/portal.html',
      `Expected source URL to link to official portal, got ${firstAssertion.sourceUrl}`
    );
    assert(
      firstAssertion.officialPublisher === 'Ministry of Agriculture',
      'Must identify official publisher'
    );
    assert(
      Array.isArray(explanation.conditionsOrLimitations) && explanation.conditionsOrLimitations.length > 0,
      'Must include relevant conditions or limitations'
    );
  });

  // =========================================================================
  // SCENARIO 2: CONTRADICTED — Why is this claim wrong?
  // =========================================================================
  console.log('\n[SCENARIO 2: CONTRADICTED CLAIMS]');
  await runTest('2.1. CONTRADICTED claim produces heading "Why this claim is wrong" and explains conflict', () => {
    const claim = 'PM-KISAN installment amount has been increased to ₹12,000 per year starting this month.';
    const subclaims = [
      'PM-KISAN installment amount has been increased to ₹12,000 per year',
      'The increase is effective starting this month',
    ];
    const evidence = [
      {
        id: 'ev-contra-201',
        verification_request_id: 'req-contra-1',
        source_id: 'src-contra-1',
        extracted_text: 'PIB Fact Check: A viral message claiming that the financial assistance under the PM-KISAN scheme has been increased to ₹12,000 is fake and fraudulent. Under the scheme, eligible farmers receive ₹6,000 per year in three installments of ₹2,000.',
        relationship: 'REFUTES',
        sources: {
          id: 'src-contra-1',
          title: 'PIB Fact Check: PM-KISAN ₹12,000 claim is fake',
          url: 'https://factcheck.pib.gov.in/pmkisan-fake-alert',
          domain: 'factcheck.pib.gov.in',
          issuing_authority: 'Press Information Bureau (PIB)',
          source_type: 'OFFICIAL_FACT_CHECK',
        },
      },
    ];

    const result = evaluateEvidenceForSubclaims(claim, subclaims, evidence);

    assert(result.verdict === 'CONTRADICTED', `Verdict should be CONTRADICTED, got ${result.verdict}`);
    assert(
      result.reasonExplanation?.verdictHeading === 'Why this claim is wrong',
      `Expected heading "Why this claim is wrong", got "${result.reasonExplanation?.verdictHeading}"`
    );
    assert(
      typeof result.reasonExplanation?.directAnswer === 'string' &&
        result.reasonExplanation.directAnswer.includes('wrong'),
      'Direct answer must explain that the claim is wrong'
    );

    const contradictedAssertion = result.reasonExplanation?.assertions.find(
      (a) => a.status === 'CONTRADICTED'
    );
    assert(Boolean(contradictedAssertion), 'Must identify the exact statement that is contradicted');
    assert(
      Boolean(contradictedAssertion?.officialFactInstead),
      'Must specify what the official record says instead'
    );
    assert(
      Boolean(contradictedAssertion?.sourceQuote && contradictedAssertion.sourceQuote.includes('fake')),
      'Must include official excerpt refuting statement'
    );
    assert(
      contradictedAssertion?.sourceUrl === 'https://factcheck.pib.gov.in/pmkisan-fake-alert',
      'Must cite exact authoritative source establishing conflicting fact'
    );
  });

  await runTest('2.2. Never call a claim false merely because a supporting source could not be found', () => {
    // Proposition A has contradicting evidence, Proposition B has NO evidence
    const claim = 'PM-KISAN is ₹12,000 and requires registering on an external website.';
    const subclaims = [
      'PM-KISAN is ₹12,000',
      'Requires registering on an external website',
    ];
    const evidence = [
      {
        id: 'ev-contra-202',
        verification_request_id: 'req-contra-2',
        source_id: 'src-contra-2',
        extracted_text: 'PIB clarification: PM-KISAN benefit is ₹6,000 per year, claims of ₹12,000 are false.',
        relationship: 'REFUTES',
        sources: {
          id: 'src-contra-2',
          title: 'PIB Clarification',
          url: 'https://pib.gov.in/clarification',
          domain: 'pib.gov.in',
          issuing_authority: 'PIB',
          source_type: 'OFFICIAL_PRESS_RELEASE',
        },
      },
    ];

    const result = evaluateEvidenceForSubclaims(claim, subclaims, evidence);
    const unverifiedAssertion = result.reasonExplanation?.assertions.find(
      (a) => a.assertion === 'Requires registering on an external website'
    );

    assert(
      unverifiedAssertion?.status === 'NOT_ESTABLISHED',
      `Assertion without evidence must be NOT_ESTABLISHED, not ${unverifiedAssertion?.status}`
    );
    assert(
      unverifiedAssertion?.status !== 'CONTRADICTED',
      'Must NEVER mark an assertion CONTRADICTED merely because evidence was not found'
    );
    assert(
      Boolean(
        unverifiedAssertion?.explanation &&
          (unverifiedAssertion.explanation.toLowerCase().includes('never treated as proof that a statement is false') ||
           unverifiedAssertion.explanation.toLowerCase().includes('not treated as proof that a statement is false'))
      ),
      'Explanation must note that absence of proof is not proof of falsehood'
    );
  });

  // =========================================================================
  // SCENARIO 3: PARTIALLY_SUPPORTED — What is correct and what is wrong?
  // =========================================================================
  console.log('\n[SCENARIO 3: PARTIALLY SUPPORTED CLAIMS]');
  await runTest('3.1. PARTIALLY_SUPPORTED separates claim into individual factual assertions', () => {
    const claim = 'PM-KISAN provides ₹6,000 per year, but applicants must pay a ₹500 verification fee.';
    const subclaims = [
      'PM-KISAN provides ₹6,000 per year',
      'Applicants must pay a ₹500 verification fee',
    ];
    const evidence = [
      {
        id: 'ev-part-301',
        verification_request_id: 'req-part-1',
        source_id: 'src-pmk-3',
        extracted_text: 'Under PM-KISAN, eligible farmers receive ₹6,000 per year in three installments of ₹2,000. Registration on the portal is completely free of cost and no fee is charged.',
        relationship: 'SUPPORTS',
        sources: {
          id: 'src-pmk-3',
          title: 'PM-KISAN Official Portal FAQs',
          url: 'https://pmkisan.gov.in/faq.html',
          domain: 'pmkisan.gov.in',
          issuing_authority: 'Ministry of Agriculture',
          source_type: 'GROUNDED_SEARCH',
        },
      },
    ];

    const result = evaluateEvidenceForSubclaims(claim, subclaims, evidence);

    assert(result.verdict === 'PARTIALLY_SUPPORTED', `Expected PARTIALLY_SUPPORTED, got ${result.verdict}`);
    assert(
      result.reasonExplanation?.verdictHeading === 'What is correct and what is wrong',
      `Expected heading "What is correct and what is wrong", got "${result.reasonExplanation?.verdictHeading}"`
    );

    const supportedPart = result.reasonExplanation?.assertions.find((a) => a.status === 'SUPPORTED');
    const contradictedPart = result.reasonExplanation?.assertions.find((a) => a.status === 'CONTRADICTED');

    assert(Boolean(supportedPart), 'Must identify supported assertion');
    assert(Boolean(contradictedPart), 'Must identify contradicted assertion');
    assert(
      Boolean(contradictedPart?.officialFactInstead),
      'Contradicted part must state what official records specify instead'
    );
  });

  // =========================================================================
  // SCENARIO 4: INSUFFICIENT_EVIDENCE — Why can't this claim be verified?
  // =========================================================================
  console.log('\n[SCENARIO 4: INSUFFICIENT EVIDENCE CLAIMS]');
  await runTest('4.1. INSUFFICIENT_EVIDENCE produces heading "Why we cannot verify this claim yet"', () => {
    const claim = 'Government to provide free electric tractors to all farmers next month.';
    const subclaims = ['Government to provide free electric tractors to all farmers next month'];

    const result = evaluateEvidenceForSubclaims(claim, subclaims, []);

    assert(result.verdict === 'INSUFFICIENT_EVIDENCE', `Expected INSUFFICIENT_EVIDENCE, got ${result.verdict}`);
    assert(
      result.reasonExplanation?.verdictHeading === 'Why we cannot verify this claim yet',
      `Expected heading "Why we cannot verify this claim yet", got "${result.reasonExplanation?.verdictHeading}"`
    );
    assert(
      Boolean(result.reasonExplanation?.missingEvidenceReason),
      'Must explain what evidence is missing'
    );
    assert(
      Boolean(
        result.reasonExplanation?.insufficientEvidenceNotice &&
          result.reasonExplanation.insufficientEvidenceNotice.includes('does not prove that this claim is false')
      ),
      'Must explicitly state that insufficient evidence does not prove the claim is false'
    );

    // Verify no assertions are fabricated as contradicted
    const hasFabricatedContradiction = result.reasonExplanation?.assertions.some(
      (a) => a.status === 'CONTRADICTED'
    );
    assert(
      !hasFabricatedContradiction,
      'Must NEVER mark assertions CONTRADICTED when evidence is missing'
    );
  });

  // =========================================================================
  // SCENARIO 5: GUARDRAIL INTEGRITY VALIDATION
  // =========================================================================
  console.log('\n[SCENARIO 5: GUARDRAIL & INTEGRITY VALIDATION]');
  await runTest('5.1. Guardrail rejects invalid reason explanation headings', () => {
    const invalidAnalysis: StructuredVerdictAnalysis = {
      verdict: 'SUPPORTED',
      confidence: 85,
      summaryExplanation: 'Valid summary.',
      reasonExplanation: {
        verdictHeading: 'Totally True Claim', // Invalid heading
        directAnswer: 'Valid answer.',
        assertions: [],
      },
      subclaims: [],
      citations: [],
      evidenceCount: 1,
      verifiedSourcesCount: 1,
      completedAt: new Date().toISOString(),
    };

    const validation = validateVerdictAnalysis(invalidAnalysis, [
      { id: 'ev-1', verification_request_id: 'req-1' },
    ]);
    assert(!validation.isValid, 'Guardrail must reject invalid verdictHeading');
    assert(
      Boolean(validation.error && validation.error.includes('Invalid verdictHeading')),
      'Validation error must identify invalid heading'
    );
  });

  await runTest('5.2. Guardrail rejects fabricated contradictions on zero evidence', () => {
    const fabricatedAnalysis: StructuredVerdictAnalysis = {
      verdict: 'INSUFFICIENT_EVIDENCE',
      confidence: 0,
      summaryExplanation: 'No evidence retrieved.',
      reasonExplanation: {
        verdictHeading: 'Why we cannot verify this claim yet',
        directAnswer: 'Cannot verify.',
        assertions: [
          {
            assertion: 'Electric tractors for all',
            status: 'CONTRADICTED', // Fabricated contradiction without evidence!
            explanation: 'Fake contradiction',
          },
        ],
      },
      subclaims: [],
      citations: [],
      evidenceCount: 0,
      verifiedSourcesCount: 0,
      completedAt: new Date().toISOString(),
    };

    const validation = validateVerdictAnalysis(fabricatedAnalysis, []);
    assert(!validation.isValid, 'Guardrail must reject fabricated contradiction without evidence');
  });

  // =========================================================================
  // SCENARIO 6: FRONTEND WIRING & ROADMAP PRESERVATION
  // =========================================================================
  console.log('\n[SCENARIO 6: FRONTEND WIRING & ROADMAP PRESERVATION]');
  await runTest('6.1. ClaimReasonExplanationSection component file exists and exports valid React component', () => {
    const compPath = path.join(
      process.cwd(),
      'src',
      'components',
      'dashboard',
      'ClaimReasonExplanationSection.tsx'
    );
    assert(fs.existsSync(compPath), 'ClaimReasonExplanationSection.tsx must exist');
    const content = fs.readFileSync(compPath, 'utf8');

    assert(
      content.includes('Why Is This Claim Correct or Wrong?'),
      'Must contain section title "Why Is This Claim Correct or Wrong?"'
    );
    assert(content.includes('Why this claim is correct'), 'Must support heading "Why this claim is correct"');
    assert(content.includes('Why this claim is wrong'), 'Must support heading "Why this claim is wrong"');
    assert(content.includes('What is correct and what is wrong'), 'Must support heading "What is correct and what is wrong"');
    assert(content.includes('Why we cannot verify this claim yet'), 'Must support heading "Why we cannot verify this claim yet"');
    assert(content.includes('Direct Sovereign Source Quotation'), 'Must visually distinguish direct source quotes');
    assert(content.includes('data-testid="claim-reason-explanation-section"'), 'Must have descriptive test ID');
  });

  await runTest('6.2. VerificationConsole.tsx renders ClaimReasonExplanationSection and preserves ActionGuidanceSection', () => {
    const consolePath = path.join(
      process.cwd(),
      'src',
      'components',
      'home',
      'VerificationConsole.tsx'
    );
    assert(fs.existsSync(consolePath), 'VerificationConsole.tsx must exist');
    const content = fs.readFileSync(consolePath, 'utf8');

    assert(
      content.includes('<ClaimReasonExplanationSection'),
      'VerificationConsole.tsx must mount ClaimReasonExplanationSection'
    );
    assert(
      content.includes('<ActionGuidanceSection'),
      'VerificationConsole.tsx must retain ActionGuidanceSection (Scheme Application Roadmap)'
    );

    // Verify order: ClaimReasonExplanationSection before ActionGuidanceSection
    const reasonIndex = content.indexOf('<ClaimReasonExplanationSection');
    const roadmapIndex = content.indexOf('<ActionGuidanceSection');
    assert(
      reasonIndex < roadmapIndex,
      'ClaimReasonExplanationSection must be displayed before ActionGuidanceSection'
    );
  });

  await runTest('6.3. VerificationResultView.tsx renders ClaimReasonExplanationSection and preserves ActionGuidanceSection', () => {
    const viewPath = path.join(
      process.cwd(),
      'src',
      'components',
      'dashboard',
      'VerificationResultView.tsx'
    );
    assert(fs.existsSync(viewPath), 'VerificationResultView.tsx must exist');
    const content = fs.readFileSync(viewPath, 'utf8');

    assert(
      content.includes('<ClaimReasonExplanationSection'),
      'VerificationResultView.tsx must mount ClaimReasonExplanationSection'
    );
    assert(
      content.includes('<ActionGuidanceSection'),
      'VerificationResultView.tsx must retain ActionGuidanceSection (Scheme Application Roadmap)'
    );

    const reasonIndex = content.indexOf('<ClaimReasonExplanationSection');
    const evidenceIndex = content.indexOf('Key Evidence & Sovereign Sources');
    const roadmapIndex = content.indexOf('<ActionGuidanceSection');

    assert(
      reasonIndex < evidenceIndex,
      'ClaimReasonExplanationSection must be displayed immediately below verdict, before evidence cards'
    );
    assert(
      evidenceIndex < roadmapIndex,
      'Evidence cards must precede ActionGuidanceSection'
    );
  });

  console.log('\n================================================================');
  console.log(`CLAIM REASON EXPLANATION TEST SUITE COMPLETE: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
