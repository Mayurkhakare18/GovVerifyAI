/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Document Extraction & Verification Audit Test Suite
 * Validates file signature checks, PDF page limits, filename sanitization,
 * PII redaction, Gemini extraction resilience, guest-token ownership,
 * and verification pipeline isolation.
 */

import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { apiRouter } from '../src/server/routes/api';
import {
  validateFileSignature,
  inspectPdfPageCount,
  sanitizeFilename,
  redactSensitiveInformation,
  validateExtractionModelOutput,
  extractClaimsFromDocument,
  computeSha256,
  MAX_FILE_SIZE_BYTES,
  MAX_PDF_PAGE_COUNT,
} from '../src/server/services/documentExtraction';

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

// Helper to construct sample valid buffers
function createMockPngBuffer(): Buffer {
  // Valid PNG signature: 89 50 4E 47 0D 0A 1A 0A
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

function createMockJpegBuffer(): Buffer {
  // Valid JPEG signature: FF D8 FF
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
}

function createMockWebpBuffer(): Buffer {
  // Valid WebP signature: RIFF....WEBP
  const buf = Buffer.alloc(16);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(12, 4);
  buf.write('WEBP', 8, 'ascii');
  return buf;
}

function createMockPdfBuffer(pagesCount: number = 1): Buffer {
  // Valid PDF header %PDF-1.4 with specified /Type /Page objects
  let body = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  body += `2 0 obj\n<< /Type /Pages /Count ${pagesCount} /Kids [`;
  for (let i = 1; i <= pagesCount; i++) {
    body += `${i + 2} 0 R `;
  }
  body += '] >>\nendobj\n';
  for (let i = 1; i <= pagesCount; i++) {
    body += `${i + 2} 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n`;
  }
  body += '%%EOF\n';
  return Buffer.from(body, 'latin1');
}

async function main() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — STEP 2 DOCUMENT EXTRACTION TEST SUITE');
  console.log('Validation, Privacy, Ingestion, Ownership & Security Auditing');
  console.log('================================================================\n');

  // Set up in-process Express server
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // ==========================================================================
    // SECTION 1: SIGNATURE & FORMAT VALIDATION
    // ==========================================================================
    console.log('[SECTION 1] File Signatures, MIME Matching & Bounds Enforcement');

    await runTest('1.1. Valid PNG, JPEG, WebP, and PDF signatures accepted', async () => {
      const pngCheck = validateFileSignature(createMockPngBuffer(), 'image/png');
      assert(pngCheck.isValid, `PNG should be valid: ${pngCheck.error}`);
      assert(pngCheck.detectedMime === 'image/png', 'Detected MIME must be image/png');

      const jpegCheck = validateFileSignature(createMockJpegBuffer(), 'image/jpeg');
      assert(jpegCheck.isValid, `JPEG should be valid: ${jpegCheck.error}`);
      assert(jpegCheck.detectedMime === 'image/jpeg', 'Detected MIME must be image/jpeg');

      // Also check image/jpg alias normalization
      const jpgAliasCheck = validateFileSignature(createMockJpegBuffer(), 'image/jpg');
      assert(jpgAliasCheck.isValid, 'image/jpg alias must be normalized and accepted');

      const webpCheck = validateFileSignature(createMockWebpBuffer(), 'image/webp');
      assert(webpCheck.isValid, `WebP should be valid: ${webpCheck.error}`);
      assert(webpCheck.detectedMime === 'image/webp', 'Detected MIME must be image/webp');

      const pdfCheck = validateFileSignature(createMockPdfBuffer(1), 'application/pdf');
      assert(pdfCheck.isValid, `PDF should be valid: ${pdfCheck.error}`);
      assert(pdfCheck.detectedMime === 'application/pdf', 'Detected MIME must be application/pdf');
    });

    await runTest('1.2. MIME spoofing: Disguised text or executable rejected', async () => {
      const fakePng = Buffer.from('This is a plain text file pretending to be PNG');
      const check = validateFileSignature(fakePng, 'image/png');
      assert(!check.isValid, 'Spoofed PNG must be rejected');
      assert(Boolean(check.error?.includes('Unsupported') || check.error?.includes('signature')), 'Clear signature error required');

      const mismatchCheck = validateFileSignature(createMockJpegBuffer(), 'image/png');
      assert(!mismatchCheck.isValid, 'MIME mismatch (JPEG bytes declared as PNG) must be rejected');
      assert(Boolean(mismatchCheck.error?.includes('Declared MIME type')), 'MIME mismatch error required');
    });

    await runTest('1.3. SVG and HTML injection vectors explicitly blocked', async () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const svgCheck = validateFileSignature(svgBuffer, 'image/png');
      assert(!svgCheck.isValid, 'SVG vector must be rejected');
      assert(Boolean(svgCheck.error?.includes('SVG files are strictly disallowed')), 'SVG security rejection required');

      const htmlBuffer = Buffer.from('<!doctype html><html><body><h1>Fake Document</h1></body></html>');
      const htmlCheck = validateFileSignature(htmlBuffer, 'application/pdf');
      assert(!htmlCheck.isValid, 'HTML disguised as PDF must be rejected');
      assert(Boolean(htmlCheck.error?.includes('HTML and script files are strictly disallowed')), 'HTML security rejection required');
    });

    await runTest('1.3b. Valid PNG containing embedded SVG/XML metadata is accepted as image/png', async () => {
      // Construct a valid PNG buffer that contains an embedded SVG metadata payload inside an ancillary chunk
      const pngHeader = createMockPngBuffer(); // Starts with 89 50 4E 47 0D 0A 1A 0A
      const metadataPayload = Buffer.from('iTXtXML:com.adobe.xmp<svg width="716" height="716" viewBox="0 0 716 716" xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>');
      const combinedPng = Buffer.concat([pngHeader, metadataPayload]);

      const check = validateFileSignature(combinedPng, 'image/png', 'generated_test_image.png');
      assert(check.isValid, `Valid PNG with embedded SVG metadata must be accepted: ${check.error}`);
      assert(check.detectedMime === 'image/png', 'Detected signature must be image/png');
    });

    await runTest('1.3c. Real public/image.png is detected using PNG signature and image/png MIME', async () => {
      const imagePath = path.join(process.cwd(), 'public/image.png');
      assert(fs.existsSync(imagePath), 'public/image.png must exist');
      const realBuffer = fs.readFileSync(imagePath);

      const check = validateFileSignature(realBuffer, 'image/png', 'image.png');
      assert(check.isValid, `Real test PNG must be valid: ${check.error}`);
      assert(check.detectedMime === 'image/png', 'Real test PNG must be detected as image/png');
    });

    await runTest('1.3d. Renamed and disguised SVG files are strictly rejected', async () => {
      // 1. Declared SVG MIME type is rejected immediately
      const declaredSvg = validateFileSignature(Buffer.from('<svg></svg>'), 'image/svg+xml');
      assert(!declaredSvg.isValid, 'Declared image/svg+xml must be rejected');
      assert(Boolean(declaredSvg.error?.includes('SVG files are strictly disallowed')), 'SVG security notice required');

      // 2. Renamed SVG disguised with .png extension and image/png MIME
      const renamedSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
      const renamedCheck = validateFileSignature(renamedSvg, 'image/png', 'malicious.png');
      assert(!renamedCheck.isValid, 'Renamed SVG file disguised as PNG must be rejected');
      assert(Boolean(renamedCheck.error?.includes('SVG files are strictly disallowed')), 'Must reject as SVG despite .png name');

      // 3. SVG with XML declaration disguised as PNG
      const xmlSvg = Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle r="50"/></svg>');
      const xmlSvgCheck = validateFileSignature(xmlSvg, 'image/png', 'renamed_vector.png');
      assert(!xmlSvgCheck.isValid, 'XML-declared SVG disguised as PNG must be rejected');
      assert(Boolean(xmlSvgCheck.error?.includes('SVG files are strictly disallowed')), 'Must reject as SVG');

      // 4. SVG with leading comments and whitespace
      const commentedSvg = Buffer.from('   <!-- generator: illustrator -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      const commentedCheck = validateFileSignature(commentedSvg, 'image/png', 'commented.png');
      assert(!commentedCheck.isValid, 'SVG with comments must be rejected');
      assert(Boolean(commentedCheck.error?.includes('SVG files are strictly disallowed')), 'Must reject as SVG');
    });

    await runTest('1.4. Empty files and oversized buffers rejected', async () => {
      const emptyCheck = validateFileSignature(Buffer.alloc(0), 'image/png');
      assert(!emptyCheck.isValid, 'Empty buffer must be rejected');

      const oversizedCheck = validateFileSignature(Buffer.alloc(MAX_FILE_SIZE_BYTES + 10), 'image/png');
      assert(!oversizedCheck.isValid, 'Oversized buffer must be rejected');
      assert(Boolean(oversizedCheck.error?.includes('exceeds the allowable limit')), 'Size error required');
    });

    await runTest('1.5. PDF page count inspection: <=5 pages allowed, >5 rejected', async () => {
      const singlePage = createMockPdfBuffer(1);
      const check1 = inspectPdfPageCount(singlePage);
      assert(check1.isWithinLimit, '1-page PDF must be within limit');
      assert(check1.pageCount === 1, `Expected 1 page, got ${check1.pageCount}`);

      const fivePages = createMockPdfBuffer(5);
      const check5 = inspectPdfPageCount(fivePages);
      assert(check5.isWithinLimit, '5-page PDF must be within limit');
      assert(check5.pageCount === 5, `Expected 5 pages, got ${check5.pageCount}`);

      const sixPages = createMockPdfBuffer(6);
      const check6 = inspectPdfPageCount(sixPages);
      assert(!check6.isWithinLimit, '6-page PDF must be rejected');
      assert(Boolean(check6.error?.includes('exceeds maximum allowed length')), 'Page limit error required');
    });

    await runTest('1.6. Filename sanitization against path traversal and null bytes', async () => {
      const clean1 = sanitizeFilename('../../etc/passwd.pdf', 'pdf');
      assert(!clean1.includes('..') && !clean1.includes('/'), 'Must strip directory traversal');
      assert(clean1.endsWith('.pdf'), 'Must preserve extension');

      const clean2 = sanitizeFilename('malicious\0file\r\nname<script>.png', 'png');
      assert(!clean2.includes('\0') && !clean2.includes('<') && !clean2.includes('>'), 'Must strip control chars');

      const clean3 = sanitizeFilename('   ', 'png');
      assert(clean3.startsWith('document_'), 'Must use safe fallback for empty filename');
    });

    // ==========================================================================
    // SECTION 2: PRIVACY & PII REDACTION
    // ==========================================================================
    console.log('\n[SECTION 2] Privacy Shield: Sensitive PII Redaction');

    await runTest('2.1. Redaction of Indian Aadhaar, PAN, and Mobile numbers', async () => {
      const textWithPii =
        'Citizen Ramesh Kumar (Aadhaar: 4567 8901 2345, PAN: ABCDE1234F, Mobile: +91 9876543210) applied for PM-KISAN subsidy of Rs 6,000.';
      const { redactedText, redactionsCount } = redactSensitiveInformation(textWithPii);

      assert(redactionsCount === 3, `Expected 3 redactions, got ${redactionsCount}`);
      assert(!redactedText.includes('4567 8901 2345'), 'Aadhaar must not be present');
      assert(!redactedText.includes('ABCDE1234F'), 'PAN must not be present');
      assert(!redactedText.includes('9876543210'), 'Phone number must not be present');
      assert(redactedText.includes('[AADHAAR_REDACTED]'), 'Must contain [AADHAAR_REDACTED]');
      assert(redactedText.includes('[PAN_REDACTED]'), 'Must contain [PAN_REDACTED]');
      assert(redactedText.includes('[PHONE_REDACTED]'), 'Must contain [PHONE_REDACTED]');
      assert(redactedText.includes('PM-KISAN'), 'Policy text must be preserved');
      assert(redactedText.includes('6,000'), 'Factual amount must be preserved');
    });

    // ==========================================================================
    // SECTION 3: EXTRACTION LOGIC & MODEL OUTPUT VALIDATION
    // ==========================================================================
    console.log('\n[SECTION 3] Extraction Logic, Structured Schema & Fault Resilience');

    await runTest('3.1. Structured Gemini extraction output validator', async () => {
      const validPayload = {
        status: 'SUCCESS',
        extractedTextPreview: 'Ministry of Agriculture circular announces...',
        observedPageCount: 1,
        candidateClaims: [
          {
            claimText: 'PM-KISAN installment increased to Rs 4,000 per family for FY 2026.',
            category: 'Scheme & Subsidy',
            context: 'Paragraph 1',
            confidence: 95,
          },
        ],
        warnings: [],
      };

      const result = validateExtractionModelOutput(validPayload);
      assert(result.isValid, `Valid output must pass: ${result.error}`);
      assert(result.sanitizedOutput?.status === 'SUCCESS', 'Status must be SUCCESS');
      assert(result.sanitizedOutput?.candidateClaims.length === 1, 'Should contain 1 claim');
    });

    await runTest('3.2. Empty claims reclassified as NO_FACTUAL_CLAIMS_FOUND', async () => {
      const noClaimsPayload = {
        status: 'SUCCESS',
        extractedTextPreview: 'Happy Diwali greetings from the department staff to all visitors.',
        candidateClaims: [],
        warnings: [],
      };

      const result = validateExtractionModelOutput(noClaimsPayload);
      assert(result.isValid, 'Should pass schema validation');
      assert(
        result.sanitizedOutput?.status === 'NO_FACTUAL_CLAIMS_FOUND',
        `Expected NO_FACTUAL_CLAIMS_FOUND, got ${result.sanitizedOutput?.status}`
      );
    });

    await runTest('3.3. Unreadable document status recognized and handled cleanly', async () => {
      const unreadablePayload = {
        status: 'UNREADABLE_DOCUMENT',
        extractedTextPreview: '',
        candidateClaims: [],
        warnings: ['Resolution too low to transcribe text'],
      };

      const result = validateExtractionModelOutput(unreadablePayload);
      assert(result.isValid, 'Should be valid');
      assert(result.sanitizedOutput?.status === 'UNREADABLE_DOCUMENT', 'Status must be UNREADABLE_DOCUMENT');
    });

    await runTest('3.4. Simulated provider quota exhaustion (429) throws typed error', async () => {
      try {
        await extractClaimsFromDocument(createMockPngBuffer(), 'image/png', 'sample.png', {
          forceQuotaError: true,
        });
        assert(false, 'Should have thrown quota error');
      } catch (err: any) {
        assert(err.status === 429, `Expected HTTP 429, got ${err.status}`);
        assert(err.message.includes('quota capacity'), 'Must provide clear citizen-friendly message');
      }
    });

    await runTest('3.5. Simulated provider timeout (504) throws typed error', async () => {
      try {
        await extractClaimsFromDocument(createMockPngBuffer(), 'image/png', 'sample.png', {
          forceTimeoutError: true,
        });
        assert(false, 'Should have thrown timeout error');
      } catch (err: any) {
        assert(err.status === 504, `Expected HTTP 504, got ${err.status}`);
      }
    });

    // ==========================================================================
    // SECTION 4: API ENDPOINT INTEGRATION & ISOLATION
    // ==========================================================================
    console.log('\n[SECTION 4] API Endpoints: Ingestion, Verification Linkage & Ownership');

    await runTest('4.1. POST /api/v1/documents/extract rejects request with no file', async () => {
      const res = await fetch(`${baseUrl}/api/v1/documents/extract`, {
        method: 'POST',
      });
      assert(res.status === 400, `Expected 400 Bad Request, got ${res.status}`);
      const json = await res.json();
      assert(json.error === 'NO_FILE_PROVIDED', `Expected NO_FILE_PROVIDED, got ${json.error}`);
    });

    await runTest('4.2. POST /api/v1/documents/extract processes valid file with guest token', async () => {
      const formData = new FormData();
      const pngBlob = new Blob([new Uint8Array(createMockPngBuffer())], { type: 'image/png' });
      formData.append('file', pngBlob, 'gazette_2026.png');

      const mockExtractionPayload = {
        status: 'SUCCESS' as const,
        extractedTextPreview: 'Ministry notification announces 60% subsidy for solar pumps under PM-KUSUM.',
        candidateClaims: [
          {
            id: 'c-1',
            claimText: 'Government announces 60% solar pump subsidy under PM-KUSUM 2026.',
            category: 'Scheme & Subsidy',
            confidence: 90,
          },
        ],
      };
      formData.append('options', JSON.stringify({ mockExtraction: mockExtractionPayload }));

      const res = await fetch(`${baseUrl}/api/v1/documents/extract`, {
        method: 'POST',
        body: formData,
      });

      assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
      const json = await res.json();
      assert(json.status === 'SUCCESS', `Expected status SUCCESS, got ${json.status}`);
      assert(Boolean(json.documentId), 'Must return documentId');
      assert(Boolean(json.guestToken), 'Must establish guestToken for unauthenticated session');
      assert(json.candidateClaims.length === 1, 'Must return 1 candidate claim');
      assert(json.candidateClaims[0].claimText.includes('60% solar pump subsidy'), 'Candidate claim text matches');
      assert(json.extractedTextPreview.includes('Ministry notification'), 'Extracted preview matches');
    });

    await runTest('4.3. POST /api/v1/verify preserves regular text claim verification (inputType=CLAIM)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: 'Government provides annual direct income support of ₹6,000 under PM-KISAN scheme.',
          inputType: 'CLAIM',
          skipDiscovery: true,
        }),
      });

      assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
      const json = await res.json();
      assert(json.inputType === 'CLAIM', `Expected inputType CLAIM, got ${json.inputType}`);
      assert(json.status === 'QUEUED', 'Status must be QUEUED');
      assert(json.documentId === null, 'Ordinary claim must have null documentId');
      assert(Boolean(json.guestToken), 'Guest token established');
    });

    await runTest('4.4. Verification pipeline isolation: Extracted text never becomes verification evidence', async () => {
      // Create verification request
      const res = await fetch(`${baseUrl}/api/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim: 'Viral screenshot claims all senior citizens receive free railway travel starting next month.',
          inputType: 'CLAIM',
          skipDiscovery: true,
        }),
      });

      const json = await res.json();
      const requestId = json.id;
      const guestToken = json.guestToken;

      // Fetch request details
      const detailRes = await fetch(`${baseUrl}/api/v1/verify/${requestId}`, {
        headers: { 'X-Guest-Token': guestToken },
      });
      assert(detailRes.status === 200, `Expected 200, got ${detailRes.status}`);
      const detailJson = await detailRes.json();

      // Ensure evidence table is completely empty prior to independent external retrieval
      const evidenceList = detailJson.data.evidence || [];
      assert(
        evidenceList.length === 0,
        'Intake claims must NEVER self-populate public.evidence without independent sovereign discovery!'
      );
    });

    await runTest('4.5. Unauthorized deletion rejected when guest token is missing or mismatched', async () => {
      const randomUuid = crypto.randomUUID();
      const deleteRes = await fetch(`${baseUrl}/api/v1/documents/${randomUuid}`, {
        method: 'DELETE',
        headers: { 'X-Guest-Token': 'wrong-token-123456789012345678901234' },
      });

      // Should be 404 (if not found in DB) or 403 (if mismatched token)
      assert(
        deleteRes.status === 404 || deleteRes.status === 403,
        `Expected 404 or 403, got ${deleteRes.status}`
      );
    });

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
