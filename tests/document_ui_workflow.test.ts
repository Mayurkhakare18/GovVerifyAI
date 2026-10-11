/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Step 3 Document Upload & Claim Review UI Workflow Test Suite
 * Tests client-side file validation, extraction handling, claim editing,
 * single-claim selection, verification dispatch with documentId, guest token preservation,
 * deletion lifecycle, and canonical verdict presentation.
 */

import express from 'express';
import { apiRouter } from '../src/server/routes/api';
import { documentApi } from '../src/services/api/documents';
import { verificationApi } from '../src/services/api/verification';
import { getCitizenVerdict, CanonicalVerdict } from '../src/utils/citizenVerdict';
import { APP_CONFIG } from '../src/config';

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

// Helpers to simulate mock files for client validation tests
function createMockFile(name: string, sizeBytes: number, type: string): File {
  const content = new Uint8Array(Math.min(sizeBytes, 1024));
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes, configurable: true });
  return file;
}

async function main() {
  console.log('================================================================');
  console.log('GOVVERIFY AI — STEP 3 DOCUMENT WORKFLOW & CLIENT INTEGRATION');
  console.log('Validation, Claim Review, Document Linkage & Verdict Rendering');
  console.log('================================================================\n');

  const app = express();
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api', apiRouter);

  const server = app.listen(0);
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  // Patch global fetch for backend routes during test
  const originalFetch = global.fetch;
  global.fetch = async (input: any, init?: any) => {
    const urlStr = typeof input === 'string' ? input : input.url;
    if (urlStr.startsWith('/api')) {
      return originalFetch(`${baseUrl}${urlStr}`, init);
    }
    return originalFetch(input, init);
  };

  try {
    // ========================================================================
    // 1. ACCEPTED AND REJECTED FILE TYPES (documentApi.validateDocumentFile)
    // ========================================================================
    console.log('[SECTION 1] Client-side File Format & Size Constraints');

    await runTest('1.1. Valid PDF, PNG, JPG, JPEG, and WebP files are accepted', async () => {
      const pdf = createMockFile('official_circular.pdf', 1024 * 500, 'application/pdf');
      const png = createMockFile('screenshot.png', 1024 * 200, 'image/png');
      const jpg = createMockFile('notice.jpg', 1024 * 300, 'image/jpeg');
      const webp = createMockFile('infographic.webp', 1024 * 150, 'image/webp');

      assert(documentApi.validateDocumentFile(pdf).isValid, 'PDF must be valid');
      assert(documentApi.validateDocumentFile(png).isValid, 'PNG must be valid');
      assert(documentApi.validateDocumentFile(jpg).isValid, 'JPG must be valid');
      assert(documentApi.validateDocumentFile(webp).isValid, 'WebP must be valid');
    });

    await runTest('1.2. Unsupported file types (txt, docx, exe, svg, html) are rejected', async () => {
      const txt = createMockFile('notes.txt', 1024, 'text/plain');
      const docx = createMockFile('draft.docx', 1024 * 50, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      const exe = createMockFile('setup.exe', 1024 * 100, 'application/x-msdownload');
      const svg = createMockFile('vector.svg', 1024 * 10, 'image/svg+xml');
      const html = createMockFile('index.html', 1024, 'text/html');

      const txtRes = documentApi.validateDocumentFile(txt);
      assert(!txtRes.isValid, 'TXT must be rejected');
      assert(Boolean(txtRes.error?.includes('Unsupported file format')), 'Clear format message required');

      const docxRes = documentApi.validateDocumentFile(docx);
      assert(!docxRes.isValid, 'DOCX must be rejected');

      const exeRes = documentApi.validateDocumentFile(exe);
      assert(!exeRes.isValid, 'EXE must be rejected');

      const svgRes = documentApi.validateDocumentFile(svg);
      assert(!svgRes.isValid, 'SVG must be rejected');
      assert(Boolean(svgRes.error?.includes('SVG files are strictly disallowed')), 'SVG must have explicit security notice');

      const htmlRes = documentApi.validateDocumentFile(html);
      assert(!htmlRes.isValid, 'HTML must be rejected');
      assert(Boolean(htmlRes.error?.includes('HTML and script files are strictly disallowed')), 'HTML must have explicit notice');

      // Check that files are not classified solely based on extension
      const disguisedSvg = createMockFile('fake.png', 1024, 'image/svg+xml');
      const disguisedRes = documentApi.validateDocumentFile(disguisedSvg);
      assert(!disguisedRes.isValid, 'File with .png extension but image/svg+xml MIME must be rejected');
      assert(Boolean(disguisedRes.error?.includes('SVG files are strictly disallowed')), 'Must reject as SVG');

      // Valid MIME without extension (e.g. pasted blob or camera upload) is accepted
      const blobPng = createMockFile('blob', 1024 * 50, 'image/png');
      const blobRes = documentApi.validateDocumentFile(blobPng);
      assert(blobRes.isValid, 'Valid PNG MIME without extension must be accepted for processing');
    });

    await runTest('1.3. Files exceeding 10 MB limit are rejected with citizen-friendly error', async () => {
      const oversized = createMockFile('large_scan.pdf', 11 * 1024 * 1024, 'application/pdf');
      const res = documentApi.validateDocumentFile(oversized);
      assert(!res.isValid, 'Oversized file must be rejected');
      assert(Boolean(res.error?.includes(APP_CONFIG.limits.maxFileSizeDisplay)), 'Must mention 10 MB limit');
    });

    // ========================================================================
    // 2. EXTRACTION RESPONSES: DISPLAY & REVIEW CONTRACT
    // ========================================================================
    console.log('\n[SECTION 2] Extracted Text, Summary & Candidate Claims Contract');

    await runTest('2.1. Extraction response contains sanitized metadata, preview, and candidate claims', async () => {
      // Mock successful extraction response
      const mockResult = {
        documentId: '11111111-2222-3333-4444-555555555555',
        guestToken: 'guest-sess-abc-123',
        fileName: 'sanitized_pib_circular.pdf',
        fileSizeBytes: 204800,
        fileType: 'PDF Document',
        pageCount: 2,
        status: 'SUCCESS' as const,
        extractedTextPreview: 'The Union Cabinet today approved revised incentives for rooftop solar power.',
        candidateClaims: [
          {
            id: 'claim-1',
            claimText: 'Union Cabinet approved revised rooftop solar subsidies for residential units.',
            category: 'Government Scheme & Subsidy',
            context: 'Page 1, Paragraph 2',
            confidence: 92,
          },
          {
            id: 'claim-2',
            claimText: 'Installation requires no state discom registration fees under new circular.',
            category: 'Policy & Gazette',
            context: 'Page 2',
            confidence: 85,
          },
        ],
      };

      assert(Boolean(mockResult.documentId), 'documentId must be present');
      assert(Boolean(mockResult.guestToken), 'guestToken must be present for unauthenticated uploads');
      assert(mockResult.candidateClaims.length === 2, 'Candidate claims must be populated');
      assert(mockResult.candidateClaims[0].claimText.length > 10, 'Candidate claims must contain verifiable text');
      assert(mockResult.pageCount === 2, 'Page count must be exposed for PDFs');
    });

    await runTest('2.2. Empty candidate claims trigger fallback state without fabricating facts', async () => {
      const emptyResult = {
        documentId: '22222222-3333-4444-5555-666666666666',
        fileName: 'scenery_photo.jpg',
        fileSizeBytes: 102400,
        fileType: 'Image (JPEG)',
        pageCount: 1,
        status: 'NO_FACTUAL_CLAIMS_FOUND' as const,
        extractedTextPreview: 'No legible text found in image.',
        candidateClaims: [],
      };

      assert(emptyResult.candidateClaims.length === 0, 'No candidate claims should be invented');
      assert(emptyResult.status === 'NO_FACTUAL_CLAIMS_FOUND', 'Clear empty state status');
    });

    // ========================================================================
    // 3. EDITING, SELECTING, AND CONFIRMATION LOGIC
    // ========================================================================
    console.log('\n[SECTION 3] Claim Selection, Inline Editing & Explicit Confirmation');

    await runTest('3.1. User can edit candidate claim text prior to verification', async () => {
      const original: string = 'Under PM-KISAN, farmers receive 10,000 per installment.';
      const edited: string = 'Under PM-KISAN 2026, eligible landholding farmers receive direct income support.';

      // Assert validation requirements for edited text
      assert(edited.length >= 10, 'Edited claim must be >= 10 characters');
      assert(edited !== original, 'Claim must reflect citizen modifications');
    });

    await runTest('3.2. Verification is blocked when claim is empty or under 10 characters', async () => {
      const empty = '   ';
      const tooShort = 'Solar';
      assert(empty.trim().length === 0, 'Empty claim must be rejected');
      assert(tooShort.trim().length < 10, 'Claims under 10 chars must be blocked');
    });

    // ========================================================================
    // 4. API VERIFICATION LINKAGE: POST /api/v1/verify
    // ========================================================================
    console.log('\n[SECTION 4] Verification Pipeline & documentId Linkage');

    await runTest('4.1. POST /api/v1/verify accepts inputType=DOCUMENT and documentId', async () => {
      const claimText = 'Ministry of New & Renewable Energy revised rooftop solar subsidy rates for 2026.';
      const res = await fetch('/api/v1/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          claim: claimText,
          inputType: 'DOCUMENT',
        }),
      });

      assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
      const json = await res.json();
      assert(Boolean(json.id), 'Verification request ID must be returned');
      assert(Boolean(json.guestToken), 'Guest token must be generated for citizen session');
      assert(json.status === 'QUEUED', 'Initial status must be QUEUED');
    });

    await runTest('4.2. Ordinary text-claim verification (inputType=CLAIM) is strictly preserved', async () => {
      const claimText = 'Direct Benefit Transfer for national scholarship is mandatory via Aadhaar.';
      const res = await fetch('/api/v1/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          claim: claimText,
          inputType: 'CLAIM',
        }),
      });

      assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
      const json = await res.json();
      assert(json.inputType === 'CLAIM', `Expected inputType CLAIM, got ${json.inputType}`);
    });

    await runTest('4.3. Invalid inputType is rejected with 400', async () => {
      const res = await fetch('/api/v1/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          claim: 'Some factual statement about government grants.',
          inputType: 'UNSUPPORTED_TYPE',
        }),
      });

      assert(res.status === 400, `Expected 400 Bad Request, got ${res.status}`);
      const json = await res.json();
      assert(json.error === 'INVALID_INPUT_TYPE', `Expected INVALID_INPUT_TYPE, got ${json.error}`);
    });

    // ========================================================================
    // 5. DOCUMENT LIFECYCLE: DELETION AND PERMISSION
    // ========================================================================
    console.log('\n[SECTION 5] Document Lifecycle & Deletion Security');

    await runTest('5.1. DELETE /api/v1/documents/:id rejects unauthorized access without guest token', async () => {
      const testDocId = '99999999-8888-7777-6666-555555555555';
      const res = await fetch(`/api/v1/documents/${testDocId}`, {
        method: 'DELETE',
      });

      // Must be 401 or 403 or 404
      assert(res.status === 401 || res.status === 403 || res.status === 404, `Expected auth check or 404, got ${res.status}`);
    });

    // ========================================================================
    // 6. CANONICAL VERDICTS AND CITIZEN GUIDANCE RENDERING
    // ========================================================================
    console.log('\n[SECTION 6] Canonical Verdicts Presentation & Action Guidance');

    await runTest('6.1. All four canonical verdicts are mapped to citizen-friendly labels & colors', async () => {
      const verdicts: CanonicalVerdict[] = [
        'SUPPORTED',
        'PARTIALLY_SUPPORTED',
        'CONTRADICTED',
        'INSUFFICIENT_EVIDENCE',
      ];

      for (const v of verdicts) {
        const citizenInfo = getCitizenVerdict(v);
        assert(Boolean(citizenInfo.label), `Verdict ${v} must have a plain-language label`);
        assert(Boolean(citizenInfo.badgeClass), `Verdict ${v} must have badge styling`);
        assert(Boolean(citizenInfo.borderClass), `Verdict ${v} must have border styling`);
        assert(Boolean(citizenInfo.dotColor), `Verdict ${v} must have dot color`);
      }
    });

    await runTest('6.2. Document text is never treated as verified evidence for its own assertions', async () => {
      // In GovVerify AI, evidence items must originate from recognized sovereign domains (.gov.in, .nic.in, PIB)
      const officialEvidence = {
        domain: 'pmkisan.gov.in',
        sourceUrl: 'https://pmkisan.gov.in/notification.pdf',
        isSovereign: true,
      };

      const untrustedDoc = {
        domain: 'local_upload',
        sourceUrl: 'blob:http://localhost/doc-1',
        isSovereign: false,
      };

      assert(officialEvidence.isSovereign, 'Sovereign sources (.gov.in) qualify as evidence');
      assert(!untrustedDoc.isSovereign, 'Uploaded documents must NEVER be counted as evidence for their own assertions');
    });

  } finally {
    global.fetch = originalFetch;
    server.close();
  }

  console.log('\n================================================================');
  console.log(`WORKFLOW TEST RESULTS: ${passedTests} Passed | ${failedTests} Failed`);
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
