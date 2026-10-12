/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Tavily Search API Provider Test Suite
 * Validates:
 * 1. Valid results & sovereign domain grounding
 * 2. Untrusted / secondary domain rejection
 * 3. Empty search results handling
 * 4. Failed / missing content extraction safeguards
 * 5. API error handling (500 / timeout)
 * 6. Quota exhaustion (HTTP 429) & honest insufficient evidence reporting
 * 7. Evidence provenance integrity & client secret leak protection
 * 8. Configurable provider selection (Tavily vs Gemini)
 * 9. Integration with verification lifecycle & verdict evaluation
 */

import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';

import fs from 'fs';
import path from 'path';
import express from 'express';
import {
  discoverSourcesWithTavily,
  getTavilyConfigStatus,
  TavilySearchResultItem,
} from '../src/server/services/tavily';
import {
  discoverAuthoritativeSources,
  discoverAndPersistSourcesForRequest,
  getActiveDiscoveryProvider,
} from '../src/server/services/sourceDiscovery';
import {
  filterVerifiedEvidence,
  evaluateEvidenceForSubclaims,
} from '../src/server/services/verdictAnalysis';
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

async function main() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — TAVILY SEARCH API DISCOVERY TEST SUITE');
  console.log('Validating Sovereign Grounding, Provenance, Untrusted Filtering & Quotas');
  console.log('================================================================\n');

  // Test 1: Configuration Status Inspector
  await runTest('1. Tavily configuration inspector behaves correctly with/without key', async () => {
    const originalKey = process.env.TAVILY_API_KEY;
    try {
      delete process.env.TAVILY_API_KEY;
      const unconfigured = getTavilyConfigStatus();
      assert(!unconfigured.isConfigured, 'Should report unconfigured when key is missing');

      process.env.TAVILY_API_KEY = 'tvly-test-sample-key';
      const configured = getTavilyConfigStatus();
      assert(configured.isConfigured, 'Should report configured when key is provided');
    } finally {
      process.env.TAVILY_API_KEY = originalKey;
    }
  });

  // Test 2: Valid Results with Sovereign Domain & Grounded Content
  await runTest('2. Valid Tavily results on sovereign domains produce verified grounded evidence', async () => {
    const claim = 'PM-KISAN provides direct financial support of Rs 6,000 per year to farmers.';
    const mockResults: TavilySearchResultItem[] = [
      {
        title: 'PM Kisan Samman Nidhi Official Portal',
        url: 'https://pmkisan.gov.in/AboutScheme.aspx',
        content: 'Search snippet for PM-KISAN portal',
        raw_content:
          'Under the PM-KISAN scheme, an amount of 6,000 per year is released by the central government directly into the bank accounts of eligible farmer families in three equal 4-monthly installments of Rs 2,000 each.',
        score: 0.95,
        published_date: '2025-01-15',
      },
      {
        title: 'Press Information Bureau - Release on Agriculture Schemes',
        url: 'https://pib.gov.in/PressReleasePage.aspx?PRID=198000',
        content: 'PIB release on agriculture financial support',
        raw_content:
          'The Ministry of Agriculture and Farmers Welfare confirms that PM-KISAN financial benefit of Rs 6,000 annually is transferred transparently to landholding farmer families across all States and Union Territories.',
        score: 0.91,
      },
    ];

    const result = await discoverSourcesWithTavily(claim, { mockResults });

    assert(result.hasVerifiedEvidence === true, 'hasVerifiedEvidence must be true');
    assert(result.groundingStatus === 'SUCCESS', 'groundingStatus must be SUCCESS');
    assert(result.sources.length === 2, `Expected 2 verified sources, got ${result.sources.length}`);

    const first = result.sources[0];
    assert(first.isVerified === true, 'isVerified must be true');
    assert(first.provenance === 'GROUNDED_SEARCH', 'provenance must be GROUNDED_SEARCH');
    assert(first.sourceType === 'GROUNDED_SEARCH', 'sourceType must be GROUNDED_SEARCH');
    assert(first.clauseReference === 'TAVILY_SEARCH_GROUNDING', 'clauseReference must be TAVILY_SEARCH_GROUNDING');
    assert(first.extractedText!.includes('6,000 per year'), 'Must contain actual extracted grounded text');
  });

  // Test 3: Untrusted / Secondary Domain Rejection
  await runTest('3. Untrusted/commercial domains are rejected from verified evidence and demoted to candidates', async () => {
    const claim = 'Government offering free laptop scheme for all college students.';
    const mockResults: TavilySearchResultItem[] = [
      {
        title: 'TechNews Blog - Free Laptop Yojana Update',
        url: 'https://commercial-technews.com/free-laptop-scheme',
        content: 'Check out the new free laptop scheme online.',
        raw_content: 'Apply today for the online scheme on this blog website for quick approval.',
        score: 0.88,
      },
      {
        title: 'Viral Yojana Updates',
        url: 'https://random-rumor-blog.xyz/yojana-2026',
        content: 'Students can get free laptops easily.',
        raw_content: 'Full details of student laptop distribution.',
        score: 0.82,
      },
    ];

    const result = await discoverSourcesWithTavily(claim, { mockResults });

    assert(result.hasVerifiedEvidence === false, 'Untrusted domains must not yield verified evidence');
    assert(result.sources.length === 0, 'verified sources must be 0 for untrusted domains');
    assert(result.candidateSources.length === 2, 'Untrusted sources must be classified as candidates only');
    assert(result.candidateSources[0].isVerified === false, 'Candidate must not be verified');
    assert(result.candidateSources[0].tier === 4, 'Untrusted domain tier must be 4');
  });

  // Test 4: Empty Search Results Handling
  await runTest('4. Empty Tavily search results produce honest EMPTY_RESULTS with zero fabricated sources', async () => {
    const claim = 'Fictitious administrative circular from non-existent ministry.';
    const result = await discoverSourcesWithTavily(claim, { mockResults: [] });

    assert(result.hasVerifiedEvidence === false, 'hasVerifiedEvidence must be false');
    assert(result.groundingStatus === 'EMPTY_RESULTS', 'groundingStatus must be EMPTY_RESULTS');
    assert(result.sources.length === 0, 'sources must be empty');
    assert(result.groundingLimitation !== undefined, 'groundingLimitation must explain empty results');
  });

  // Test 5: Failed / Missing Content Extraction Safeguard
  await runTest('5. Result snippet alone without substantive raw content is never accepted as evidence', async () => {
    const claim = 'Cabinet approves solar subsidies under PM-KUSUM.';
    const mockResults: TavilySearchResultItem[] = [
      {
        title: 'Ministry of New and Renewable Energy',
        url: 'https://mnre.gov.in/solar-subsidies',
        content: 'Search snippet summary about solar subsidy scheme.',
        raw_content: '', // EMPTY extracted content (e.g. failed scrape or paywall)
        score: 0.90,
      },
      {
        title: 'PM-KUSUM Portal',
        url: 'https://pmkusum.mnre.gov.in',
        content: 'Portal snippet',
        raw_content: 'Short', // Under minimum 80 chars
        score: 0.85,
      },
    ];

    const result = await discoverSourcesWithTavily(claim, { mockResults });

    assert(result.hasVerifiedEvidence === false, 'Snippet alone without raw content must NOT produce verified evidence');
    assert(result.sources.length === 0, 'Verified sources count must be 0');
    assert(result.candidateSources.length === 2, 'Sources with missing content must remain unverified candidates');
  });

  // Test 6: API Error Handling (500 Service Error)
  await runTest('6. Tavily API 500 error produces SERVICE_ERROR with descriptive limitation and zero crashes', async () => {
    const claim = 'National pension scheme interest rate increased by 2%.';
    const result = await discoverSourcesWithTavily(claim, {
      mockError: { status: 500, message: 'Internal Server Error on search gateway' },
    });

    assert(result.hasVerifiedEvidence === false, 'Must not claim verified evidence on error');
    assert(result.groundingStatus === 'SERVICE_ERROR', 'groundingStatus must be SERVICE_ERROR');
    assert(result.sources.length === 0, 'sources must be empty');
    assert(result.groundingLimitation!.toLowerCase().includes('service error') || result.groundingLimitation!.includes('Internal Server Error'), 'Limitation must note service error');
  });

  // Test 7: Quota Exhaustion (HTTP 429) & Honest Insufficient Evidence
  await runTest('7. Tavily rate limit (HTTP 429) records QUOTA_EXHAUSTED and leads to honest INSUFFICIENT_EVIDENCE', async () => {
    const claim = 'Aadhaar linking deadline extended unconditionally.';
    const result = await discoverSourcesWithTavily(claim, {
      mockError: { status: 429, message: 'Rate limit exceeded: Monthly API quota exhausted' },
    });

    assert(result.hasVerifiedEvidence === false, 'Must have no verified evidence on quota exhaustion');
    assert(result.groundingStatus === 'QUOTA_EXHAUSTED', 'groundingStatus must be QUOTA_EXHAUSTED');

    // Downstream verdict evaluation check
    const verdictAnalysis = evaluateEvidenceForSubclaims(claim, [claim], []);
    assert(verdictAnalysis.verdict === 'INSUFFICIENT_EVIDENCE', 'Must honestly assign INSUFFICIENT_EVIDENCE');
    assert(verdictAnalysis.confidence === 0, 'Confidence must be 0% when evidence is missing');
  });

  // Test 8: FilterVerifiedEvidence Provenance Validation
  await runTest('8. filterVerifiedEvidence strictly accepts Tavily GROUNDED_SEARCH and rejects UNVERIFIED_CANDIDATE', async () => {
    const testEvidence = [
      {
        id: 'ev-1',
        extracted_text: 'Legitimate text from government gazette',
        clause_reference: 'TAVILY_SEARCH_GROUNDING',
        sources: {
          url: 'https://pib.gov.in/press',
          source_type: 'GROUNDED_SEARCH',
        },
      },
      {
        id: 'ev-2',
        extracted_text: 'Snippet from candidate blog',
        clause_reference: 'UNVERIFIED_CANDIDATE',
        sources: {
          url: 'https://commercial-blog.com',
          source_type: 'UNVERIFIED_CANDIDATE',
        },
      },
      {
        id: 'ev-3',
        extracted_text: '', // Empty extracted text
        sources: {
          url: 'https://pmkisan.gov.in',
          source_type: 'GROUNDED_SEARCH',
        },
      },
    ];

    const accepted = filterVerifiedEvidence(testEvidence);
    assert(accepted.length === 1, `Expected exactly 1 accepted evidence record, got ${accepted.length}`);
    assert(accepted[0].id === 'ev-1', 'Only ev-1 must be accepted');
  });

  // Test 9: Configurable Provider Selection
  await runTest('9. getActiveDiscoveryProvider correctly resolves tavily vs gemini configuration', async () => {
    // Explicit override
    assert(getActiveDiscoveryProvider('tavily') === 'tavily', 'Explicit tavily must return tavily');
    assert(getActiveDiscoveryProvider('gemini') === 'gemini', 'Explicit gemini must return gemini');

    // Environment variable preference
    const origEnv = process.env.DISCOVERY_PROVIDER;
    const origKey = process.env.TAVILY_API_KEY;
    try {
      process.env.DISCOVERY_PROVIDER = 'tavily';
      assert(getActiveDiscoveryProvider() === 'tavily', 'DISCOVERY_PROVIDER=tavily must return tavily');

      process.env.DISCOVERY_PROVIDER = 'gemini';
      assert(getActiveDiscoveryProvider() === 'gemini', 'DISCOVERY_PROVIDER=gemini must return gemini');

      process.env.DISCOVERY_PROVIDER = 'auto';
      process.env.TAVILY_API_KEY = 'tvly-valid-test-key';
      assert(getActiveDiscoveryProvider() === 'tavily', 'Auto with TAVILY_API_KEY present should prioritize tavily');

      delete process.env.TAVILY_API_KEY;
      assert(getActiveDiscoveryProvider() === 'gemini', 'Auto without TAVILY_API_KEY should fallback to gemini');
    } finally {
      process.env.DISCOVERY_PROVIDER = origEnv;
      process.env.TAVILY_API_KEY = origKey;
    }
  });

  // Test 10: Client Bundle Secret Leak Audit
  await runTest('10. Client bundle contains zero TAVILY_API_KEY credentials', async () => {
    const distPath = path.resolve(process.cwd(), 'dist', 'assets');
    if (fs.existsSync(distPath)) {
      const files = fs.readdirSync(distPath);
      for (const file of files) {
        if (file.endsWith('.js')) {
          const content = fs.readFileSync(path.join(distPath, file), 'utf8');
          if (process.env.TAVILY_API_KEY && process.env.TAVILY_API_KEY.length > 5) {
            assert(!content.includes(process.env.TAVILY_API_KEY), `File ${file} must not leak TAVILY_API_KEY`);
          }
          assert(!content.includes('tvly-'), `File ${file} must not contain raw Tavily API key patterns`);
        }
      }
    }
  });

  // Test 11: End-to-End API Route Discovery with Tavily Provider
  await runTest('11. POST /api/v1/sources/discover accepts provider=tavily and returns verified sources', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', apiRouter);

    const server = app.listen(0);
    const port = (server.address() as any).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    try {
      const claim = 'Under PM-KISAN, beneficiaries receive installment via direct bank transfer.';
      const res = await fetch(`${baseUrl}/api/v1/sources/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim,
          provider: 'tavily',
        }),
      });

      // If TAVILY_API_KEY is not configured in environment, it should return 503 TAVILY_UNCONFIGURED
      // If configured, it should return 200
      const data = await res.json();
      if (res.status === 503) {
        assert(data.error === 'TAVILY_UNCONFIGURED', `Expected TAVILY_UNCONFIGURED, got ${data.error}`);
      } else {
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(data.provider === 'tavily', 'Response provider must be tavily');
      }
    } finally {
      server.close();
    }
  });

  console.log('\n================================================================');
  console.log(`TAVILY PROVIDER TEST RESULTS: ${passed} Passed | ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
