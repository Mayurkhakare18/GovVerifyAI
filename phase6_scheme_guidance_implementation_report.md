# GovVerify AI — Phase 6: Personalized Government Scheme Guidance Implementation Report

**Document Status**: Final Implementation Report  
**Date**: October 19, 2026  
**Branch**: `feat/official-source-verification-engine`  
**Execution Environment**: Node.js 20.x, React 19, Vite, TypeScript 5.8 / 7.0, Supabase PostgreSQL, Express  

---

## 1. Executive Summary

Phase 6 of GovVerify AI extends the verified claim analysis flow with **Personalized Government Scheme Guidance**. When an atomic or composite claim submitted by a citizen is verified by the sovereign verification engine and relates to an identifiable sovereign scheme (such as PM-KISAN, PM Surya Ghar: Muft Bijli Yojana, Ayushman Bharat, Atal Pension Yojana, PM Ujjwala Yojana, National Scholarship Portal, or PM Awas Yojana), citizens are provided with an optional, high-trust exploration journey.

This implementation strictly adheres to all architectural constraints:
1. **Zero Database Migrations**: Reuses existing `public.action_guidance.guidance_data JSONB` and in-memory caches. Zero schema alterations.
2. **Deterministic & Grounded**: Every benefit figure, verified cap, mandatory document, and application step is grounded in sovereign gazettes and ministry portals. No LLM hallucinations or invented deadlines.
3. **Passing-Mention Filtering**: Prevents false-positive scheme guidance when a scheme name is used only as a comparison or rhetorical device (*"Unlike PM-KISAN..."*, *"Better than Ayushman Bharat..."*).
4. **Link Separation & SSRF Protection**: Clear architectural boundary between verified scheme informational portals (`.gov.in` / `.nic.in`) and direct application intake endpoints. Unverified application links trigger prominent advisories rather than risky hyperlinks.
5. **PII Interception & Privacy-First Questionnaire**: Deterministic 3-category eligibility questionnaire (`LIKELY_ELIGIBLE`, `MAY_NOT_MEET_CONDITION`, `CANNOT_DETERMINE`) with active detection and immediate rejection of Aadhaar numbers, PAN cards, bank accounts, and OTP/passwords.
6. **Non-Affiliation & Civic Safeguards**: Prominent disclaimers confirming independent verification status, no government affiliation or endorsement, and zero automated submission on behalf of citizens.

---

## 2. Architecture & Implementation Details

```
+--------------------------------------------------------------------------------------------------+
|                                     VERIFIED CLAIM RESULT                                        |
|                     (Verdict: SUPPORTED / PARTIALLY_SUPPORTED / CONTRADICTED)                    |
+--------------------------------------------------------------------------------------------------+
                                                 |
                                                 v
                     +-------------------------------------------------------+
                     | Step 2: detectSchemeFromClaimAndEvidence()            |
                     |  • Sovereign Scheme Registry Pattern Matching         |
                     |  • isPassingMention() Rejection Filter                |
                     |  • SSRF-Protected Sovereign URL Validation            |
                     +-------------------------------------------------------+
                                                 |
                        +------------------------+------------------------+
                        |                                                 |
                   [No Scheme /                                     [Scheme Found]
                 Passing Mention]                                         |
                        |                                                 v
                        v                            +-----------------------------------------+
                 Standard Action                     | Step 3: Contextual Prompt               |
                 Guidance Fallback                   |  "Interested in this scheme?"           |
                                                     |  [Explore Scheme]  vs  [Dismiss]        |
                                                     +-----------------------------------------+
                                                                          |
                                                                          v
                                                     +-----------------------------------------+
                                                     | Step 4 & 7: Structured Scheme Guide Card|
                                                     |  • Jurisdiction & Administering Ministry|
                                                     |  • Overview & Verified Benefit Limits   |
                                                     |  • Mandatory vs Conditional Documents   |
                                                     |  • Online Steps & Offline CSC Guidance  |
                                                     |  • Verified Info vs Application URLs    |
                                                     |  • Disclaimers & Known Limitations      |
                                                     +-----------------------------------------+
                                                                          |
                                                                          v
                                                     +-----------------------------------------+
                                                     | Step 5: Interactive Eligibility Flow    |
                                                     |  • "Why we ask this" Transparency       |
                                                     |  • Strict PII Shield (Aadhaar/PAN/OTP)  |
                                                     |  • Deterministic 3-Category Evaluation: |
                                                     |    - LIKELY_ELIGIBLE                    |
                                                     |    - MAY_NOT_MEET_CONDITION             |
                                                     |    - CANNOT_DETERMINE                   |
                                                     +-----------------------------------------+
```

### 2.1 File Changes & Additions

| File | Type | Description |
|---|---|---|
| `src/server/services/actionGuidance.ts` | Modified | Core Phase 6 backend service: Data models (`DetectedSchemeRecord`, `StructuredSchemeGuide`, `EligibilityVerdictCategory`), `KNOWN_SOVEREIGN_SCHEMES` knowledge base (7 schemes), `isPassingMention()`, `detectSensitivePii()`, `detectSchemeFromClaimAndEvidence()`, `buildSourceGroundedSchemeGuide()`, `generateActionGuidance()`, and `evaluateEligibilityAnswers()`. |
| `src/components/dashboard/ActionGuidanceSection.tsx` | Modified | Phase 6 UI component: Contextual exploration prompt with dismiss capability, structured scheme guide card, jurisdiction badge, benefit limits badge, online vs offline CSC tabs, mandatory vs conditional document checklist, link separation, uncertainties notice, and interactive questionnaire with "Why we ask" and PII warnings. |
| `phase6_scheme_guidance_audit.md` | New | Comprehensive pre-implementation audit confirming database compatibility, security safeguards, and test coverage requirements. |
| `tests/phase6_scheme_guidance.test.ts` | New | Dedicated 20-test automated suite covering all 12 Phase 6 requirements. |
| `phase6_scheme_guidance_implementation_report.md` | New | This report documenting implementation details, test outputs, limitations, and preview deployment checklist. |

---

## 3. Key Feature Walkthrough

### 3.1 Passing-Mention Rejection
Simple keyword matching triggers false-positive scheme guidance when a scam or comparison claim casually references a sovereign scheme. The `isPassingMention` function enforces regex patterns on prefix clauses:
- `unlike [scheme]`
- `compared to [scheme]`
- `different from [scheme]`
- `better than [scheme]`
- `instead of [scheme]`
- `not related to [scheme]`

When a comparison or contrastive clause is detected, scheme detection is aborted, preventing scam advertisements from showing legitimate government application cards.

### 3.2 Dual-Channel Application Guidance (Online vs Offline CSC)
Because millions of Indian citizens access government benefits through assisted digital kiosks rather than personal computers, `buildSourceGroundedSchemeGuide` provides structured instructions for both channels:
1. **Online Channel**: Step-by-step navigation on verified sovereign portals (`.gov.in` / `.nic.in`), OTP authentication, and digital application submission.
2. **Offline Channel**: Step-by-step guidance for visiting Common Service Centers (CSCs), District Agriculture / Tehsildar revenue offices, biometric e-KYC capture on physical POS terminals, and physical receipt collection.

### 3.3 Mandatory vs Conditional Document Distinction
Requirements are explicitly split into:
- **Mandatory Documents (`isMandatory: true`)**: Aadhaar card, electricity bill, bank passbook, or land revenue records.
- **Conditional Documents (`isMandatory: false`)**: Accompanied by a `conditionDescription` specifying exact circumstances (e.g., *NOC from landlord/housing society required only for tenants or apartment dwellers*; *Legal heir affidavit required only for inherited land undergoing title mutation*).

### 3.4 Strict PII Shield & Deterministic Evaluation
When evaluating questionnaire responses:
1. **PII Shield**: `detectSensitivePii()` runs multi-pattern regex scans for 12-digit Aadhaar numbers (`\b\d{4}\s?\d{4}\s?\d{4}\b`), PAN cards (`\b[A-Z]{5}[0-9]{4}[A-Z]\b`), 9–18 digit bank account numbers, and credential terms (`otp`, `password`, `pin`, `cvv`).
2. If PII is found, evaluation immediately aborts, returns `CANNOT_DETERMINE`, and surfaces an explicit privacy alert without persisting the citizen's sensitive input.
3. When inputs are clean, evaluation applies deterministic matching against official criteria:
   - **`LIKELY_ELIGIBLE`**: All documented criteria match.
   - **`MAY_NOT_MEET_CONDITION`**: One or more answers conflict with documented eligibility rules.
   - **`CANNOT_DETERMINE`**: Criteria were skipped or left unanswered.

---

## 4. Test & Verification Results

All tests were executed directly in the project environment using `npx tsx` and `npm run`.

### 4.1 Phase 6 Test Suite (`tests/phase6_scheme_guidance.test.ts`)
```
================================================================
GOVVERIFY AI — PHASE 6: SCHEME GUIDANCE TEST SUITE
Validating Detection, Guides, Questionnaire, SSRF, PII & Regressions
================================================================

[SECTION 1] Scheme Detection & False-Positive Passing-Mention Rejection
• Testing: 1.1. Detects primary sovereign schemes from claim text... PASSED
• Testing: 1.2. Rejects false-positive passing mentions (comparisons, contrastive clauses)... PASSED
• Testing: 1.3. Resolves scheme from verified evidence when claim phrasing is colloquial... PASSED

[SECTION 2] Official URL Validation & SSRF Protections
• Testing: 2.1. Sovereign government portals are classified VERIFIED_OFFICIAL... PASSED
• Testing: 2.2. SSRF targets (loopback, private IP, metadata services) are rejected... PASSED
• Testing: 2.3. Dangerous protocols (javascript:, file:, data:) are rejected... PASSED
• Testing: 2.4. Commercial and lookalike domains are marked INFORMATIONAL_ONLY or UNVERIFIED... PASSED

[SECTION 3] Evidence-Grounded Scheme Guide Generation
• Testing: 3.1. Structured scheme guide includes benefits, limits, and grounded overview... PASSED
• Testing: 3.2. Distinguishes mandatory vs conditional documents with conditions... PASSED
• Testing: 3.3. Provides dual application channels: sequential online steps and offline CSC instructions... PASSED
• Testing: 3.4. Handles missing or unverified direct application links with honest notices... PASSED

[SECTION 4] Personalized Eligibility Questionnaire & PII Safeguards
• Testing: 4.1. Evaluates LIKELY_ELIGIBLE when all answers deterministically match criteria... PASSED
• Testing: 4.2. Evaluates MAY_NOT_MEET_CONDITION when an answer conflicts with documented rules... PASSED
• Testing: 4.3. Evaluates CANNOT_DETERMINE when questions are skipped or left unanswered... PASSED
• Testing: 4.4. Detects and immediately rejects sensitive PII (Aadhaar, PAN, Bank Account, OTP)... PASSED

[SECTION 5] Verdict Integrations & Scam/Contradicted Guardrails
• Testing: 5.1. CONTRADICTED scam claim does not route citizens to fraudulent application link... PASSED
• Testing: 5.2. INSUFFICIENT_EVIDENCE claim does not recommend applying and provides safe directories... PASSED

[SECTION 6] API Routes, Guest Tokens & Persistence
• Testing: 6.1. POST /api/v1/verify/:id/action-guidance/evaluate-eligibility evaluates answers cleanly... PASSED
• Testing: 6.2. POST evaluate-eligibility with sensitive PII returns 200 with security warning banner... PASSED
• Testing: 6.3. Invalid non-UUID parameter is rejected with 400 Bad Request... PASSED

================================================================
PHASE 6 TEST SUMMARY: 20 Passed | 0 Failed
================================================================
```

### 4.2 Action Guidance Regression Suite (`tests/action_guidance.test.ts`)
```
================================================================
GOVVERIFY AI — "VERIFY & TAKE ACTION" TEST SUITE
Validating SSRF Protection, Service Discovery, Questionnaire & Auth
================================================================

[SECTION 1] SSRF Protection & Safe URL Validation
• Testing: 1.1. Valid sovereign government URLs (.gov.in, .nic.in) are verified... PASSED
• Testing: 1.2. Loopback and private IP addresses are blocked (SSRF Protection)... PASSED
• Testing: 1.3. Unsafe protocols (javascript:, file:, data:) are rejected... PASSED
• Testing: 1.4. Commercial or non-sovereign domains are marked INFORMATIONAL_ONLY... PASSED
• Testing: 1.5. Malformed or empty URLs return clean fallback... PASSED

[SECTION 2] Verdict-Matched Action Guidance (Requirement 3)
• Testing: 2.1. SUPPORTED claim produces verified official application steps and portal... PASSED
• Testing: 2.2. PARTIALLY_SUPPORTED claim highlights mandatory conditions & prerequisites... PASSED
• Testing: 2.3. CONTRADICTED claim blocks application links and provides scam alert (Zero false guidance)... PASSED
• Testing: 2.4. INSUFFICIENT_EVIDENCE claim does not recommend applying & provides safe directories... PASSED

[SECTION 3] Eligibility Questionnaire Evaluation
• Testing: 3.1. Questionnaire compares answers against criteria without storing private data... PASSED

[SECTION 4] Live API Endpoints & Authorization
• Testing: 4.1. GET /api/v1/verify/:id/action-guidance with guest token returns verified action data... PASSED
• Testing: 4.2. Cross-user isolation: Unauthorized guest token access is rejected with 403... PASSED
• Testing: 4.3. POST /api/v1/verify/:id/action-guidance/evaluate-eligibility evaluates answers without saving PII... PASSED
• Testing: 4.4. Invalid UUID parameter rejected with 400 Bad Request... PASSED

================================================================
ACTION GUIDANCE TEST SUMMARY: 14 Passed | 0 Failed
================================================================
```

### 4.3 Official-Source Verification Engine Test Suite (`tests/official_source_verification.test.ts`)
```
================================================================
OFFICIAL-SOURCE VERIFICATION SUITE COMPLETE: 15 Passed | 0 Failed
================================================================
```

### 4.4 TypeScript Compilation & Production Build
- `npm run lint` (`tsc --noEmit`): Exited with code 0 (0 errors).
- `npm run build` (`vite build && esbuild src/server/apiEntry.ts ...`): Exited with code 0. Generated `dist/` bundle (25 client chunks) and standalone Node.js server bundle `api/index.js` (262.9 kB).

---

## 5. Technical Limitations & Operational Boundaries

1. **Static Scheme Knowledge Base Scope**: The initial implementation preconfigures 7 major sovereign schemes (PM-KISAN, PM Surya Ghar, Ayushman Bharat, Atal Pension Yojana, PM Ujjwala Yojana, National Scholarship Portal, and PM Awas Yojana). For other niche state schemes, the system falls back to authoritative ministry informational search or directory pointers (`myscheme.gov.in`, `india.gov.in`).
2. **Dynamic State-Level Land Record Variations**: State land record terminology varies widely (Jamabandi in Punjab/Haryana, RoR in Maharashtra, 7/12 in Gujarat, Patta/Chitta in Tamil Nadu). The guidance notes this regional variation and advises citizens to consult local revenue authorities.
3. **No Direct Citizen Application Submission**: In compliance with security and civic mandate, GovVerify AI does not and will never submit official government benefit applications on behalf of citizens. The system serves exclusively as a trusted verifier and navigational guide.

---

## 6. Preview Deployment Checklist

Before merging to `main` or deploying to production, verify the following on the Vercel Preview deployment:

- [ ] **Branch Verification**: Confirm working branch is `feat/official-source-verification-engine`.
- [ ] **No Unstaged Secrets or Credentials**: Confirm `.env` files, Supabase service keys, and Tavily/Gemini API keys are excluded from git.
- [ ] **Database Integrity**: Confirm zero SQL migrations were executed in `supabase/migrations/`.
- [ ] **Preview Environment Variables**:
  - `SUPABASE_URL` and `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
  - `GEMINI_API_KEY` (Gemini 2.5 Flash / 2.0 Flash)
  - `TAVILY_API_KEY`
- [ ] **Functional Smoke Tests in Preview UI**:
  - Submit supported claim: *"Farmers receive ₹6,000 per year under PM-KISAN"* -> Confirm Contextual Guidance Prompt appears -> Click "Explore Scheme" -> Verify PM-KISAN guide card displays ₹6,000 limit, mandatory documents, CSC offline steps, verified links, and questionnaire.
  - Submit passing-mention claim: *"Unlike PM-KISAN, invest in XYZ crypto fund"* -> Confirm PM-KISAN guidance card is suppressed.
  - Test Questionnaire PII Guard: Enter an Aadhaar or PAN number in a custom field -> Confirm immediate `CANNOT_DETERMINE` response and red PII warning banner.
  - Test Scam Alert: Submit refuted claim -> Confirm `CONTRADICTED_ALERT` displays with scam warnings and no misleading application links.
  - Test Responsive UI on mobile viewport (375px) and desktop (1280px).
- [ ] **Vercel Edge & Serverless Functions**: Confirm `api/index.js` starts cleanly without cold-start timeouts.
