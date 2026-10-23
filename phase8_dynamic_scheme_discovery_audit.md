# GovVerify AI — Phase 8 Audit & Implementation Plan
## Dynamic All-Scheme Discovery & Evidence-Grounded Application Roadmaps

**Date**: 2026-10-23  
**Status**: Audit Completed — Ready for Implementation  
**Target Milestone**: Phase 8 — Dynamic All-Scheme Discovery, Verification & Roadmap Generation

---

## 1. Executive Summary
In Phase 6 and Phase 7, GovVerify AI introduced sovereign scheme guidance and a 6-stage application roadmap. However, scheme detection, document mapping, milestone tracking, and roadmap generation currently depend on a static array of seven entries in `KNOWN_SOVEREIGN_SCHEMES` (`pm-kisan`, `pm-surya-ghar`, `ab-pmjay`, `atal-pension-yojana`, `pm-ujjwala`, `national-scholarship-portal`, `pm-awas-yojana`).

Any citizen claim regarding another central scheme (e.g. *Sukanya Samriddhi Yojana*, *PM Mudra Yojana*, *Stand-Up India*, *PM Vishwakarma*, *Atal Bhujal Yojana*), state government welfare initiatives (e.g. *Rythu Bandhu*, *Kanyashree Prakalpa*, *Gruha Lakshmi*, *Ladli Behna*, *Kalaignar Magalir Urimai Thogai*), or union territory/district programs currently fails scheme detection, returning `null` and producing zero roadmap guidance.

**Phase 8 Objective**: Remove the hard-coded 7-scheme limitation while keeping the 7 schemes fully supported as seed records. Implement dynamic discovery, source-content extraction, evidence grounding, state/jurisdiction awareness, and verdict-aware safety for legitimate government schemes across India.

---

## 2. Codebase Audit: Where `KNOWN_SOVEREIGN_SCHEMES` is Hard-Coded

### 2.1. Detection Engine (`src/server/services/actionGuidance.ts:2235-2307`)
```typescript
export function detectSchemeFromClaimAndEvidence(params: {
  originalClaim: string;
  evidence?: any[];
  sources?: any[];
}): DetectedSchemeRecord | null { ... }
```
- **Limitation**: Line 2247 and Line 2263 loop exclusively over `KNOWN_SOVEREIGN_SCHEMES`.
- **Impact**: Any claim or evidence referring to legitimate schemes outside the seven entries is discarded as `null`, even if verified `.gov.in` sources or `myscheme.gov.in` citations are present in the evidence.

### 2.2. Guidance Synthesizer (`src/server/services/actionGuidance.ts:2760-2815`)
```typescript
const matchedScheme = detectedScheme
  ? KNOWN_SOVEREIGN_SCHEMES.find((s) => s.id === detectedScheme.schemeId) || null
  : null;
```
- **Limitation**: `matchedScheme` requires finding a record in `KNOWN_SOVEREIGN_SCHEMES`.
- **Impact**: If a dynamic scheme were detected without an entry in `KNOWN_SOVEREIGN_SCHEMES`, `matchedScheme` is `null`, causing `buildSchemeApplicationRoadmap` and `buildSourceGroundedSchemeGuide` to receive `undefined` and fall back to generic non-scheme responses.

### 2.3. Scheme Definition Types (`src/server/services/actionGuidance.ts:498-537`)
- **Limitation**: `KnownServiceRecord` is typed for static records and lacks explicit fields for state/UT jurisdiction tagging (e.g. `stateOrUtName`), dynamic discovery provenance (`discoverySource`, `isDynamicallyDiscovered`), and confirmed vs unconfirmed attribute flags.
- **Impact**: State schemes cannot easily specify which State Government administers them without overloading `departmentOrMinistry`.

### 2.4. UI Component (`src/components/dashboard/ActionGuidanceSection.tsx`)
- **Current Capability**: The Phase 7 Stepper UI is already data-driven and renders from `guidance.roadmap`.
- **Limitation**: Jurisdiction badge displays only `CENTRAL` / `STATE` without naming the specific state (e.g. `STATE: TAMIL NADU` or `STATE: WEST BENGAL`).
- **Limitation**: Lacks an optional state context selector when a state scheme is detected but the citizen's state is unknown.
- **Limitation**: Does not visually distinguish which details were confirmed from official sources vs which are "official information not yet available".

---

## 3. Architecture of Dynamic Scheme Discovery Pipeline

```mermaid
flowchart TD
    A[Citizen Claim + Verified Evidence] --> B{Matches Seed Registry?}
    B -- Yes (7 Sovereign Schemes) --> C[Instant O(1) Seed Record Match]
    B -- No --> D[Extract Scheme Candidate from Verified Evidence]
    
    D --> E{Authoritative Sovereign Evidence Found?}
    E -- Yes --> F[Parse Official Name, Ministry, Jurisdiction, Rules]
    E -- No --> G[Query myscheme.gov.in / sovereign search via Tavily/Gemini]
    
    G --> H[Validate Domain & Content against Official Source Registry]
    H --> I{Is Genuine Government Programme?}
    I -- No (Private/Fake/Scam) --> J[Reject Scheme Detection / Issue Misinformation Alert]
    I -- Yes --> F
    
    F --> K[SSRF & Protocol Security Validation on Extracted URLs]
    K --> L[State & Jurisdiction Classification: Central vs State vs UT]
    L --> M[Attribute Grounding: Flag Confirmed vs Unavailable Details]
    M --> N[Cache in Dynamic Scheme Store]
    
    C --> O[Synthesize Evidence-Grounded Scheme Roadmap]
    N --> O
    O --> P[Verdict-Aware Guard: SUPPORTED / PARTIAL / CONTRADICTED / INSUFFICIENT]
    P --> Q[Render Accessible 6-Stage Stepper UI in Dashboard]
```

---

## 4. Implementation Plan

### Step 1: Extended Scheme Models & State Awareness
- Update `KnownServiceRecord` and `SchemeRoadmap` to support:
  - `stateOrUtName?: string` (e.g., "Maharashtra", "Telangana", "West Bengal", "Uttar Pradesh", "Delhi")
  - `isDynamicallyDiscovered?: boolean`
  - `discoveredFromUrl?: string`
  - `unconfirmedAttributes?: string[]` (e.g., `["Direct online application portal", "Enrollment deadline"]`)
  - `schemeStatus?: 'ACTIVE' | 'EXPIRED' | 'RENAMED' | 'DISPUTED'`

### Step 2: Dynamic Scheme Extractor & Discovery Pipeline
- Implement `discoverDynamicSchemeCandidate(params)` in `actionGuidance.ts`:
  1. Inspect existing verified evidence citations (`evidence[*].sources`).
  2. Parse scheme mentions, title patterns, acronyms, and gazette references.
  3. Query `myscheme.gov.in`, `india.gov.in`, or central/state portals via server-side search when evidence is sparse.
  4. Filter out private commercial apps, scam claims, and passing mentions.
  5. Deterministically classify jurisdiction:
     - Central: Mentioned under Central Ministries or all-India portals.
     - State: Mentioned under State Departments (e.g., `maharashtra.gov.in`, `karnataka.gov.in`, `tn.gov.in`, `wbschemes`).
     - Union Territory: Delhi, J&K, Ladakh, Puducherry, etc.
  6. Extract published benefits, limits, mandatory/conditional documents, and application steps.

### Step 3: Refactor Roadmap Synthesizer
- Update `buildSchemeApplicationRoadmap` to accept dynamically generated `KnownServiceRecord`.
- For any field not confirmed in evidence, output explicit unavailable notes instead of fabricating data.
- Enforce strict SSRF validation (`validateOfficialServiceUrl`) on any newly discovered URL.

### Step 4: Caching & Isolation Architecture
- Implement an in-memory TTL cache (`dynamicSchemeCache`) keyed by normalized scheme name/slug.
- Include verification timestamps and 24-hour refresh policy.
- Strictly isolate scheme definitions from citizen questionnaire answers or PII (zero cross-user leakage).

### Step 5: UI Enhancement in `ActionGuidanceSection.tsx`
- Show dynamic scheme jurisdiction banner with State/UT name (e.g., `STATE SCHEME: TELANGANA`).
- If state context is needed, render a non-intrusive state selection dropdown.
- Display "Confirmed by official source" vs "Official information not yet confirmed" indicators on roadmap cards.
- Preserve all existing Phase 7 stepper features, checklists, and local persistence.

### Step 6: Automated Test Suite (`tests/phase8_dynamic_scheme_discovery.test.ts`)
- Seed scheme compatibility (`pm-kisan`).
- Central scheme outside registry (e.g. *Sukanya Samriddhi Yojana*, *Stand-Up India*, *PM Mudra*).
- State government scheme (e.g. *Rythu Bandhu*, *Gruha Lakshmi*, *Kanyashree Prakalpa*, *Ladli Behna*).
- Multiple schemes in one claim.
- Private commercial app falsely claiming to be government scheme (Rejection & scam alert).
- Expired or renamed scheme handling.
- Snippet-only rejection without full source grounding.
- All 4 verdicts with dynamic schemes.
- SSRF and protocol safety on dynamically discovered URLs.
- Regression check on Phase 6 & 7 test suites.

---

## 5. Constraints & Compliance Verification
- **Database Migrations**: ZERO new database migrations. Reuses `action_guidance.guidance_data JSONB`.
- **PII Protection**: Rejects Aadhaar, PAN, bank numbers, passwords, OTPs. Zero sensitive logging.
- **Production Guard**: Stop before Production deployment and wait for explicit approval.
