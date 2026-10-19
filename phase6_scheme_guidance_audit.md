# GovVerify AI — Phase 6: Personalized Government Scheme Guidance Architecture Audit

**Date & Time**: 2026-10-19T22:45:00+05:30  
**Repository**: GovVerify AI (`Mayurkhakare18/GovVerifyAI`)  
**Auditor / Engineer**: Antigravity Full-Stack Agent  
**Audit Purpose**: Pre-implementation audit and architectural design for Phase 6 (Personalized Government Scheme Guidance).  

---

## 1. Executive Summary

Phase 6 extends the citizen verification result flow in GovVerify AI so that when an incoming claim relates to an identifiable government scheme (welfare programme, subsidy, scholarship, pension, or public benefit), citizens can optionally explore the scheme and receive simple, personalized, source-grounded guidance on eligibility, required documents, enrollment steps, and verified official application links.

This audit evaluates the current implementation in `src/server/services/actionGuidance.ts`, `src/components/dashboard/ActionGuidanceSection.tsx`, `src/server/routes/api.ts`, Supabase tables, and official source registries. It establishes a minimal, non-destructive, and backward-compatible architecture adhering to all project safety constraints:
1. **Zero Database Migrations**: `public.action_guidance` already exists with a `guidance_data JSONB` column. All new structured scheme records, dynamic guides, and questionnaire states fit into this column.
2. **Preservation of Core Systems**: Gemini, Tavily, Supabase RLS, authentication, canonical 4-verdict decision trees, and SSRF protections remain strictly untouched and preserved.
3. **No Unwarranted False Positives**: Schemes mentioned in passing (e.g. *"Unlike PM-KISAN, this local scheme..."*) are rejected; meaningful connection is required.
4. **User Agency & Privacy**: Optional contextual prompt ("Interested in this scheme? We can explain eligibility, required documents, and how to apply.") allows citizens to explore or dismiss without mandatory data entry. No Aadhaar, PAN, passwords, or bank account numbers are ever collected.

---

## 2. Inspection of Existing Implementation

### 2.1 Backend Service: `src/server/services/actionGuidance.ts`
- **Data Contracts**: Defines `ActionGuidance`, `ActionServiceDetails`, `EligibilityCriterion`, `EligibilityEvaluationResult`, `RequiredDocumentItem`, `ChecklistTaskItem`, `FollowUpActionAnswer`, and `ValidatedServiceUrl`.
- **Static Scheme Knowledge Base**: Contains `KNOWN_SOVEREIGN_SCHEMES` covering 3 schemes:
  1. `Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)`
  2. `PM Surya Ghar: Muft Bijli Yojana`
  3. `Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (AB-PMJAY)`
- **Matching Logic**: Uses simple keyword substring matching (`scheme.keywords.some(kw => claimLower.includes(kw))`). If no keyword matches, falls back to generic placeholders.
- **SSRF & URL Validation**: Recently hardened with `isPrivateOrReservedIp` and manual redirect validation (`redirect: 'manual'`) in `checkOfficialDestinationReachability`.
- **Verdict Matching Rules**:
  - `CONTRADICTED`: Provides scam alert, warns against paying fees or entering OTPs, links to cybercrime.gov.in and PIB Fact Check. Does NOT provide application steps.
  - `INSUFFICIENT_EVIDENCE`: Advises caution, links to safe directories (myScheme, India.gov.in).
  - `SUPPORTED` / `PARTIALLY_SUPPORTED`: Provides scheme details, checklist, documents, and questionnaire.
- **Questionnaire Evaluation**: `evaluateEligibilityAnswers` compares user answers against `EligibilityCriterion.options[].isEligibleMatch`.
- **Persistence**: `getOrGenerateActionGuidance` caches results in-memory and executes a non-blocking upsert to `public.action_guidance(verification_request_id, guidance_data)`.

### 2.2 Frontend Component: `src/components/dashboard/ActionGuidanceSection.tsx`
- **Current Lifecycle**: Automatically fetches guidance upon mounting using `/api/v1/verify/:id/action-guidance`.
- **Rendered Sections**:
  1. Verdict-Aligned Advisory Box (`SUPPORTED_ACTION`, `CONDITIONAL_ACTION`, `CONTRADICTED_ALERT`, `UNVERIFIED_SAFE_SEARCH`).
  2. Identified Service / Program Overview Card.
  3. Official Destination Portal Callout (with sovereign badge and external link).
  4. Follow-Up Guidance Tabs (`check_eligibility`, `show_documents`, `explain_process`, `find_portal`, `rejection_recourse`).
  5. Interactive Eligibility Questionnaire (radio-option selection, submit button, evaluation result banner).
  6. Action Checklist (interactive checkboxes with `localStorage` persistence).
  7. Official Non-Affiliation and Entitlement Disclaimers.

### 2.3 API Routing: `src/server/routes/api.ts`
- `GET /api/v1/verify/:id/action-guidance`: Rate-limited (30 req/min), enforces user ownership and guest session token (`X-Guest-Token`). Returns existing or generated guidance.
- `POST /api/v1/verify/:id/action-guidance`: Generates/regenerates guidance.
- `POST /api/v1/verify/:id/action-guidance/evaluate-eligibility`: Rate-limited (30 req/min), evaluates submitted answers without saving PII.

### 2.4 Database Infrastructure (`supabase/migrations/`)
- `public.action_guidance` table:
  ```sql
  CREATE TABLE IF NOT EXISTS public.action_guidance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_request_id UUID NOT NULL UNIQUE REFERENCES public.verification_requests(id) ON DELETE CASCADE,
    has_actionable_service BOOLEAN NOT NULL DEFAULT false,
    guidance_data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- **RLS**: Row Level Security is active; allows authenticated users matching `verification_requests.user_id`, and `service_role` has full access.
- **Zero Schema Migrations**: Verified that no new tables or columns are required. All Phase 6 scheme guidance records fit cleanly into `guidance_data JSONB`.

---

## 3. Current Deficiencies & Architectural Gaps

| Area | Current Behavior | Phase 6 Requirement |
|---|---|---|
| **Scheme Detection** | Static keyword substring match against only 3 hardcoded schemes. | Hybrid detection: Gemini structured extraction + official source grounding validation + registry lookup. Dynamically discovers and guides on any legitimate Indian government scheme. |
| **Passing-Mention Handling** | Any claim containing "pm kisan" triggers the scheme card even if mentioned in an unrelated comparison. | Strict meaningful connection check: The claim must assert a benefit, rule, eligibility, or procedure of the scheme itself. |
| **Contextual Prompt & Opt-In** | Action guidance is immediately expanded below verification results, taking significant visual space. | Contextual prompt: *"Interested in this scheme? We can explain eligibility, required documents, and how to apply."* with explicit **"Explore scheme"** vs **"Dismiss"** actions. |
| **Source Grounding** | Static text from hardcoded records; ungrounded for dynamic schemes. | Real evidence passages, retrieved circular URLs, publication dates, and explicit limitation disclosures when details are missing or unconfirmed. |
| **Application vs Info Link** | If no application URL is found, shows generic placeholder. | Clear distinction between *Verified Scheme Information Page* and *Official Direct Application Portal*. If direct link is unconfirmed, displays informational page with clear notice. |
| **Eligibility Categorization** | Returns binary match/unmatch string. | Deterministic categorization into three canonical statuses: <br>1. *"Likely eligible based on your answers"*<br>2. *"May not meet a listed condition"*<br>3. *"Cannot determine from the available information"*. Never promises approval or payment. |
| **Document Classification** | Documents are a flat list. | Clear separation into **Mandatory Documents** vs **Conditional / Category-Specific Documents**. |

---

## 4. Phase 6 Implementation Architecture

```
                      Verified Verification Request
                                  │
                                  ▼
                     [Scheme Detection Engine]
             - Gemini structured extraction from claim + evidence
             - Cross-reference with Official Source Registry & Evidence URLs
             - Meaningful Connection Validator (Rejects passing mentions)
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
         [No Scheme Detected]            [Scheme Identified]
                  │                               │
        Hide Scheme Explorer Card                 ▼
        (Keep safety advisory if       [Contextual Guidance Prompt]
        contradicted/unverified)       "Interested in this scheme?"
                                       [Explore Scheme]  [Dismiss]
                                                  │
                                                  ▼
                                      [Source-Grounded Scheme Guide]
                                      1. Simple Overview
                                      2. Verified Benefits & Limits
                                      3. Eligibility Criteria Breakdown
                                      4. Mandatory vs Conditional Docs
                                      5. Step-by-Step Instructions
                                      6. Verified Info URL & App Link
                                      7. Deadlines & Contact Details
                                      8. Next Actions Checklist
                                                  │
                                                  ▼
                                    [Personalized Eligibility Questionnaire]
                                    - Conversational & Deterministic
                                    - Category-based (Age, Land, Income, State)
                                    - Explain why each detail is needed
                                    - Skip optional questions
                                    - Zero PII (No Aadhaar, Bank numbers, OTPs)
                                    - Outcome: Likely Eligible / May Not Meet / Cannot Determine
```

### 4.1 Scheme Detection Data Model
```typescript
export interface DetectedSchemeRecord {
  isSchemeDetected: boolean;
  schemeName: string;
  alternativeNames: string[];
  abbreviation?: string;
  administeringMinistry: string;
  jurisdiction: 'CENTRAL' | 'STATE' | 'UT' | 'JOINT';
  stateOrUtName?: string;
  schemeInformationUrl: string;
  applicationUrl?: string;
  isApplicationUrlVerified: boolean;
  meaningfulConnectionConfidence: number; // 0 to 100
  relevantEvidenceIds: string[];
  lastSourceVerificationTimestamp: string;
  sourceAuthority: string;
}
```

### 4.2 Dynamic Scheme Guide Data Model
```typescript
export interface StructuredSchemeGuide {
  overview: string;
  benefitsSummary: string;
  benefitLimits?: string;
  eligibilityExplanation: Array<{
    criterion: string;
    explanation: string;
    isMandatory: boolean;
  }>;
  requiredDocuments: {
    mandatory: RequiredDocumentItem[];
    conditional: RequiredDocumentItem[];
  };
  applicationInstructions: {
    mode: 'ONLINE' | 'OFFLINE' | 'HYBRID';
    onlineSteps: string[];
    offlineOfficeInstructions?: string[];
  };
  timelinesAndFees: {
    deadline: string | null;
    applicationFee: string | null;
    renewalRequirements?: string | null;
    helplineContact?: string | null;
    officialGrievancePortal?: string | null;
  };
  recommendedNextActions: string[];
  sourceCitations: Array<{
    title: string;
    url: string;
    domain: string;
    publicationDate?: string;
    retrievedAt: string;
  }>;
  uncertaintiesAndLimitations: string[];
}
```

### 4.3 Deterministic Eligibility Evaluation Model
```typescript
export type EligibilityVerdictCategory =
  | 'LIKELY_ELIGIBLE'
  | 'MAY_NOT_MEET_CONDITION'
  | 'CANNOT_DETERMINE';

export interface PersonalizedEligibilityAssessment {
  category: EligibilityVerdictCategory;
  headline: string;
  detailedAnalysis: string;
  matchedCriteria: Array<{ id: string; title: string; explanation: string }>;
  unmatchedCriteria: Array<{ id: string; title: string; explanation: string; conditionNote: string }>;
  unansweredCriteria: Array<{ id: string; title: string; reason: string }>;
  nextRecommendedSteps: string[];
  disclaimer: string;
}
```

---

## 5. Security, Privacy & Integrity Guarantees

1. **Zero High-Risk PII**:
   - The questionnaire only queries broad statutory categories (e.g. "Do you possess cultivable land?", "Are you aged 70 or older?", "Household income bracket").
   - Explicit guardrails reject inputs resembling 12-digit Aadhaar numbers, 10-character PANs, IFSC codes, bank account numbers, passwords, or OTPs.
2. **SSRF & Lookalike Domain Verification**:
   - Every application and information link displayed in the guide must pass `validateAndClassifyUrl` and `isPrivateOrReservedIp`.
   - Untrusted, secondary, or commercial portals are rejected.
   - If an application link cannot be verified on a sovereign `.gov.in` / `.nic.in` domain, the interface explicitly displays:
     > *"Official application link not verified. Direct application endpoint could not be confirmed with primary sovereign records. Refer to the verified scheme information page below."*
3. **Non-Affiliation & Non-Endorsement Disclaimers**:
   - Displayed prominently in the scheme guide header, questionnaire results, and footer.
   - Clear statement that GovVerify AI is an independent automated analysis tool, does not submit applications on behalf of citizens, and cannot guarantee scheme approval or financial disbursement.
4. **Verdict Independence**:
   - Guidance generation runs after or alongside verdict evaluation and **cannot** alter, weaken, or overwrite the canonical verification verdict (`SUPPORTED`, `PARTIALLY_SUPPORTED`, `CONTRADICTED`, `INSUFFICIENT_EVIDENCE`).

---

## 6. Testing & Validation Strategy

The Phase 6 extension will be validated with an automated test suite (`tests/phase6_scheme_guidance.test.ts`):
1. **Detection & False-Positive Rejection**:
   - Positive detection on PM-KISAN, PM Surya Ghar, Ayushman Bharat, and dynamic schemes.
   - Rejection of passing mentions (e.g., *"Unlike PM-KISAN, this local fraud..."*).
2. **Source-Grounded Extraction**:
   - Extraction of mandatory vs conditional documents.
   - Benefits and verified caps.
   - Online vs offline application instructions.
3. **Official Link Verification & SSRF Defense**:
   - Verification of `pmkisan.gov.in`, `pmsuryaghar.gov.in`, `beneficiary.nha.gov.in`.
   - Rejection of lookalikes (`pmsuryaghar.fake-subsidy.com`) and private IPs (`127.0.0.1`, `169.254.169.254`).
4. **Personalized Questionnaire Logic**:
   - `LIKELY_ELIGIBLE` when all mandatory conditions match.
   - `MAY_NOT_MEET_CONDITION` when an exclusion criterion is triggered.
   - `CANNOT_DETERMINE` when required inputs are skipped.
5. **UI & API Regression Testing**:
   - Backward compatibility for existing action guidance endpoints.
   - Full regression suite execution across all 16 existing test suites.

---

## 7. Audit Conclusion & Next Steps

The existing codebase and database schema provide a sound foundation for Phase 6. No database migration is required.

**Approval to proceed to Phase 6 Implementation:**
- Implement `detectSchemeFromClaimAndEvidence` and `buildSourceGroundedSchemeGuide` in `src/server/services/actionGuidance.ts`.
- Update API endpoints in `src/server/routes/api.ts`.
- Enhance `src/components/dashboard/ActionGuidanceSection.tsx` with the Contextual Guidance Prompt, Scheme Card, Document Breakdown, and Conversational Questionnaire.
- Author `tests/phase6_scheme_guidance.test.ts` and validate 100% test pass rate.
