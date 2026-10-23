# GovVerify AI — Claim Reason Explanation Report

**Date:** October 23, 2026  
**Branch:** `feat/official-source-verification-engine`  
**Status:** Verification Passed | Ready for Authorized Acceptance  

---

## 1. Executive Summary & Problem Diagnosis

### The Core Problem
Prior to this implementation, GovVerify AI displayed an audited citizen verdict, a model evidence agreement percentage (e.g., 70% confidence), a high-level summary, and a list of citations. However, it failed to directly answer the citizen's central question:

> **"Why is this claim correct or wrong?"**

### Root Causes
1. **Lack of Assertion-Level Attribution:** Complex citizen statements were decomposed into atomic subclaims on the backend, but the presentation layer only presented aggregated findings without separating what specific factual assertions were verified, which were contradicted, and which lacked documentation.
2. **Absence of "What the Evidence Says Instead":** For contradicted claims, users were told the claim was refuted, but not *what the official records actually state instead* (e.g., that PM-KISAN provides ₹6,000 in three installments of ₹2,000, rather than the rumored ₹12,000).
3. **Blurry Distinction Between Quotations and Synthesis:** Direct verbatim quotations from official government circulars were not visually distinguished from AI-written synthesis, reducing citizen trust.
4. **Missing Explicit Safeguards for Unverified Claims:** For claims with insufficient evidence, users were left wondering whether the claim was false or simply unverified. The interface lacked an explicit guarantee that *absence of retrieved evidence does not prove a claim is false*.

---

## 2. Architecture & Implementation Changes

### A. Backend Data Modeling & Synthesis Engine
**File:** [`src/server/services/verdictAnalysis.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/server/services/verdictAnalysis.ts)

1. **Structured Types Added:**
   ```typescript
   export type ReasonAssertionStatus = 'SUPPORTED' | 'CONTRADICTED' | 'NOT_ESTABLISHED';

   export interface ReasonAssertionDetail {
     assertion: string;
     status: ReasonAssertionStatus;
     explanation: string;
     officialFactInstead?: string; // What sovereign records state instead
     sourceQuote?: string;          // Verbatim source excerpt
     sourceCitationId?: string;     // Links to evidence record
     sourceTitle?: string;
     sourceUrl?: string;
     officialPublisher?: string;
   }

   export interface ClaimReasonExplanation {
     verdictHeading:
       | 'Why this claim is correct'
       | 'Why this claim is wrong'
       | 'What is correct and what is wrong'
       | 'Why we cannot verify this claim yet'
       | string;
     directAnswer: string;
     assertions: ReasonAssertionDetail[];
     conditionsOrLimitations?: string[];
     missingEvidenceReason?: string;
     insufficientEvidenceNotice?: string;
   }
   ```

2. **Deterministic Reason Synthesis Engine (`buildClaimReasonExplanation`):**
   - Implemented a pure, evidence-grounded reason generator that evaluates retrieved sovereign evidence against every subclaim.
   - Generates exact verdict-specific headings:
     - `SUPPORTED`: `"Why this claim is correct"`
     - `CONTRADICTED`: `"Why this claim is wrong"`
     - `PARTIALLY_SUPPORTED`: `"What is correct and what is wrong"`
     - `INSUFFICIENT_EVIDENCE`: `"Why we cannot verify this claim yet"`
   - Synthesizes a plain-language direct answer addressing the core claim.
   - For contradicted assertions: extracts what the official evidence specifies instead (e.g. from press releases, circulars, or PIB Fact Checks).
   - Enforces the non-falsity invariant: *Never call an assertion false merely because a supporting source was not retrieved*. Unverified assertions are strictly classified as `NOT_ESTABLISHED` with an explicit notice.
   - Extracts relevant statutory prerequisites, eligibility limits, or portal registration rules for supported claims.

3. **Gemini Structured Integration & Guardrails:**
   - Both Gemini model generation and deterministic fallback produce and validate `reasonExplanation`.
   - `validateVerdictAnalysis`: Updated server-side guardrail to reject invalid headings or fabricated contradictions on zero evidence.

### B. API Route Enhancements
**File:** [`src/server/routes/api.ts`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/server/routes/api.ts)

- `POST /api/v1/verify`: Includes `reasonExplanation` in immediate responses.
- `POST /api/v1/verify/:id/verdict`: Includes `reasonExplanation` in analytical verdict responses.
- `GET /api/v1/verify/:id`: Enriches the returned request record with `reasonExplanation` so historical audits display clear reasons upon retrieval.

### C. Frontend Presentation Layer
**Files:**
- [`src/components/dashboard/ClaimReasonExplanationSection.tsx`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/components/dashboard/ClaimReasonExplanationSection.tsx) (New Component)
- [`src/components/dashboard/VerificationResultView.tsx`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/components/dashboard/VerificationResultView.tsx)
- [`src/components/home/VerificationConsole.tsx`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/components/home/VerificationConsole.tsx)
- [`src/components/dashboard/VerificationWorkspace.tsx`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/components/dashboard/VerificationWorkspace.tsx)
- [`src/components/dashboard/VerificationResultDetail.tsx`](file:///c:/Users/LENOVO/Downloads/govverify-ai/src/components/dashboard/VerificationResultDetail.tsx)

**Key UI Capabilities:**
- **Prominent Section Header:** Titled **"Why Is This Claim Correct or Wrong?"** displayed immediately below the verdict banner, before the long evidence list.
- **Verdict-Specific Badges & Subtitles:** Clean verdict-matched banner displaying the required phrasing.
- **Factual Assertion Cards:** Each tested proposition is displayed in its own card with:
  - Status pill: "Confirmed by Official Record", "Contradicted by Official Record", or "Not Established in Official Evidence".
  - "What the official evidence says instead" callout for contradicted statements.
  - "Analysis & Reason" AI synthesis block.
  - "Direct Sovereign Source Quotation" box: visually distinct italicized quote container with left border, background tint, quotation icon, and publisher pill.
  - Direct clickable link to the authoritative sovereign URL (`.gov.in`, `.nic.in`, PIB).
- **Prerequisites & Conditions Box:** Clarifies statutory requirements (e.g. valid landholding, e-KYC, Aadhaar-linked accounts).
- **Mandatory Integrity Safeguard Callout:** Explains missing evidence and clearly states that insufficient evidence does not prove a claim is false.
- **Roadmap Retention:** Preserves `<ActionGuidanceSection />` (Scheme Application Roadmap) across all views.

---

## 3. Example Outputs by Verdict

### 1. SUPPORTED ("Why this claim is correct")
```markdown
[Section Title] Why Is This Claim Correct or Wrong?
[Verdict Heading] Why this claim is correct

[Direct Answer]
This claim is correct. Official government documentation confirms every tested factual statement in this claim. Sovereign records verify the described benefits, amounts, and program provisions.

[Assertion 1] "Under PM-KISAN, eligible farmers receive direct income support of ₹6,000 per year"
• Status: Confirmed by Official Record
• Analysis & Reason: Published notifications and administrative rules establish that this statement is accurate and documented on official sovereign portals.
• Direct Sovereign Source Quotation:
  "Under the PM-KISAN scheme, an income support of ₹6,000 per year is provided to all eligible landholding farmer families across the country in three equal installments of ₹2,000 every four months."
• Source: PM-KISAN Scheme Operational Guidelines (https://pmkisan.gov.in/guidelines.html)

[Important Prerequisites, Conditions & Limitations]
• Entitlement is subject to statutory eligibility criteria (such as valid landholding records, mandatory e-KYC verification, and Aadhaar-seeded active bank accounts).
• Applications and benefit disbursements are processed exclusively through authorized government portals.
```

### 2. CONTRADICTED ("Why this claim is wrong")
```markdown
[Section Title] Why Is This Claim Correct or Wrong?
[Verdict Heading] Why this claim is wrong

[Direct Answer]
This claim is wrong. Official government records, ministry notifications, or official fact checks directly refute key statements in this claim. Verified sovereign sources establish facts that conflict with what is claimed.

[Assertion 1] "PM-KISAN installment amount has been increased to ₹12,000 per year"
• Status: Contradicted by Official Record
• What the official evidence says instead:
  Official government clarification confirms that no such decision, notification, or scheme has been approved or announced. Under the scheme, eligible farmers receive ₹6,000 per year in three installments of ₹2,000.
• Analysis & Reason: Directly contradicted by official records. While the claim asserts this statement, verified sovereign sources document conflicting provisions.
• Direct Sovereign Source Quotation:
  "PIB Fact Check: A viral message claiming that the financial assistance under the PM-KISAN scheme has been increased to ₹12,000 is fake and fraudulent. Under the scheme, eligible farmers receive ₹6,000 per year in three installments of ₹2,000."
• Source: PIB Fact Check (https://factcheck.pib.gov.in/pmkisan-fake-alert)
```

### 3. PARTIALLY_SUPPORTED ("What is correct and what is wrong")
```markdown
[Section Title] Why Is This Claim Correct or Wrong?
[Verdict Heading] What is correct and what is wrong

[Direct Answer]
This claim is partially correct and partially incorrect or unverified. Official government records confirm certain elements of the statement, while other key propositions are contradicted by official notices or lack official documentation.

[Assertion 1] "PM-KISAN provides ₹6,000 per year"
• Status: Confirmed by Official Record
• Source: PM-KISAN Guidelines (pmkisan.gov.in)

[Assertion 2] "Applicants must pay a ₹500 registration fee"
• Status: Contradicted by Official Record
• What the official evidence says instead:
  Registration on the portal is completely free of cost and no fee is charged.
• Direct Sovereign Source Quotation:
  "Registration on the PM-KISAN portal is completely free of cost. Farmers are advised not to pay any unauthorized fee."
• Source: Ministry of Agriculture (pmkisan.gov.in)
```

### 4. INSUFFICIENT_EVIDENCE ("Why we cannot verify this claim yet")
```markdown
[Section Title] Why Is This Claim Correct or Wrong?
[Verdict Heading] Why we cannot verify this claim yet

[Direct Answer]
We cannot verify or disprove this claim because no authoritative government circulars, gazettes, or official notices confirming or refuting these specific assertions were retrieved from sovereign repositories.

[Assertion 1] "Government to provide free electric tractors to all farmers next month"
• Status: Not Established in Official Evidence
• Analysis & Reason: No authoritative government circular or notification was retrieved that confirms or refutes this proposition. Under GovVerify AI verification integrity safeguards, the absence of retrieved official documentation is never treated as proof that a statement is false.

[Mandatory Integrity Safeguard]
Absence of Proof ≠ Falsehood: Insufficient official evidence does not prove that this claim is false. It means GovVerify AI could not locate verified government records to validate or disprove it.
Missing Evidence Detail: Zero verified primary sources were retrieved for this claim. Candidate queries or unverified URLs do not count as evidence.
```

---

## 4. Verification & Automated Test Results

### Test Suite Summary

| Test Suite | Result | Details |
|---|---|---|
| `tests/claim_reason_explanation.test.ts` | **11 / 11 PASSED** | Validates all 4 verdicts, direct answers, assertions, quotes, citations, guardrails, console & view wiring |
| `tests/claim_verification_integrity.test.ts` | **15 / 15 PASSED** | Defensible confidence, decision trees, citation traceability, idempotency |
| `tests/roadmap_visibility_fix.test.ts` | **8 / 8 PASSED** | Preserves roadmap mounting, dynamic scheme discovery, fraud protection |
| `tests/action_guidance.test.ts` | **14 / 14 PASSED** | SSRF protection, questionnaire evaluation, guest authorization |
| `tests/official_source_verification.test.ts` | **15 / 15 PASSED** | Sovereign domain matching, excerpt validation, PIB adapter |
| `npm run lint` (`tsc --noEmit`) | **0 ERRORS** | Complete TypeScript type safety across all components and services |
| `npm run build` | **BUILD PASSED** | Production client bundle built in 317ms; API bundle built in 92ms |

---

## 5. Constraint Compliance Checklist

- [x] **Preserve existing architecture:** Built directly upon existing `verdictAnalysis.ts` and `ActionGuidanceSection`.
- [x] **No mock evidence in production:** Fallbacks use deterministic rules based strictly on retrieved evidence records.
- [x] **Never call a claim false merely because evidence is missing:** Unverified claims and assertions are strictly categorized as `NOT_ESTABLISHED` with an honest integrity notice.
- [x] **Do not use confidence score as explanation:** Explanations rely on factual records and official excerpts.
- [x] **Keep roadmap visible:** Scheme Application Roadmap remains prominently mounted and functional on all pages.
- [x] **Do not merge into `main`:** Changes remain on feature branch `feat/official-source-verification-engine`.
- [x] **Do not deploy to production:** Production domain `https://gov-verify-ai.vercel.app/` remains untouched.
