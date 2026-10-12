# GovVerify AI — Production Claim Verification Integrity Overhaul Report

**Author / Roles:** Senior Fact-Checking Systems Engineer, AI Evaluation Specialist, Backend Engineer, QA Lead  
**Date:** March 2026 / October 2026  
**Status:** Completed & Validated Locally  
**Repository Target:** `Mayurkhakare18/GovVerifyAI`  

---

## Executive Summary

A critical correctness defect was identified in the deployed GovVerify AI application: **the verification pipeline repeatedly returned `SUPPORTED` verdicts with static 90% confidence for assertions that should have received `CONTRADICTED`, `PARTIALLY_SUPPORTED`, or `INSUFFICIENT_EVIDENCE`**.

This overhaul completely investigated and audited the complete verification intake, source discovery, LLM grounding, stance evaluation, queue processing, and persistence pipeline. Five interrelated structural root causes were identified and eliminated. The deterministic fallback stance classifier was overhauled to enforce strict quantitative conflict detection, subject-specific contradiction indicators, calibrated multi-source confidence calculation, and server-side citation validation with request isolation. 

An independent 15-case verification integrity suite (`tests/claim_verification_integrity.test.ts`) was authored and passed with a 100% pass rate. All existing integration suites (`tests/tavily_provider.test.ts`, `tests/phase3_step2.test.ts`, `tests/phase4_reliability.test.ts`, `tests/phase4_2_status_gate.test.ts`) and TypeScript checks passed with zero errors.

---

## 1. Root Cause Analysis of Repeated `SUPPORTED` Verdicts

A rigorous audit of the request lifecycle from ingestion to persistence revealed that universal `SUPPORTED` verdicts were not caused by a single bug, but by a cascade of 5 flaws across source discovery, model fallback, and heuristic stance evaluation:

### Root Cause 1: Premature Permanent Gemini Circuit Breaker Latch
* **Location:** [`src/server/services/verdictAnalysis.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/server/services/verdictAnalysis.ts#L59) (`let geminiCircuitBroken = false;`)
* **Mechanism:** The timeout on LLM structured generation was set to an aggressive 2000ms (`Promise.race([..., setTimeout(..., 2000)])`). In production or under slight network latency, the timeout was exceeded, setting `geminiCircuitBroken = true;`. Because this variable was a permanent module-level boolean latch with no recovery cooldown, **every subsequent verification request completely bypassed Gemini for the lifetime of the process** and was dumped directly into the fallback heuristic classifier.

### Root Cause 2: Flawed Fallback Keyword Stance Classifier Coercing All Matches to `SUPPORTED`
* **Location:** [`src/server/services/verdictAnalysis.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/server/services/verdictAnalysis.ts#L396-L415)
* **Mechanism:** When fallback synthesis ran, the token overlap threshold was `matchScore >= 0.35` (and in some places `matchScore >= 0.25`). Any official government webpage discussing the general topic of the claim (e.g., "PM-KISAN", "farmers", "scheme", "installment") scored `matchScore >= 0.35`. Because official portals do not contain words like "fake", "rumor", or "fraudulent" unless they are specific PIB fact-checks, `hasFakeIndicator` was `false`. As a result:
  ```typescript
  // Flawed original code:
  if (!hasFakeIndicator && matchScore >= 0.35) {
    supportingIds.push(ev.id);
  }
  ```
  This immediately labeled any retrieved government page on the same topic as **direct supporting evidence**, pushing `ev.id` to `supportingIds`, yielding an automatic `SUPPORTED` verdict with a hardcoded static `confidence = 90`.

### Root Cause 3: Fabricated Synthetic Evidence Embedding Claim Text as Official Excerpt
* **Location:** [`src/server/services/sourceDiscovery.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/server/services/sourceDiscovery.ts#L330-L335)
* **Mechanism:** During Google Search Grounding with Gemini, when the model returned candidate search sources without a specific text segment quotation, the code fell back to:
  ```typescript
  // Flawed original code:
  extractedText = 'Grounded source reference identified from official search results for statement: "' + trimmed + '..."';
  ```
  This fabricated synthetic evidence by embedding the citizen's exact claim text into `extractedText`! When the stance classifier subsequently ran keyword overlap against `extractedText`, it found a 100% token match against the claim, immediately classifying it as `SUPPORTED`!

### Root Cause 4: Irrelevant Page Excerpt Fallback in Tavily Discovery
* **Location:** [`src/server/services/tavily.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/server/services/tavily.ts#L202)
* **Mechanism:** When Tavily retrieved a sovereign webpage (e.g. `pmkisan.gov.in`) whose content did not match the claim's keywords (such as a 404 page, portal header, or unrelated policy), `extractGroundedExcerpt` fell back to `rawContent.slice(0, 350)`. This caused raw HTML headers, navigation menus, and cookie disclaimers to be persisted as "verified evidence".

### Root Cause 5: Unquarantined Test Mocks Exposed to Production API
* **Location:** [`src/server/routes/api.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/server/routes/api.ts#L601) and [`src/server/routes/api.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/server/routes/api.ts#L1243)
* **Mechanism:** `POST /api/v1/verify` and `POST /api/v1/verify/:id/verdict` accepted `discoveryOptions` (including `mockGroundingChunks`) and `simulatedModelOutput` from the HTTP request body without checking if the environment was running in test mode.

---

## 2. All Production Paths That Could Generate Unsupported Verdicts

| Path / Code Component | Failure Scenario | Former Flawed Behavior | Overhauled Correct Behavior |
| :--- | :--- | :--- | :--- |
| `src/server/services/verdictAnalysis.ts` (`generateGeminiStructuredVerdict`) | Gemini timeout, 429 quota exhaustion, or 503 error | Permanently locked circuit breaker open; all future requests bypassed LLM | Replaced permanent latch with timed cooldown (15s); increased timeout to 12s/15s with automatic fallback to secondary models |
| `src/server/services/verdictAnalysis.ts` (`evaluateEvidenceForSubclaims`) | Citizen submits false claim with different number (e.g. ₹12,000 instead of ₹6,000) | Token overlap on "PM-KISAN" and "farmer" yielded `SUPPORTED` | Added `hasNumericConflict` detection comparing asserted numbers vs. retrieved official numbers -> strictly `CONTRADICTED` |
| `src/server/services/verdictAnalysis.ts` (`evaluateEvidenceForSubclaims`) | Compound claim with 1 supported subclaim and 1 unverified rumor | High aggregate token overlap marked whole claim `SUPPORTED` | Atomic subclaim evaluation requires all material subclaims to be verified for `SUPPORTED`. If any subclaim lacks evidence -> strictly `PARTIALLY_SUPPORTED` |
| `src/server/services/verdictAnalysis.ts` (`evaluateEvidenceForSubclaims`) | Plausible but unverified rumor (no specific confirmation or denial) | Topic overlap with generic ministry overview marked claim `SUPPORTED` | Requires `matchScore >= 0.48` for support; generic mentions classified as `MENTIONS` / `INSUFFICIENT_EVIDENCE` |
| `src/server/services/sourceDiscovery.ts` (`discoverAuthoritativeSources`) | Google Search Grounding returns source without specific segment | Embedded citizen claim text into `extractedText`, guaranteeing 100% match | Discarded; sources lacking genuine excerpt text are rejected with `sources: []` |
| `src/server/services/tavily.ts` (`extractGroundedExcerpt`) | Page has 404, navigation headers, or unrelated footer text | Took first 350 chars of raw HTML and persisted it as evidence | Returns `null` if no claim keywords match; evidence is rejected |
| `src/server/routes/api.ts` (`POST /api/v1/verify/:id/verdict`) | Client sends `{ simulatedModelOutput: { verdict: 'SUPPORTED' } }` | Body passed directly to decision engine in production | Quarantined strictly to `isTestMode`; ignored in production |
| `src/server/queue/worker.ts` (`processSingleJob`) | Search provider finds 0 results for unheard-of claim | Discovery ended; verdict analysis was skipped; request stranded as `PROCESSING` | Worker executes verdict analysis even on 0 evidence -> cleanly completes with canonical `INSUFFICIENT_EVIDENCE` (confidence = 0) |

---

## 3. Summary of Code Changes & Rationale

### 1. `src/server/services/gemini.ts`
* Added structured retry delays (`await new Promise((r) => setTimeout(r, 350))`) when switching between fallback models on 429/503 errors to prevent rapid-fire quota exhaustion.
* Verified model selection: active support for `gemini-3.5-flash` with graceful fallback to `gemini-3.5-flash-lite` and `gemini-3.8-flash`.

### 2. `src/server/services/tavily.ts`
* Quarantined `mockResults` and `mockError` strictly to non-production environments (`isProduction`).
* Exported strongly-typed `TavilySearchError` with `isRateLimit` and `isTimeout` flags.
* Rewrote `extractGroundedExcerpt`: removed the raw 350-character HTML slice fallback. If no sentences contain at least two claim keywords, the function returns `null`.

### 3. `src/server/services/sourceDiscovery.ts`
* Removed synthetic evidence fabrication that previously embedded the citizen's statement into `extractedText`.
* Quarantined `mockGroundingChunks` and `mockGroundingSupports` strictly to non-production environments.

### 4. `src/server/services/verdictAnalysis.ts`
* Replaced the module-level boolean latch `geminiCircuitBroken = true` with a cooldown-based circuit breaker (`isGeminiCircuitOpen()`, `tripGeminiCircuit(15000)`, `resetGeminiCircuit()`).
* Increased model timeouts from 2000ms to 12000ms (standard) and 15000ms (structured verdict).
* Implemented `calculateDefensibleConfidence`:
  * Returns `0` when `verifiedEvidence.length === 0` (no fabricated precision).
  * Calculates calibrated score based on source trust tier (Tier 1 .gov.in/PIB vs Tier 2 regulatory vs Tier 3 media), source independence (deduplicating circular references), subclaim coverage ratio, and outdated publication penalty.
* Overhauled `evaluateEvidenceForSubclaims`:
  * Added quantitative numeric conflict detection: extracts numbers (currency, percentages, ceilings). If the subclaim asserts an amount (e.g. ₹12,000) and the official source states a conflicting amount (e.g. ₹6,000), it is classified as `hasNumericConflict` and assigned `CONTRADICTED`.
  * Added subject-specific condition negation: detects specific disclaimers (e.g. "no 40-year maximum age restriction", "regardless of age", "no fee") and links them directly to the contradicted subclaim.
  * Per-subclaim citation isolation: tracks `subclaimCitations` per subclaim, ensuring that citations for one proposition do not mark an unrelated proposition as `INDIRECT` instead of `ABSENT`.
  * Replaced naive `matchScore >= 0.35` with a two-tiered threshold: `matchScore >= 0.48` required for `SUPPORTED`; `matchScore >= 0.20` classified as `MENTIONS` / `INSUFFICIENT_EVIDENCE`.
* Enforced request isolation in `validateVerdictAnalysis`: rejects citations whose `verification_request_id` does not match the active request ID (`Cross-request isolation violation`).
* Idempotency & Overwrite Guard: returns the existing validated result if the request is already `COMPLETED` and `forceReanalyze` is not explicitly requested.

### 5. `src/server/routes/api.ts`
* Quarantined `discoveryOptions` in `POST /api/v1/verify` and `simulatedModelOutput` in `POST /api/v1/verify/:id/verdict` strictly to test mode.
* Updated auto-discovery provider checks to check `getActiveDiscoveryProvider()` rather than only checking Gemini.
* Enabled in-process test-mode background execution so standalone test runners can complete requests without requiring an external worker daemon.

### 6. `src/server/queue/worker.ts`
* Updated `FULL_VERIFICATION` job handling: when source discovery completes with 0 verified evidence (honest absence of evidence), the worker now proceeds to verdict analysis so it can persist canonical `INSUFFICIENT_EVIDENCE` and transition the request from `PROCESSING` to `COMPLETED`, rather than leaving it stranded.

---

## 4. Evidence-Provenance and Citation-Validation Rules

1. **Sovereign Domain Restriction:** Evidence is accepted as verified only if retrieved from Tier-1 sovereign domains (`.gov.in`, `.nic.in`, `pib.gov.in`, `egazette.gov.in`, `india.gov.in`, `mygov.in`, `rbi.org.in`, `sebi.gov.in`, `sci.gov.in`). Commercial or secondary domains (`.com`, `.org`, blogs) are demoted to unverified candidates and never count toward `SUPPORTED` verdicts.
2. **Provenance Traceability:** Every evidence record must have `source_type === 'GROUNDED_SEARCH'` and `sources.url` starting with `http`.
3. **Substantive Excerpt Requirement:** An evidence record must contain actual non-empty `extracted_text` from the verified webpage. Search titles and snippets alone are rejected by `filterVerifiedEvidence`.
4. **Citation Existence Validation:** Every citation ID generated by the model or heuristic evaluator must match a persisted `evidence.id` for the current verification request. Fabricated or hallucinated IDs are rejected with a `Traceability violation`.
5. **Cross-Request Isolation:** Citations belonging to a different `verification_request_id` are strictly rejected with a `Cross-request isolation violation`.

---

## 5. Canonical Verdict & Confidence Aggregation Rules

The pipeline returns exclusively one of the four canonical verdicts:

### `SUPPORTED`
* **Condition:** Reliable official evidence directly and specifically confirms **all material factual components** of the claim (dates, amounts, conditions, eligibility, and jurisdiction).
* **Rule:** `supportedCount > 0 && contradictedCount === 0 && insufficientCount === 0`.
* **Confidence Range:** 70% – 95% (calibrated based on authority tier, domain count, and coverage ratio).

### `PARTIALLY_SUPPORTED`
* **Condition:** Reliable official records confirm certain factual propositions of the statement, while other key propositions are contradicted, false, outdated, or lack official documentation.
* **Rules:**
  1. `contradictedCount > 0 && supportedCount > 0` (factual conflict or mixed assertions).
  2. `supportedCount > 0 && insufficientCount > 0` (compound claim where some assertions lack evidence).
* **Confidence Range:** 45% – 85%.

### `CONTRADICTED`
* **Condition:** Reliable official records (government gazettes, PIB Fact Checks, or official scheme rules) directly contradict the claim's core assertion, numbers, or conditions.
* **Rule:** `contradictedCount > 0 && supportedCount === 0`.
* **Confidence Range:** 65% – 95%.
* **Crucial Principle:** A rumor is **never** labeled `CONTRADICTED` merely because no supporting source was found.

### `INSUFFICIENT_EVIDENCE`
* **Condition:** Available evidence is absent, weak, ambiguous, or mentions the general scheme without confirming or refuting the specific assertions.
* **Rule:** `supportedCount === 0 && contradictedCount === 0`.
* **Confidence:** Strictly `0` when zero verified evidence records exist; capped at 25% for general topic mentions.

---

## 6. Provider Failure Behavior

| Failure Mode | Detection | System Action | Persisted State |
| :--- | :--- | :--- | :--- |
| **Tavily 429 Quota Exhausted** | `response.status === 429` | Throws `TavilySearchError(..., isRateLimit=true)`; telemetry records `QUOTA_EXHAUSTED` | `FAILED` with retry backoff; zero false verdicts persisted |
| **Tavily 500 / Network Timeout** | `response.status >= 500` or `AbortError` | Throws `TavilySearchError(..., isTimeout=true)`; telemetry records `PROVIDER_UNAVAILABLE` | `FAILED` with bounded retry |
| **Gemini 429 Rate Limit / Quota** | `err.status === 429` or `RESOURCE_EXHAUSTED` | Trips circuit breaker cooldown (15s); switches to secondary fallback model or defensible rule-based evaluator | Never crashes; does not coerce to `SUPPORTED` |
| **Gemini Output Malformed JSON** | `JSON.parse` fails or invalid schema | `validateVerdictAnalysis` rejects payload; falls back safely to defensible heuristic evaluator | Valid canonical verdict persisted based on evidence |
| **Zero Search Results** | Search API returns 0 items | Classified as `EMPTY_RESULTS`; evaluates to canonical `INSUFFICIENT_EVIDENCE` | `COMPLETED`, verdict `INSUFFICIENT_EVIDENCE`, confidence `0` |

---

## 7. Test Cases, Commands, and Actual Results

### Suite 1: Dedicated Claim Verification Integrity Suite
* **File:** [`tests/claim_verification_integrity.test.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/tests/claim_verification_integrity.test.ts)
* **Command:** `cmd.exe /c "npx tsx tests/claim_verification_integrity.test.ts"`

| # | Test Scenario | Expected Outcome | Actual Result |
| :--- | :--- | :--- | :--- |
| 1 | Genuine factual claim (PM-KISAN ₹6,000 in 3 installments) | `SUPPORTED`, confidence 70–95%, 1 citation | **PASSED** |
| 2 | True core with materially incorrect detail (PM-KISAN ₹6,000, max age 40) | `PARTIALLY_SUPPORTED`, subclaim 1 supported, subclaim 2 contradicted | **PASSED** |
| 3 | Demonstrably false claim (PM-KISAN increased to ₹12,000) | `CONTRADICTED`, numeric conflict detected | **PASSED** |
| 4 | Plausible but unverified rumor (₹50,000 to unmarried youths) | `INSUFFICIENT_EVIDENCE`, topic mention not supporting | **PASSED** |
| 5 | Claim with zero search results | `INSUFFICIENT_EVIDENCE`, confidence strictly 0 | **PASSED** |
| 6 | Snippet-only or ungrounded evidence | Filtered out; `INSUFFICIENT_EVIDENCE`, confidence 0 | **PASSED** |
| 7 | Conflicting reliable sources (March 31 vs Sept 30 deadline) | `PARTIALLY_SUPPORTED`, conflict highlighted | **PASSED** |
| 8 | Compound claim with 1 supported, 1 unsupported component | `PARTIALLY_SUPPORTED` (NEVER `SUPPORTED`) | **PASSED** |
| 9 | Inaccessible/unrelated page (404 / header only) | `extractGroundedExcerpt` returns `null`; no hallucination | **PASSED** |
| 10 | Gemini HTTP 429 quota exhaustion | Circuit breaker cooldown trips; safe heuristic evaluation | **PASSED** |
| 11 | Tavily provider failure (500 / 429 / timeout) | Classified `TavilySearchError` without fake sources | **PASSED** |
| 12 | Malformed model output (invalid verdict, confidence 150) | Guardrail rejects; `isValid: false` | **PASSED** |
| 13 | Fabricated citation IDs not in verified evidence | Guardrail rejects; `Traceability violation` | **PASSED** |
| 14 | Cross-request evidence citation attempt | Guardrail rejects; `Cross-request isolation violation` | **PASSED** |
| 15 | Overwrite protection for completed results | Idempotency guard preserves completed record | **PASSED** |

**Summary: 15 Passed | 0 Failed**

---

### Suite 2: Tavily Provider Discovery Test Suite
* **File:** [`tests/tavily_provider.test.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/tests/tavily_provider.test.ts)
* **Command:** `cmd.exe /c "npx tsx tests/tavily_provider.test.ts"`
* **Summary: 11 Passed | 0 Failed**

### Suite 3: Phase 3 Step 2 Evidence Analysis & Verdict Test Suite
* **File:** [`tests/phase3_step2.test.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/tests/phase3_step2.test.ts)
* **Command:** `cmd.exe /c "npx tsx tests/phase3_step2.test.ts"`
* **Summary: 21 Passed | 0 Failed**

### Suite 4: Phase 4.6 End-to-End Reliability & Queue Test Suite
* **File:** [`tests/phase4_reliability.test.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/tests/phase4_reliability.test.ts)
* **Command:** `cmd.exe /c "npx tsx tests/phase4_reliability.test.ts"`
* **Summary: 24 Passed | 0 Failed**

### Suite 5: Phase 4.2 Status Gate Regression Suite
* **File:** [`tests/phase4_2_status_gate.test.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/tests/phase4_2_status_gate.test.ts)
* **Command:** `cmd.exe /c "npx tsx tests/phase4_2_status_gate.test.ts"`
* **Summary: 21 Passed | 0 Failed**

### TypeScript Typecheck & Production Build
* **Typecheck Command:** `cmd.exe /c "npx tsc --noEmit"` -> **Exit code 0 (Zero errors)**
* **Build Command:** `cmd.exe /c "npm run build"` -> **Exit code 0 (Compiled in 743ms)**
  * `dist/index.html` (2.18 kB)
  * `dist/assets/index-*.css` (73.36 kB)
  * `dist/assets/index-*.js` (159.10 kB)
  * `api/index.js` (200.6 kB standalone serverless bundle)

---

## 8. Remaining Limitations and Unresolved Risks

1. **Free-Tier LLM Rate Limits (HTTP 429):** The Gemini free tier has strict requests-per-minute (RPM) limits. Although the multi-model fallback chain (`gemini-3.5-flash` -> `gemini-3.5-flash-lite` -> `gemini-3.8-flash`) and circuit breaker prevent crashes and produce defensible heuristic assessments, high burst traffic in production can cause temporary fallback to heuristic evaluations. Upgrading to a paid Gemini API tier with dedicated throughput is recommended for high-volume production.
2. **Serverless Worker Constraints on Vercel:** Vercel functions are stateless and terminate after 10–60 seconds. Persistent long-polling queue daemons (`src/server/queue/worker.ts`) cannot run continuously inside serverless functions. While the web interface supports synchronous on-demand execution (`syncDiscover: true`, `syncVerdict: true`, and `POST /api/v1/verify/:id/verdict`), asynchronous background jobs rely on a persistent worker deployed on a persistent container or VM (e.g. Railway, Render, or Fly.io) pointing to the same Supabase database.
3. **Dynamic Portal Anti-Scraping / Captcha:** Certain state government portals use Cloudflare, CAPTCHAs, or client-side JavaScript rendering without static HTML. While Tavily Search API with `include_raw_content: true` successfully extracts text for the vast majority of sovereign portals, pages blocked by CAPTCHAs will have their excerpts safely rejected (yielding `INSUFFICIENT_EVIDENCE`) rather than generating fabricated evidence.

---

## 9. Exact Git Files to Commit and Push

The following files are modified or created and ready for commit:

```bash
git add api/index.js
git add src/server/queue/worker.ts
git add src/server/routes/api.ts
git add src/server/services/gemini.ts
git add src/server/services/sourceDiscovery.ts
git add src/server/services/tavily.ts
git add src/server/services/verdictAnalysis.ts
git add tests/claim_verification_integrity.test.ts
git add tests/phase3_step2.test.ts
git add tests/tavily_provider.test.ts
git add claim_verification_integrity_report.md
```

**Recommended Commit Message:**
```
fix(verification): overhaul claim verification pipeline for genuine evidence-based integrity

- Replace permanent Gemini circuit breaker latch with 15s cooldown and multi-model fallback
- Remove synthetic evidence generation that embedded claim text into extracted text
- Overhaul heuristic stance classifier with quantitative numeric conflict and condition negation checks
- Enforce calibrated confidence scoring (0 for zero evidence; no hardcoded 90%)
- Isolate test mocks from production API paths
- Add server-side citation validation with cross-request isolation
- Add comprehensive 15-case independent verification integrity suite (100% pass)
```

---

## 10. Vercel Redeployment and Live Smoke Test Steps

### Step 1: Deploy to Vercel
Push the committed changes to your main GitHub branch:
```bash
git commit -m "fix(verification): overhaul claim verification pipeline for genuine evidence-based integrity"
git push origin main
```
Vercel will automatically trigger a production deployment using `npm run build`.

### Step 2: Verify Production Environment Variables on Vercel
Ensure the following environment variables are configured in the Vercel Project Settings:
* `DISCOVERY_PROVIDER`: `"tavily"`
* `TAVILY_API_KEY`: Configured with active Tavily key.
* `GEMINI_API_KEY`: Configured with active Google GenAI key.
* `GEMINI_PRIMARY_MODEL`: `"gemini-3.5-flash"`
* `GEMINI_FALLBACK_MODEL`: `"gemini-3.8-flash"`
* `SUPABASE_URL`: Active Supabase project URL.
* `SUPABASE_SERVICE_ROLE_KEY`: Active Supabase service role key.
* `ENABLE_TEST_VERDICT_MOCKS`: `"false"` (or omit).

### Step 3: Run Controlled Live Production Smoke Tests

Execute these 3 test claims on the deployed production site:

1. **Test Claim 1 (Genuine Factual Claim):**
   * *Claim:* `"Under PM-KISAN, eligible landholding farmer families receive income support of ₹6,000 per year payable in three equal installments."`
   * *Expected Live Verdict:* `SUPPORTED`
   * *Verification:* Check that the citation points to `pmkisan.gov.in` and confidence is calibrated (> 70%, not a dummy fixed 90%).

2. **Test Claim 2 (Directly Contradicted Claim):**
   * *Claim:* `"The Central Government has increased the PM-KISAN annual financial benefit from ₹6,000 to ₹12,000 starting in 2024."`
   * *Expected Live Verdict:* `CONTRADICTED`
   * *Verification:* Check that the explanation references official sources refuting the ₹12,000 claim.

3. **Test Claim 3 (Unverified Speculative Rumor):**
   * *Claim:* `"Central Government is issuing ₹50,000 direct benefit transfers to all unmarried youths next month under a new welfare initiative."`
   * *Expected Live Verdict:* `INSUFFICIENT_EVIDENCE`
   * *Verification:* Check that confidence is `0` or low, and the system reports an honest absence of official evidence rather than fabricating `SUPPORTED`.

---

## 11. Implementation & Verification Status Matrix

| Component / Requirement | Status | Verification Evidence |
| :--- | :--- | :--- |
| **Circuit Breaker Latch Removed** | **Implemented Locally** | Replaced with cooldown function in `src/server/services/verdictAnalysis.ts` |
| **Synthetic Evidence Removed** | **Implemented Locally** | Verified in `src/server/services/sourceDiscovery.ts` |
| **Decision Tree & Stance Logic** | **Implemented Locally** | Tested across 15 cases in `tests/claim_verification_integrity.test.ts` |
| **Defensible Confidence Algorithm** | **Implemented Locally** | Returns 0 on empty evidence; calibrated dynamically |
| **Citation Traceability & Isolation** | **Implemented Locally** | Rejects fake IDs and cross-request citations in guardrail |
| **All 15 Integrity Test Cases** | **Tested with Mocks & Fixtures** | 15/15 Passed in `tests/claim_verification_integrity.test.ts` |
| **Existing Reliability Suites** | **Tested with Mocks & DB** | 11/11 Tavily, 21/21 Phase 3 Step 2, 24/24 Phase 4.6, 21/21 Status Gate |
| **Live Provider Connectivity** | **Tested with Live Providers** | Verified live Tavily API & live Google Gemini GenAI connectivity locally |
| **TypeScript Compilation & Build** | **Validated Locally** | `tsc --noEmit` clean; `npm run build` completed in 743ms |
| **Production Vercel Deployment** | **Ready for Deployment** | All changes compiled into `api/index.js` and ready for Git commit and push |
| **Production Web Verification** | **Pending Git Push** | Ready to run live smoke tests following push |
