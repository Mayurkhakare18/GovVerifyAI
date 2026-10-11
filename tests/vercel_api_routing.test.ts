/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Vercel API Routing & Non-JSON Sanitization Test Suite
 * Validates:
 * 1. Bundled Serverless handler (api/index.js) execution and clean export.
 * 2. Root API status (/api) returning HTTP 200 JSON.
 * 3. Health check (/api/health) returning valid JSON.
 * 4. Edge proxy rewrites with 'x-matched-path' normalizing URLs for Express router.
 * 5. Authentication gates returning valid JSON errors (401/403) instead of HTML.
 * 6. Unknown API routes returning JSON 404 (ENDPOINT_NOT_FOUND) instead of HTML/text.
 * 7. safeFetchJson handling valid JSON, sanitized non-JSON 404s, and 500 FUNCTION_INVOCATION_FAILED.
 * 8. Zero JSON parse SyntaxErrors thrown across any non-JSON responses.
 */

import http from 'http';
import handler from '../api/index.js';
import { safeFetchJson, fetchJsonOrThrow } from '../src/utils/safeFetch';

const PORT = 9899;
let server: http.Server;

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — VERCEL API ROUTING & JSON SANITIZATION TEST SUITE');
  console.log('================================================================\n');

  // Start local HTTP server backed by the bundled Vercel serverless function
  server = http.createServer((req, res) => {
    handler(req, res);
  });

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => resolve());
  });

  const baseUrl = `http://localhost:${PORT}`;

  try {
    // 1. Root API status (/api)
    process.stdout.write('• Testing: 1. Root API status /api returns 200 JSON... ');
    const r1 = await fetch(`${baseUrl}/api`);
    const c1 = r1.headers.get('content-type') || '';
    assert(r1.status === 200, `Expected status 200, got ${r1.status}`);
    assert(c1.includes('application/json'), `Expected application/json, got ${c1}`);
    const data1 = await r1.json();
    assert(data1.status === 'online', 'Expected status: online');
    assert(data1.name === 'GovVerify AI API', 'Expected name match');
    console.log('PASSED');

    // 2. Health check (/api/health)
    process.stdout.write('• Testing: 2. Health check /api/health returns valid JSON... ');
    const r2 = await fetch(`${baseUrl}/api/health`);
    const c2 = r2.headers.get('content-type') || '';
    assert(c2.includes('application/json'), `Expected application/json, got ${c2}`);
    const data2 = await r2.json();
    assert(typeof data2.status === 'string', 'Expected status string in health response');
    console.log('PASSED');

    // 3. Edge proxy rewrite normalization (x-matched-path: /api/health to /api/index.js)
    process.stdout.write('• Testing: 3. Edge proxy x-matched-path routing restores intended path... ');
    const r3 = await fetch(`${baseUrl}/api/index.js`, {
      headers: { 'x-matched-path': '/api/health' },
    });
    const c3 = r3.headers.get('content-type') || '';
    assert(c3.includes('application/json'), `Expected application/json, got ${c3}`);
    const data3 = await r3.json();
    assert(typeof data3.status === 'string', 'Expected health data from rewritten path');
    console.log('PASSED');

    // 4. Unauthenticated access to /api/v1/auth/me returns 401 JSON
    process.stdout.write('• Testing: 4. Unauthenticated /api/v1/auth/me returns 401 JSON (not HTML)... ');
    const r4 = await fetch(`${baseUrl}/api/v1/auth/me`);
    assert(r4.status === 401, `Expected status 401, got ${r4.status}`);
    const c4 = r4.headers.get('content-type') || '';
    assert(c4.includes('application/json'), `Expected application/json, got ${c4}`);
    const data4 = await r4.json();
    assert(data4.error === 'UNAUTHENTICATED', 'Expected UNAUTHENTICATED error code');
    console.log('PASSED');

    // 5. Unauthenticated access to /api/v1/history returns 401 JSON
    process.stdout.write('• Testing: 5. Unauthenticated /api/v1/history returns 401 JSON... ');
    const r5 = await fetch(`${baseUrl}/api/v1/history`);
    assert(r5.status === 401, `Expected status 401, got ${r5.status}`);
    const c5 = r5.headers.get('content-type') || '';
    assert(c5.includes('application/json'), `Expected application/json, got ${c5}`);
    const data5 = await r5.json();
    assert(data5.error === 'UNAUTHENTICATED', 'Expected UNAUTHENTICATED error code');
    console.log('PASSED');

    // 6. Representative sources access (/api/v1/sources) returns JSON
    process.stdout.write('• Testing: 6. Sources endpoint /api/v1/sources returns valid JSON... ');
    const r6 = await fetch(`${baseUrl}/api/v1/sources`);
    const c6 = r6.headers.get('content-type') || '';
    assert(c6.includes('application/json'), `Expected application/json, got ${c6}`);
    const data6 = await r6.json();
    assert(Array.isArray(data6.sources), 'Expected sources array');
    console.log('PASSED');

    // 7. Unknown API route returns JSON 404 (ENDPOINT_NOT_FOUND) rather than HTML
    process.stdout.write('• Testing: 7. Unknown API path /api/v1/does_not_exist returns JSON 404... ');
    const r7 = await fetch(`${baseUrl}/api/v1/does_not_exist`);
    assert(r7.status === 404, `Expected status 404, got ${r7.status}`);
    const c7 = r7.headers.get('content-type') || '';
    assert(c7.includes('application/json'), `Expected application/json, got ${c7}`);
    const data7 = await r7.json();
    assert(data7.error === 'ENDPOINT_NOT_FOUND', `Expected ENDPOINT_NOT_FOUND, got ${data7.error}`);
    console.log('PASSED');

    // 8. safeFetchJson with valid JSON endpoint
    process.stdout.write('• Testing: 8. safeFetchJson parses valid JSON successfully... ');
    const sf1 = await safeFetchJson<{ status: string }>(`${baseUrl}/api/health`);
    assert(sf1.ok === true || sf1.status === 200 || sf1.status === 503, 'Expected valid status');
    assert(sf1.error === null || typeof sf1.error === 'string', 'Expected structured response');
    console.log('PASSED');

    // 9. safeFetchJson with non-JSON 404 ("The page could not be found")
    process.stdout.write('• Testing: 9. safeFetchJson prevents SyntaxError on Vercel 404 text response... ');
    // Mock non-JSON response in a dummy endpoint
    const mockServer = http.createServer((_req, res) => {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('The page could not be found\n\nNOT_FOUND\n\nbom1::test-404-token\n');
    });
    await new Promise<void>((res) => mockServer.listen(9898, () => res()));

    const sf2 = await safeFetchJson('http://localhost:9898/api/v1/history');
    assert(sf2.ok === false, 'Expected ok: false for 404');
    assert(sf2.status === 404, 'Expected status 404');
    assert(Boolean(sf2.error && !sf2.error.includes('Unexpected token')), 'Must NOT contain SyntaxError message');
    assert(Boolean(sf2.error && sf2.error.includes('API endpoint not found (HTTP 404)')), 'Must contain clean friendly 404 explanation');
    console.log('PASSED');

    // 10. safeFetchJson with non-JSON 500 ("FUNCTION_INVOCATION_FAILED")
    process.stdout.write('• Testing: 10. safeFetchJson prevents SyntaxError on Vercel 500 crash response... ');
    const mockServer500 = http.createServer((_req, res) => {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('A server error has occurred\n\nFUNCTION_INVOCATION_FAILED\n\nbom1::test-500-token\n');
    });
    await new Promise<void>((res) => mockServer500.listen(9897, () => res()));

    const sf3 = await safeFetchJson('http://localhost:9897/api/health');
    assert(sf3.ok === false, 'Expected ok: false for 500');
    assert(sf3.status === 500, 'Expected status 500');
    assert(Boolean(sf3.error && !sf3.error.includes('Unexpected token')), 'Must NOT contain SyntaxError message');
    assert(Boolean(sf3.error && sf3.error.includes('API internal error (HTTP 500)')), 'Must contain clean friendly 500 explanation');
    console.log('PASSED');

    // 11. fetchJsonOrThrow throws sanitized error without JSON parsing exceptions
    process.stdout.write('• Testing: 11. fetchJsonOrThrow throws actionable Error without SyntaxError... ');
    try {
      await fetchJsonOrThrow('http://localhost:9898/api/v1/history');
      assert(false, 'Expected fetchJsonOrThrow to throw');
    } catch (err: any) {
      assert(!err.message.includes('Unexpected token'), 'Must NOT be a SyntaxError');
      assert(err.message.includes('API endpoint not found'), 'Must be a clean sanitized error');
    }
    console.log('PASSED');

    mockServer.close();
    mockServer500.close();

    console.log('\n================================================================');
    console.log('VERCEL API ROUTING TEST RESULTS: 11 Passed | 0 Failed');
    console.log('Zero SyntaxError Exceptions Confirmed');
    console.log('================================================================\n');
  } finally {
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
