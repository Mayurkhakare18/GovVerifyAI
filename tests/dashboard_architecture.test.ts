/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Dashboard Architecture & Security Test Suite
 * Tests SPA Routing, Auth Guards, History Access, Tenant Isolation & Secret Leak Protections
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import express from 'express';
import { apiRouter } from '../src/server/routes/api';
import { getServerSupabase, getSupabaseConfigStatus } from '../src/server/supabase';

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
  console.log('GOVVERIFY AI — DASHBOARD ARCHITECTURE & ROUTE TEST SUITE');
  console.log('Validating Authenticated Dashboard, History, Security & Assets');
  console.log('================================================================\n');

  // Set up Express test server
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api', apiRouter);

  // SPA fallback simulation
  const distPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1. Bundle Secret Leak Protection Audit
    await runTest('1. Client bundle contains zero server secrets or private API keys', async () => {
      if (!fs.existsSync(distPath)) {
        throw new Error('dist/ directory not found. Please run npm run build first.');
      }

      const files = fs.readdirSync(path.join(distPath, 'assets'));
      for (const file of files) {
        if (file.endsWith('.js')) {
          const content = fs.readFileSync(path.join(distPath, 'assets', file), 'utf8');
          // Check that actual private credential secrets from .env are never leaked into the client bundle
          if (process.env.SUPABASE_SECRET_KEY && process.env.SUPABASE_SECRET_KEY.length > 10) {
            assert(!content.includes(process.env.SUPABASE_SECRET_KEY), `File ${file} must not leak SUPABASE_SECRET_KEY credential`);
          }
          if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) {
            assert(!content.includes(process.env.GEMINI_API_KEY), `File ${file} must not leak GEMINI_API_KEY credential`);
          }
        }
      }
    });

    // 2. Protected Route Authentication Gate
    await runTest('2. Unauthenticated access to /api/v1/history rejected with 401', async () => {
      const res = await fetch(`${baseUrl}/api/v1/history`);
      assert(res.status === 401, `Expected 401 UNAUTHENTICATED, got ${res.status}`);
      const data = await res.json();
      assert(data.error === 'UNAUTHENTICATED', 'Error code must be UNAUTHENTICATED');
    });

    // 3. Forged Token Rejected
    await runTest('3. Forged or malformed bearer token rejected with 401 on /api/v1/history', async () => {
      const res = await fetch(`${baseUrl}/api/v1/history`, {
        headers: {
          Authorization: 'Bearer forged-invalid-token-12345',
        },
      });
      assert(res.status === 401, `Expected 401, got ${res.status}`);
    });

    // 4. SPA Route Fallback & Direct Refresh Support
    await runTest('4. Direct URL navigation to /app and dashboard routes serves index.html', async () => {
      const routesToTest = ['/app', '/app/verify', '/app/history', '/app/sources', '/app/profile'];
      for (const route of routesToTest) {
        const res = await fetch(`${baseUrl}${route}`);
        assert(res.status === 200, `Expected 200 for ${route}, got ${res.status}`);
        const html = await res.text();
        assert(html.includes('<div id="root"></div>') || html.includes('GovVerify AI'), `Route ${route} must serve SPA index.html`);
      }
    });

    // 5. Sources Directory API with Grounding Verification
    await runTest('5. GET /api/v1/sources returns indexed government sources with evidence relations', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sources?limit=10`);
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      assert(Array.isArray(data.sources), 'data.sources must be an array');
      assert(typeof data.count === 'number', 'data.count must be number');
      if (data.sources.length > 0) {
        const first = data.sources[0];
        assert(typeof first.title === 'string', 'source title must be string');
        assert(typeof first.domain === 'string', 'source domain must be string');
        assert(Array.isArray(first.evidence), 'source must include joined evidence array');
      }
    });

    // 6. Source Search and Domain Filter
    await runTest('6. GET /api/v1/sources filters accurately by domain keyword', async () => {
      const res = await fetch(`${baseUrl}/api/v1/sources?domain=gov.in&limit=5`);
      assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
      const data = await res.json();
      for (const s of data.sources) {
        assert(s.domain.includes('gov.in'), `Domain '${s.domain}' should match 'gov.in'`);
      }
    });

    // 7. Auto-Confirmation Endpoint Verification
    await runTest('7. POST /api/v1/auth/confirm-email validates input and rejects malformed email', async () => {
      const res = await fetch(`${baseUrl}/api/v1/auth/confirm-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'invalid-email' }),
      });
      assert(res.status === 400, `Expected 400 for invalid email, got ${res.status}`);
    });

    // 8. Existing Verification Intake Contract
    await runTest('8. POST /api/v1/verify intakes claims with status=QUEUED and returns valid UUID', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: 'Government scheme test: Under PM-KUSUM 2025, solar pumps receive subsidy via portal.',
          inputType: 'CLAIM',
        }),
      });
      assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
      const data = await res.json();
      assert(data.status === 'QUEUED', 'Status must be QUEUED');
      assert(typeof data.id === 'string' && data.id.length === 36, 'id must be UUID');
    });

    // 9. Cross-User Record Protection on /api/v1/verify/:id
    await runTest('9. Cross-User Record Protection: Unauthenticated access without guest token is rejected (403)', async () => {
      // Create request with guest token
      const resCreate = await fetch(`${baseUrl}/api/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: 'Confidential citizen inquiry statement for isolation testing.',
          inputType: 'CLAIM',
        }),
      });
      const created = await resCreate.json();

      // Attempt to access without token
      const resAccess = await fetch(`${baseUrl}/api/v1/verify/${created.id}`);
      assert(resAccess.status === 403, `Expected 403 FORBIDDEN without guest token, got ${resAccess.status}`);
    });

    console.log('\n================================================================');
    console.log(`DASHBOARD TEST RESULTS: ${passed} Passed | ${failed} Failed`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
