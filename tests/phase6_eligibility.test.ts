/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { apiRouter } from '../src/server/routes/api';
import { getSchemeByIdOrSlug } from '../src/server/services/schemeDiscovery';
import {
  evaluatePersonalizedEligibility,
  sanitizeAndValidateProfile,
} from '../src/server/services/eligibilityEngine';

let passedTests = 0;
let failedTests = 0;

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
  console.log('GOVVERIFY AI — PHASE 6 ELIGIBILITY ASSESSMENT ENGINE TEST SUITE');
  console.log('Verifying Independent Condition Auditing, Document Readiness & Privacy');
  console.log('================================================================\n');

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Fetch test schemes from sovereign catalogue
    const mahaScholarship = await getSchemeByIdOrSlug('sch-maha-shahu-maharaj');
    const pmKisan = await getSchemeByIdOrSlug('sch-pm-kisan');
    const solarScheme = await getSchemeByIdOrSlug('sch-maha-saur-pump');
    const pmSvanidhi = await getSchemeByIdOrSlug('sch-pm-svanidhi');

    assert(mahaScholarship !== null, 'MahaDBT Shahu Maharaj scheme must exist in catalogue');
    assert(pmKisan !== null, 'PM-KISAN scheme must exist in catalogue');
    assert(solarScheme !== null, 'Maharashtra Solar Pump scheme must exist in catalogue');
    assert(pmSvanidhi !== null, 'PM SVANidhi scheme must exist in catalogue');

    // -------------------------------------------------------------------------
    // Scenario 1: Citizen Satisfies All Official Mandatory Conditions
    // -------------------------------------------------------------------------
    await runTest('1. Citizen satisfies all official conditions (POTENTIALLY_ELIGIBLE)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-maha-shahu-maharaj',
          citizenProfile: {
            state: 'Maharashtra',
            annualIncomeLakhs: 3.5,
            isCollegeEnrolled: true,
            attendancePercentage: 75,
            declaredDocuments: [
              'Maharashtra Domicile Certificate',
              'Income Certificate issued by Tahsildar for current financial year',
              'HSC / Degree marksheets',
              'Fee receipt and College Bonafide certificate',
              'Aadhaar Card linked to bank account',
              'Ration card',
            ],
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Response must indicate success: true');
      const assessment = data.assessment;
      assert(assessment.overallStatus === 'POTENTIALLY_ELIGIBLE', `Expected POTENTIALLY_ELIGIBLE, got ${assessment.overallStatus}`);
      assert(Array.isArray(assessment.conditionBreakdown), 'Must contain condition breakdown');
      assert(
        assessment.conditionBreakdown.every((c: any) => c.outcome === 'SATISFIED' || !c.isMandatory),
        'All mandatory conditions must be SATISFIED'
      );
      assert(
        assessment.mandatoryDisclaimer.includes('GovVerify AI provides informational guidance only'),
        'Must contain mandatory non-entitlement disclaimer'
      );
    });

    // -------------------------------------------------------------------------
    // Scenario 2: Citizen Fails a Mandatory Condition (Income Ceiling Exceeded)
    // -------------------------------------------------------------------------
    await runTest('2. Citizen fails mandatory condition (CRITERIA_UNMET)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-maha-shahu-maharaj',
          citizenProfile: {
            state: 'Maharashtra',
            annualIncomeLakhs: 12.0, // Exceeds 8.0 Lakh ceiling
            isCollegeEnrolled: true,
            attendancePercentage: 80,
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      const assessment = data.assessment;
      assert(assessment.overallStatus === 'CRITERIA_UNMET', `Expected CRITERIA_UNMET, got ${assessment.overallStatus}`);
      const failedCond = assessment.conditionBreakdown.find((c: any) => c.outcome === 'NOT_SATISFIED');
      assert(failedCond !== undefined, 'Must identify the specific condition that failed');
      assert(failedCond.reason.includes('exceeds'), 'Reason must explain income ceiling exceeded');
      assert(failedCond.sourceCitation.title.length > 0, 'Must include sovereign source citation for failure');
    });

    // -------------------------------------------------------------------------
    // Scenario 3: Missing Annual Income Information (INSUFFICIENT_INFORMATION)
    // -------------------------------------------------------------------------
    await runTest('3. Missing income information returns INSUFFICIENT_INFORMATION', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-maha-shahu-maharaj',
          citizenProfile: {
            state: 'Maharashtra',
            // annualIncomeLakhs is deliberately omitted
            isCollegeEnrolled: true,
            attendancePercentage: 75,
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      const assessment = data.assessment;
      assert(
        assessment.overallStatus === 'INSUFFICIENT_INFORMATION',
        `Expected INSUFFICIENT_INFORMATION, got ${assessment.overallStatus}`
      );
      const unknownCond = assessment.conditionBreakdown.find(
        (c: any) => c.outcome === 'UNKNOWN' && c.conditionText.toLowerCase().includes('income')
      );
      assert(unknownCond !== undefined, 'Income condition must be marked UNKNOWN');
      assert(unknownCond.reason.includes('income ceiling'), 'Reason must prompt for annual family income');
    });

    // -------------------------------------------------------------------------
    // Scenario 4: Missing or Mismatched Domicile State
    // -------------------------------------------------------------------------
    await runTest('4. Domicile state mismatch returns CRITERIA_UNMET for state schemes', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-maha-shahu-maharaj',
          citizenProfile: {
            state: 'Gujarat', // Scheme requires Maharashtra
            annualIncomeLakhs: 4.0,
            isCollegeEnrolled: true,
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      const assessment = data.assessment;
      assert(assessment.overallStatus === 'CRITERIA_UNMET', 'Mismatch in state must yield CRITERIA_UNMET');
      const stateCond = assessment.conditionBreakdown.find((c: any) =>
        c.conditionText.toLowerCase().includes('domicile')
      );
      assert(stateCond.outcome === 'NOT_SATISFIED', 'Domicile condition must be NOT_SATISFIED');
      assert(stateCond.reason.includes('Maharashtra'), 'Reason must specify statutory state requirement');
    });

    // -------------------------------------------------------------------------
    // Scenario 5: Multiple Mandatory Criteria (One Fails, One Missing)
    // -------------------------------------------------------------------------
    await runTest('5. Multiple criteria: failure takes precedence over missing (CRITERIA_UNMET)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-maha-shahu-maharaj',
          citizenProfile: {
            state: 'Karnataka', // Fails domicile (NOT_SATISFIED)
            // annualIncomeLakhs is missing (UNKNOWN)
            isCollegeEnrolled: true,
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      const assessment = data.assessment;
      assert(
        assessment.overallStatus === 'CRITERIA_UNMET',
        'Failure must take precedence over incomplete information'
      );
      const hasNotSatisfied = assessment.conditionBreakdown.some((c: any) => c.outcome === 'NOT_SATISFIED');
      const hasUnknown = assessment.conditionBreakdown.some((c: any) => c.outcome === 'UNKNOWN');
      assert(hasNotSatisfied && hasUnknown, 'Must accurately reflect both failed and unknown conditions');
    });

    // -------------------------------------------------------------------------
    // Scenario 6: Optional / Alternative Criteria (NOT_APPLICABLE pathways)
    // -------------------------------------------------------------------------
    await runTest('6. Optional/alternative criteria handles NOT_APPLICABLE pathways', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-maha-saur-pump',
          citizenProfile: {
            state: 'Maharashtra',
            isLandholder: true,
            hasElectricityConnection: true, // Has grid connection, off-grid pump branch is not applicable
            declaredDocuments: ['Land 7/12 extract', 'Aadhaar Card'],
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      const assessment = data.assessment;
      const notApplicableCond = assessment.conditionBreakdown.find(
        (c: any) => c.outcome === 'NOT_APPLICABLE'
      );
      assert(notApplicableCond !== undefined, 'Alternative pathway must yield NOT_APPLICABLE');
      assert(notApplicableCond.reason.includes('pathway applies'), 'Reason must explain alternative pathway');
    });

    // -------------------------------------------------------------------------
    // Scenario 7: Incomplete/Ambiguous Official Criteria Handling
    // -------------------------------------------------------------------------
    await runTest('7. Incomplete/ambiguous conditions handled with UNKNOWN and official advice', async () => {
      const assessment = await evaluatePersonalizedEligibility(pmKisan!, {
        // Omits both landholder and tax status
        state: 'Maharashtra',
      });

      assert(
        assessment.overallStatus === 'INSUFFICIENT_INFORMATION',
        'Ambiguous/incomplete input must yield INSUFFICIENT_INFORMATION'
      );
      const landCond = assessment.conditionBreakdown.find((c) =>
        c.conditionText.toLowerCase().includes('cultivable land')
      );
      assert(landCond?.outcome === 'UNKNOWN', 'Unspecified agricultural status must be UNKNOWN');
      assert(!landCond?.reason.includes('approved'), 'Engine must never fabricate approval');
    });

    // -------------------------------------------------------------------------
    // Scenario 8: Document Readiness Checker (Available, Missing, Validity Check)
    // -------------------------------------------------------------------------
    await runTest('8. Document readiness categorizes Available, Missing, and Validity Checks', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-maha-shahu-maharaj',
          citizenProfile: {
            state: 'Maharashtra',
            annualIncomeLakhs: 2.5,
            isCollegeEnrolled: true,
            declaredDocuments: [
              'Maharashtra Domicile Certificate', // Available
              'Income Certificate issued by Tahsildar for current financial year', // Requires Validity Check (annual renewal)
              // HSC / Marksheets missing
            ],
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      const docReadiness = data.assessment.documentReadiness;
      assert(docReadiness.totalRequired > 0, 'Must have required documents');
      assert(docReadiness.availableCount >= 1, 'At least 1 document must be AVAILABLE');
      assert(docReadiness.validityCheckCount >= 1, 'Income certificate must be marked REQUIRES_VALIDITY_CHECK');
      assert(docReadiness.missingCount >= 1, 'Unprovided documents must be marked MISSING');

      const incomeDoc = docReadiness.checklist.find((d: any) =>
        d.documentName.toLowerCase().includes('income')
      );
      assert(incomeDoc !== undefined, 'Income doc must be in checklist');
      assert(incomeDoc.issuingAuthority.includes('Tahsildar'), 'Must cite Tahsildar as official issuing authority');
      assert(incomeDoc.howToObtain.includes('Aaple Sarkar'), 'Must cite official state e-portal Aaple Sarkar');
    });

    // -------------------------------------------------------------------------
    // Scenario 9: Alternative Scheme Recommendations on CRITERIA_UNMET
    // -------------------------------------------------------------------------
    await runTest('9. Unmet criteria triggers up to 3 non-entitled alternative scheme suggestions', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-maha-shahu-maharaj',
          citizenProfile: {
            state: 'Maharashtra',
            annualIncomeLakhs: 15.0, // Fails income threshold
            isCollegeEnrolled: true,
          },
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      const assessment = data.assessment;
      assert(assessment.overallStatus === 'CRITERIA_UNMET', 'Status must be CRITERIA_UNMET');
      assert(Array.isArray(assessment.alternativeSchemes), 'Must recommend alternative schemes');
      assert(assessment.alternativeSchemes.length > 0, 'Must return at least 1 alternative scheme');
      assert(assessment.alternativeSchemes.length <= 3, 'Must return at most 3 alternative schemes');
      assert(
        assessment.alternativeSchemes[0].evaluationNotice.includes('Preliminary recommendation'),
        'Must include explicit warning that alternative requires separate individual evaluation'
      );
      assert(
        !assessment.alternativeSchemes.some((s: any) => s.id === 'sch-maha-shahu-maharaj'),
        'Must not recommend the same failed scheme as an alternative'
      );
    });

    // -------------------------------------------------------------------------
    // Scenario 10: Privacy and Security Safeguards (Reject Aadhaar, PAN, Bank data)
    // -------------------------------------------------------------------------
    await runTest('10. Privacy safeguards reject Aadhaar, PAN, and credentials', async () => {
      // Test 10a: Explicit Aadhaar field
      const resAadhaarKey = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-pm-kisan',
          citizenProfile: {
            state: 'Maharashtra',
            aadhaarNumber: '234567891012',
          },
        }),
      });
      assert(resAadhaarKey.status === 400, `Expected 400 for Aadhaar key, got ${resAadhaarKey.status}`);
      const dataAadhaar = await resAadhaarKey.json();
      assert(dataAadhaar.error === 'PRIVACY_SAFEGUARD_VIOLATION', 'Must identify privacy safeguard violation');

      // Test 10b: 12-digit Aadhaar pattern embedded in text
      const resAadhaarPattern = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-pm-kisan',
          citizenProfile: {
            occupation: 'Farmer UID 4455 6677 8899',
          },
        }),
      });
      assert(resAadhaarPattern.status === 400, `Expected 400 for embedded Aadhaar pattern, got ${resAadhaarPattern.status}`);

      // Test 10c: Bank account key
      const resBank = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-pm-kisan',
          citizenProfile: {
            bankAccountNumber: '98765432101234',
          },
        }),
      });
      assert(resBank.status === 400, `Expected 400 for bank account key, got ${resBank.status}`);

      // Test 10d: Password / OTP key
      const resOtp = await fetch(`${baseUrl}/api/v1/schemes/evaluate-eligibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schemeId: 'sch-pm-kisan',
          citizenProfile: {
            otp: '123456',
          },
        }),
      });
      assert(resOtp.status === 400, `Expected 400 for OTP key, got ${resOtp.status}`);
    });

    console.log('\n================================================================');
    console.log(`PHASE 6 ELIGIBILITY ASSESSMENT TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
    console.log('================================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error('Fatal test error in eligibility assessment suite:', err);
  process.exit(1);
});
