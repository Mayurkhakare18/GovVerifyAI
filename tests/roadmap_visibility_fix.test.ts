/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Roadmap Feature Visibility & Acceptance Test Suite
 * Validating the Step 5 requirements:
 *  1. Known central scheme roadmap generation & visibility
 *  2. Dynamically discovered state scheme roadmap generation & visibility
 *  3. Scheme mention that is not the subject of the claim (passing mention suppression)
 *  4. Contradicted or suspected-scam claim (fraud alert, protection roadmap)
 *  5. Insufficient-evidence claim (honest notice, safe directories, no fabrication)
 *  6. API failure and visible retry behavior
 *  7. Visible rendering and interaction of the roadmap section
 *  8. Mobile viewport responsiveness tokens and layout integrity
 */

import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';

import fs from 'fs';
import path from 'path';
import {
  generateActionGuidance,
  buildSchemeApplicationRoadmap,
  detectSchemeFromClaimAndEvidence,
  isPassingMention,
} from '../src/server/services/actionGuidance';

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

async function main() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — ROADMAP FEATURE VISIBILITY & ACCEPTANCE SUITE');
  console.log('Validating 8 Core Verification Scenarios for Roadmap Display');
  console.log('================================================================\n');

  console.log('[SECTION 1] Known Central Scheme (PM-KISAN)');
  await runTest('1.1. Known central scheme generates complete 6-stage roadmap with verified portal', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '11111111-2222-3333-4444-555555555555',
      originalClaim: 'PM-KISAN provides 6000 rupees per year to small and marginal farmers in 3 installments.',
      verdict: 'SUPPORTED',
      summaryExplanation: 'PM-KISAN transfers ₹6,000 annually in three equal installments directly into Aadhaar-linked bank accounts.',
    });

    assert(Boolean(guidance.detectedScheme), 'PM-KISAN must be detected');
    assert(guidance.detectedScheme?.schemeId === 'pm-kisan', 'schemeId should be pm-kisan');
    assert(guidance.detectedScheme?.jurisdiction === 'CENTRAL', 'jurisdiction should be CENTRAL');
    assert(Boolean(guidance.roadmap), 'Roadmap must be generated');
    assert(guidance.roadmap?.steps.length === 6, 'Roadmap must have all 6 steps');
    assert(guidance.roadmap?.steps[0].id === 'understand_scheme', 'Step 1 should be understand_scheme');
    assert(guidance.roadmap?.steps[1].id === 'check_eligibility', 'Step 2 should be check_eligibility');
    assert(guidance.roadmap?.steps[2].id === 'prepare_documents', 'Step 3 should be prepare_documents');
    assert(guidance.roadmap?.steps[3].id === 'apply_online_offline', 'Step 4 should be apply_online_offline');
    assert(guidance.roadmap?.steps[4].id === 'track_application', 'Step 5 should be track_application');
    assert(guidance.roadmap?.steps[5].id === 'follow_up_recourse', 'Step 6 should be follow_up_recourse');
    assert(
      Boolean(
        guidance.roadmap?.applicationInstructions.officialPortalUrl?.includes('pmkisan.gov.in') ||
        guidance.service?.officialPortalUrl?.includes('pmkisan.gov.in')
      ),
      'Portal should include pmkisan.gov.in'
    );
  });

  console.log('\n[SECTION 2] Dynamically Discovered State Scheme');
  await runTest('2.1. Dynamically discovered state scheme (Rythu Bandhu - Telangana) generates state roadmap', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '22222222-3333-4444-5555-666666666666',
      originalClaim: 'Telangana farmers receive ₹5,000 per acre under the Rythu Bandhu scheme this Kharif season.',
      verdict: 'SUPPORTED',
      summaryExplanation: 'Government of Telangana provides investment support to farmers per acre per season.',
    });

    assert(Boolean(guidance.detectedScheme), 'State scheme must be detected');
    assert(guidance.detectedScheme?.jurisdiction === 'STATE', 'Jurisdiction must be STATE');
    assert(guidance.detectedScheme?.stateOrUtName === 'Telangana', 'State must be Telangana');
    assert(guidance.detectedScheme?.isDynamicallyDiscovered === true, 'Must be dynamically discovered');
    assert(Boolean(guidance.roadmap), 'Roadmap must be generated for dynamic state scheme');
    assert(guidance.roadmap?.jurisdiction === 'STATE', 'Roadmap jurisdiction must be STATE');
    assert(guidance.roadmap?.stateOrUtName === 'Telangana', 'Roadmap state must be Telangana');
    assert(
      Boolean(
        guidance.roadmap?.applicationInstructions.officialPortalUrl?.includes('telangana.gov.in') ||
        guidance.detectedScheme?.schemeInformationUrl?.includes('telangana.gov.in')
      ),
      'Official portal must match state domain'
    );
  });

  console.log('\n[SECTION 3] Scheme Mention Not Subject of Claim (Passing Mention Suppression)');
  await runTest('3.1. Passing comparison to a known scheme is suppressed and does not generate false roadmap', async () => {
    const claim = 'This private loan app is fast, unlike PM Kisan which requires land registration.';
    const passing = isPassingMention(claim, ['pm kisan']);
    assert(passing === true, 'Must identify "unlike PM Kisan" as passing mention');

    const detected = detectSchemeFromClaimAndEvidence({ originalClaim: claim });
    assert(detected === null, 'Passing comparison should not trigger scheme guidance');
  });

  console.log('\n[SECTION 4] Contradicted or Suspected-Scam Claim');
  await runTest('4.1. Contradicted claim generates fraud protection roadmap, blocking false application links', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '33333333-4444-5555-6666-777777777777',
      originalClaim: 'PM-KISAN is charging a mandatory ₹500 registration fee on WhatsApp.',
      verdict: 'CONTRADICTED',
      summaryExplanation: 'PIB Fact Check confirmed no such fee exists. The message is fraudulent phishing.',
    });

    assert(guidance.verdict === 'CONTRADICTED', 'Verdict must be CONTRADICTED');
    assert(guidance.hasActionableService === false, 'Cannot have actionable application service');
    assert(guidance.advisoryType === 'CONTRADICTED_ALERT', 'Advisory type must be CONTRADICTED_ALERT');
    assert(guidance.service?.isPortalVerified === false, 'Portal must not be verified as application link');
    assert(Boolean(guidance.service?.grievanceOrContact?.helplinePhone?.includes('1930')), 'Helpline must point to Cyber Crime 1930');
    assert(Boolean(guidance.roadmap), 'Roadmap must provide factual correction and protection guidance');
    assert(guidance.roadmap!.unsupportedClaimNotice!.includes('Misinformation Warning'), 'Must show prominent misinformation warning');
  });

  console.log('\n[SECTION 5] Insufficient-Evidence Claim');
  await runTest('5.1. Insufficient-evidence claim provides honest notice, safe directories, and no invented benefits', async () => {
    const guidance = await generateActionGuidance({
      verificationRequestId: '44444444-5555-6666-7777-888888888888',
      originalClaim: 'Did the government just release a new PM Surya Ghar expansion order?',
      verdict: 'INSUFFICIENT_EVIDENCE',
      summaryExplanation: 'No gazette, policy paper, or official ministry statement exists regarding such an expansion.',
    });

    assert(guidance.verdict === 'INSUFFICIENT_EVIDENCE', 'Verdict must be INSUFFICIENT_EVIDENCE');
    assert(guidance.hasActionableService === false, 'hasActionableService must be false');
    assert(guidance.advisoryType === 'UNVERIFIED_SAFE_SEARCH', 'advisoryType must be UNVERIFIED_SAFE_SEARCH');
    assert(Boolean(guidance.roadmap), 'Roadmap provides independently verified sovereign scheme rules');
    assert(guidance.roadmap!.unsupportedClaimNotice!.includes('Unverified Claim Notice'), 'Must separate unverified claim from verified facts');
  });

  console.log('\n[SECTION 6] API Failure and Visible Retry State');
  await runTest('6.1. ActionGuidanceSection component source defines visible error card and retry button', async () => {
    const componentPath = path.resolve('src/components/dashboard/ActionGuidanceSection.tsx');
    const content = fs.readFileSync(componentPath, 'utf8');

    assert(content.includes('id="action-guidance-error-card"'), 'Component must include id="action-guidance-error-card"');
    assert(content.includes('id="retry-guidance-btn"'), 'Component must include id="retry-guidance-btn"');
    assert(content.includes('onClick={() => fetchGuidance()}'), 'Retry button must invoke fetchGuidance()');
    assert(content.includes('loadError ||'), 'Must visibly display the error message');
  });

  console.log('\n[SECTION 7] Visible Rendering and Interaction of Roadmap Section');
  await runTest('7.1. Component includes contextual prompt, step preview, explore button, and fallback notice', async () => {
    const componentPath = path.resolve('src/components/dashboard/ActionGuidanceSection.tsx');
    const content = fs.readFileSync(componentPath, 'utf8');

    // Prompt element
    assert(content.includes('id="contextual-scheme-prompt"'), 'Must have id="contextual-scheme-prompt"');
    // Explore CTA
    assert(content.includes('id="explore-scheme-btn"'), 'Must have id="explore-scheme-btn"');
    // 6-step preview bar
    assert(content.includes('ROADMAP_STEPS_METADATA.map'), 'Must render visual step preview');
    // Stepper card
    assert(content.includes('id="evidence-grounded-roadmap-card"'), 'Must have id="evidence-grounded-roadmap-card"');
    // Safe fallback when no scheme identified
    assert(content.includes('id="no-scheme-identified-notice"'), 'Must have id="no-scheme-identified-notice"');
    assert(content.includes('myscheme.gov.in'), 'Fallback must link to myScheme Portal');
    assert(content.includes('services.india.gov.in'), 'Fallback must link to National Services Directory');
  });

  console.log('\n[SECTION 8] Parent Component Wiring & Mobile Viewport Tokens');
  await runTest('8.1. VerificationResultDetail passes guestToken and VerificationResultView mounts ActionGuidanceSection', async () => {
    const detailPath = path.resolve('src/components/dashboard/VerificationResultDetail.tsx');
    const detailContent = fs.readFileSync(detailPath, 'utf8');

    assert(
      detailContent.includes('guestToken={record.guest_session_token'),
      'VerificationResultDetail must pass record.guest_session_token as guestToken'
    );

    const viewPath = path.resolve('src/components/dashboard/VerificationResultView.tsx');
    const viewContent = fs.readFileSync(viewPath, 'utf8');

    assert(viewContent.includes('<ActionGuidanceSection'), 'VerificationResultView must mount ActionGuidanceSection');
    assert(viewContent.includes('guestToken={guestToken}'), 'VerificationResultView must forward guestToken');

    const guidancePath = path.resolve('src/components/dashboard/ActionGuidanceSection.tsx');
    const guidanceContent = fs.readFileSync(guidancePath, 'utf8');

    // Check responsive grid tokens for mobile (375px) vs desktop
    assert(guidanceContent.includes('grid-cols-1 sm:grid-cols-2') || guidanceContent.includes('grid-cols-2 sm:grid-cols-6'), 'Must use responsive grid tokens');
    assert(guidanceContent.includes('flex flex-col sm:flex-row'), 'Must use responsive flex layout for mobile viewports');
  });

  console.log('\n================================================================');
  console.log(`ROADMAP VISIBILITY SUITE: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
