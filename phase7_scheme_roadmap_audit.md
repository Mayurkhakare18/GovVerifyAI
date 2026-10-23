# GovVerify AI — Phase 7: Evidence-Grounded Government Scheme Application Roadmap Architecture Audit & Implementation Plan

**Date**: 2026-10-23T16:20:00+05:30  
**Repository**: `Mayurkhakare18/GovVerifyAI`  
**Engineer**: Antigravity AI  
**Status**: Pre-Implementation Audit Complete  

---

## 1. Executive Summary & Objective

In Phase 6, GovVerify AI introduced personalized government scheme guidance with a preliminary questionnaire, passing-mention suppression, and verified portal validation. 

**Phase 7 Objective**: Transform and elevate this functionality into an **Evidence-Grounded Government Scheme Application Roadmap**. When a citizen submits a claim, GovVerify AI:
1. Verifies the claim using authoritative official evidence.
2. Detects whether it genuinely concerns a government scheme.
3. Preserves the existing verdict, confidence, subclaims, evidence excerpts, and source citations.
4. Offers an optional, user-friendly 6-stage application roadmap explaining how to understand benefits, explore eligibility, prepare required papers, apply online/offline, track status, and follow up.
5. Guides the citizen through preparation, application, and post-submission recourse without ever pretending to be a government authority, guaranteeing benefits, or attempting automated submissions.

---

## 2. Phase A Audit Findings

### 2.1 Service & Model Inspection
- **`src/server/services/actionGuidance.ts`**:
  - Implements `DetectedSchemeRecord`, `StructuredSchemeGuide`, `ActionServiceDetails`, and `KNOWN_SOVEREIGN_SCHEMES` (7 schemes: PM-KISAN, PM Surya Ghar, Ayushman Bharat, Atal Pension Yojana, PM Ujjwala, National Scholarship Portal, PM Awas Yojana).
  - Implements SSRF defense (`validateOfficialServiceUrl`, `checkOfficialDestinationReachability`, `isPrivateOrReservedIp`), passing-mention filtering (`isPassingMention`), and PII detection (`detectSensitivePii`).
  - *Gap for Phase 7*: Currently structures guidance in separate disjoint sections (Overview, Tabbed online/offline steps, Documents, Questionnaire, Checklist, Portal card, Follow-up Q&A) rather than a cohesive 6-stage sequential roadmap with application tracking, approval milestones, and "where to obtain documents" authoritative guidance.
- **`src/components/dashboard/ActionGuidanceSection.tsx`**:
  - Renders contextual prompt, structured card, questionnaire, checklist, portal link, and follow-up tabs.
  - *Gap for Phase 7*: Lacks an accessible 6-step interactive stepper layout (`Understand` → `Check Eligibility` → `Prepare Documents` → `Apply` → `Track Application` → `Follow Up`) with step-progress state, active step navigation, "where to obtain" document badges, and post-submission milestone visualization.
- **`src/server/services/officialSourceRegistry.ts` & `sourceDiscovery.ts`**:
  - Houses 236+ lines of sovereign domain classifications, trust tiers (1 to 4), and SSRF filters.
  - Reusable without modification.
- **`src/server/services/verdictAnalysis.ts`**:
  - Emits the canonical 4 verdicts (`SUPPORTED`, `PARTIALLY_SUPPORTED`, `CONTRADICTED`, `INSUFFICIENT_EVIDENCE`).
  - Preserved strictly without regression.
- **Supabase Data Model & Migrations (`public.action_guidance`)**:
  - Table schema:
    ```sql
    CREATE TABLE public.action_guidance (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      verification_request_id UUID NOT NULL UNIQUE REFERENCES public.verification_requests(id) ON DELETE CASCADE,
      has_actionable_service BOOLEAN NOT NULL DEFAULT false,
      guidance_data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ```
  - **Verdict on Persistence**: **Zero schema migrations needed.** The `guidance_data JSONB` column cleanly accommodates the extended `SchemeRoadmap` interface, roadmap steps, tracking stages, and local checklist states.
  - **RLS & Security**: Read access is strictly guarded by `vr.user_id = auth.uid()`, with server operations mediated by `getServerSupabase()`.
- **API Routing (`src/server/routes/api.ts`)**:
  - Endpoints:
    - `GET /api/v1/verify/:id/action-guidance`
    - `POST /api/v1/verify/:id/action-guidance`
    - `POST /api/v1/verify/:id/action-guidance/evaluate-eligibility`
  - Already enforced with rate limits (30 req/min) and ownership/guest token checks.
- **Vercel Deployment**:
  - `vercel.json` rewrites `/api/(.*)` to `/api/index.js`.
  - Built with `esbuild src/server/apiEntry.ts --bundle --target=node20`.

### 2.2 Smallest Missing Capabilities
1. **Scheme Roadmap Data Contract**:
   - Explicit 6-step roadmap model (`SchemeRoadmap`) containing:
     1. Stage 1: Understand Scheme & Benefit (benefit limits, frequency, duration, fees, general rules vs individual eligibility).
     2. Stage 2: Check Eligibility (documented criteria, "Why we ask", deterministic 3-category evaluation, PII protection, non-guarantee).
     3. Stage 3: Prepare Documents (mandatory vs conditional, "where to obtain" from authoritative sources, zero credential upload).
     4. Stage 4: Apply Online or Offline (validated portal link, numbered steps, CSC/offline instructions).
     5. Stage 5: Track Application (tracking URL, tracking ID usage, documented verification/approval milestones: e.g. L1/L2 or geo-tagging).
     6. Stage 6: Follow Up & Recourse (official grievance portals, helplines, correction methods, delay recourse).
2. **Where to Obtain Documents**:
   - Each required document needs authoritative issuing authority details and exact official portal / office to obtain it (e.g. UIDAI for Aadhaar, State Land Records / Bhulekh for Jamabandi, Bank for NPCI seeding, DISCOM for electricity bills, etc.).
3. **Verdict-Aware Behavior**:
   - `PARTIALLY_SUPPORTED`: Display warning flag identifying unsupported claims while providing the roadmap for the verified scheme.
   - `CONTRADICTED`: Display prominent scam/misinformation warning; do not direct citizens to apply on false premise; show authentic scheme info only for citizen awareness.
   - `INSUFFICIENT_EVIDENCE`: State that claim is unverified; provide safe sovereign directories (myScheme/India.gov.in); separate authentic schemes from unverified assertions.
4. **Interactive Stepper UI**:
   - Transform `ActionGuidanceSection.tsx` into an accessible 6-step progress stepper with step navigation, completion state, responsive mobile/desktop layout, and resume capability via `localStorage`.

---

## 3. Implementation Plan

### Step 1: Extend Data Contracts & Registry in `src/server/services/actionGuidance.ts`
- Define `SchemeRoadmap`, `RoadmapStage`, `DocumentWhereToObtain`, `TrackingStageMilestone`, `PostSubmissionRecourse`.
- Enhance `KnownServiceRecord` and `KNOWN_SOVEREIGN_SCHEMES` for all 7 schemes with:
  - Benefit frequency, duration, applicable fees.
  - "Where to obtain" for every document.
  - Documented verification and approval stages (e.g. L1/L2 nodal officers, DISCOM solar feasibility inspection, geo-tagging of plinth/roof, OMC de-duplication).
  - Official application tracking steps and portal URLs.
- Update `buildSourceGroundedSchemeGuide` and `generateActionGuidance` to produce the 6-stage `roadmap`.
- Ensure unknown schemes generate only evidence-grounded stages or an explicit "Official application details not yet available" disclosure.

### Step 2: Implement Verdict-Aware Roadmap Flags
- In `generateActionGuidance`:
  - `SUPPORTED`: Embed full roadmap with verified badges.
  - `PARTIALLY_SUPPORTED`: Add `unsupportedClaimWarning` highlighting unsupported viral numbers/mandates while guiding on the genuine scheme.
  - `CONTRADICTED`: Set `advisoryType: 'CONTRADICTED_ALERT'`, block false application links, surface cybercrime reporting and official PIB debunking.
  - `INSUFFICIENT_EVIDENCE`: Set `advisoryType: 'UNVERIFIED_SAFE_SEARCH'`, link to myScheme directory, clearly separate unresolved claim from genuine government programs.

### Step 3: Upgrade `ActionGuidanceSection.tsx` with Stepper UI
- Create an accessible, responsive 6-step Stepper:
  - Step 1: Understand Scheme & Benefit
  - Step 2: Check Eligibility (with "Why we ask", PII filter, 3-category evaluation)
  - Step 3: Prepare Documents (with Mandatory/Conditional badges, "Where to obtain" authoritative links)
  - Step 4: Apply (Online Portal vs Offline CSC tabs with verified sovereign domain confirmation)
  - Step 5: Track Application (Tracking stages, milestone timeline, acknowledgment number storage reminder)
  - Step 6: Follow Up & Recourse (Helplines, CPGRAMS/CGRMS, correction steps)
- Add "Next Step" / "Previous Step" navigation buttons and progress bar ("Step X of 6").
- Persist roadmap active step and completed checklist items in `localStorage` under `govverify_roadmap_${requestId}`.
- Prominently feature independent civic research non-affiliation disclaimers.

### Step 4: Automated Testing & Verification
- Create `tests/phase7_scheme_roadmap.test.ts` covering:
  1. 6-stage roadmap data structure and contents for all 7 schemes.
  2. Verdict-aware behavior (`SUPPORTED`, `PARTIALLY_SUPPORTED`, `CONTRADICTED`, `INSUFFICIENT_EVIDENCE`).
  3. Where-to-obtain documents traceability and condition descriptions.
  4. Post-submission tracking instructions and approval milestones.
  5. Unknown scheme handling and honest disclosure of unconfirmed details.
  6. PII rejection and zero credential logging.
  7. API route integration and ownership authorization.
  8. Responsive UI component accessibility and token checks.
- Run `npm run lint` and `npm run build` to guarantee zero regressions.
