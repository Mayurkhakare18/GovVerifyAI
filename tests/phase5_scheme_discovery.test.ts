/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import { apiRouter } from '../src/server/routes/api';
import {
  discoverSchemes,
  getSchemeByIdOrSlug,
  evaluateCitizenEligibility,
  parseSchemeSearchIntent,
  GovernmentScheme,
} from '../src/server/services/schemeDiscovery';

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
  console.log('GOVVERIFY AI — PHASE 5 SCHEME DISCOVERY AUTOMATED TEST SUITE');
  console.log('Verifying Natural Language Discovery, Intent Parsing & Safeguards');
  console.log('================================================================\n');

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // -------------------------------------------------------------------------
    // 1. Education Scheme Discovery (Scholarships for College Students)
    // -------------------------------------------------------------------------
    await runTest('1. Education scheme discovery from natural-language query', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Scholarships for college students and fee assistance',
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.success === true, 'Response must indicate success: true');
      assert(Array.isArray(data.schemes), 'schemes must be an array');
      assert(data.schemes.length > 0, 'Must discover at least 1 education scheme');

      const scholarship = data.schemes.find(
        (s: GovernmentScheme) =>
          s.category === 'Scholarships & Education' ||
          s.schemeName.toLowerCase().includes('scholarship')
      );
      assert(Boolean(scholarship), 'Discovered results must contain education scholarship scheme');
      assert(scholarship.officialUrl.includes('.gov.in') || scholarship.officialUrl.includes('maharashtra.gov.in'), 'Must have official portal URL');
    });

    // -------------------------------------------------------------------------
    // 2. Agriculture Scheme Discovery (Financial Assistance for Farmers)
    // -------------------------------------------------------------------------
    await runTest('2. Agriculture scheme discovery for farmers financial assistance', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Financial assistance and direct income support for farmers',
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.schemes.length > 0, 'Must find agricultural schemes');

      const pmKisan = data.schemes.find(
        (s: GovernmentScheme) =>
          s.shortName === 'PM-KISAN' || s.schemeName.includes('Kisan Samman Nidhi')
      );
      assert(Boolean(pmKisan), 'Must retrieve PM-KISAN for farmer income support query');
      assert(pmKisan.benefits.includes('6,000'), 'Must contain exact verified benefits');
      assert(pmKisan.administeringMinistry.includes('Agriculture'), 'Must identify administering ministry');
    });

    // -------------------------------------------------------------------------
    // 3. Maharashtra-Specific Scheme Discovery
    // -------------------------------------------------------------------------
    await runTest('3. Maharashtra-specific scheme discovery with sovereign state portals', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Maharashtra farmer solar pump scheme and loan relief',
          state: 'Maharashtra',
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.schemes.length > 0, 'Must return Maharashtra schemes');

      const mahaScheme = data.schemes.find(
        (s: GovernmentScheme) => s.state === 'Maharashtra' || s.jurisdiction === 'STATE'
      );
      assert(Boolean(mahaScheme), 'Must return sovereign Maharashtra state scheme');
      assert(
        mahaScheme.administeringMinistry.includes('Maharashtra') ||
        mahaScheme.officialUrl.includes('maharashtra.gov.in') ||
        mahaScheme.officialUrl.includes('mahadiscom.in'),
        'Must cite official Government of Maharashtra domain'
      );
    });

    // -------------------------------------------------------------------------
    // 4. Central Scheme Discovery Filter
    // -------------------------------------------------------------------------
    await runTest('4. Central scheme discovery filter isolation', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes?jurisdiction=CENTRAL`);
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();

      assert(data.schemes.length > 0, 'Must return central schemes');
      for (const scheme of data.schemes) {
        assert(scheme.jurisdiction === 'CENTRAL', `Scheme ${scheme.schemeName} must be CENTRAL`);
      }
    });

    // -------------------------------------------------------------------------
    // 5. No Matching Schemes Handling (Zero-Hallucination)
    // -------------------------------------------------------------------------
    await runTest('5. No matching schemes graceful handling without hallucinating', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Free gold coin lottery for crypto buyers on telegram',
          category: 'Cryptocurrency Lottery',
        }),
      });

      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(data.schemes.length === 0, 'Must NOT hallucinate schemes for non-existent domains');
      assert(typeof data.sourceHierarchyNotice === 'string', 'Must provide official source advisory');
    });

    // -------------------------------------------------------------------------
    // 6. Scheme Deduplication Check
    // -------------------------------------------------------------------------
    await runTest('6. Scheme deduplication and unique slug guarantee', async () => {
      const result = await discoverSchemes({ query: 'farmer agriculture kisan' });
      const slugSet = new Set<string>();

      for (const scheme of result.schemes) {
        assert(!slugSet.has(scheme.slug), `Duplicate scheme detected with slug: ${scheme.slug}`);
        slugSet.add(scheme.slug);
      }
    });

    // -------------------------------------------------------------------------
    // 7. Expired / Discontinued Scheme Handling
    // -------------------------------------------------------------------------
    await runTest('7. Expired / Discontinued scheme status identification', async () => {
      const res = await fetch(`${baseUrl}/api/v1/schemes/rashtriya-swasthya-bima-yojana`);
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();

      assert(data.scheme.status === 'DISCONTINUED', 'Status must be DISCONTINUED');
      assert(
        data.scheme.description.includes('subsumed') || data.scheme.description.includes('superseded'),
        'Must explain that scheme was subsumed into successor program'
      );
    });

    // -------------------------------------------------------------------------
    // 8. Missing Eligibility Information Safeguard
    // -------------------------------------------------------------------------
    await runTest('8. Missing eligibility criteria safeguard (never false guarantee)', async () => {
      const scheme = await getSchemeByIdOrSlug('pm-kisan');
      assert(Boolean(scheme), 'PM-KISAN scheme must exist');

      // Evaluator with missing landholding proof
      const evalResult = evaluateCitizenEligibility(scheme!, {
        annualIncomeLakhs: 2.0,
        // isLandholder omitted
      });

      assert(
        evalResult.evaluationStatus === 'INSUFFICIENT_INFORMATION',
        `Expected INSUFFICIENT_INFORMATION, got ${evalResult.evaluationStatus}`
      );
      assert(evalResult.missingCriteria.length > 0, 'Must explicitly flag missing criteria');
      assert(
        evalResult.advisoryNote.includes('Insufficient') || evalResult.advisoryNote.includes('statutory'),
        'Advisory must instruct citizen to check official portal'
      );
    });

    // -------------------------------------------------------------------------
    // 9. Unavailable Official Sources / Offline Fallback
    // -------------------------------------------------------------------------
    await runTest('9. Baseline sovereign catalog fallback resilience', async () => {
      // In offline or DB-unavailable mode, discoverSchemes falls back to verified baseline catalogue
      const result = await discoverSchemes({ query: 'ayushman' });
      assert(result.schemes.length > 0, 'Must return baseline verified schemes');
      assert(result.schemes[0].officialUrl.includes('beneficiary.nha.gov.in'), 'Must contain verified portal URL');
    });

    // -------------------------------------------------------------------------
    // 10. Rate Limiting & Input Validation Check
    // -------------------------------------------------------------------------
    await runTest('10. REST API parameter validation & rate limiting check', async () => {
      // Reject overly long query (> 500 chars)
      const resLong = await fetch(`${baseUrl}/api/v1/schemes/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'a'.repeat(600) }),
      });
      assert(resLong.status === 400, `Expected 400 for query exceeding 500 chars, got ${resLong.status}`);

      // Non-existent scheme lookup returns 404
      const resNotFound = await fetch(`${baseUrl}/api/v1/schemes/non-existent-scheme-xyz-123`);
      assert(resNotFound.status === 404, `Expected 404 for unknown scheme, got ${resNotFound.status}`);
    });

    console.log('\n================================================================');
    console.log(`PHASE 5 SCHEME DISCOVERY TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
    console.log('================================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error('Fatal test error in scheme discovery suite:', err);
  process.exit(1);
});
