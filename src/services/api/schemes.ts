/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { safeFetchJson } from '../../utils/safeFetch';
import { FALLBACK_SOVEREIGN_SCHEMES } from '../../data/fallbackSchemes';

export interface SourceCitation {
  title: string;
  url: string;
  domain: string;
  issuingAuthority: string;
}

export interface ApplicationProcedure {
  mode: 'ONLINE' | 'OFFLINE' | 'HYBRID';
  steps: string[];
  officialPortalUrl: string;
}

export interface SchemeItem {
  id: string;
  schemeName: string;
  shortName?: string;
  slug: string;
  administeringMinistry: string;
  department?: string;
  jurisdiction: 'CENTRAL' | 'STATE' | 'JOINT';
  state?: string;
  category: string;
  description: string;
  benefits: string;
  eligibilityConditions: string[];
  requiredDocuments: string[];
  applicationProcedure: ApplicationProcedure;
  officialUrl: string;
  sourceCitations: SourceCitation[];
  status: 'ACTIVE' | 'UPCOMING' | 'CLOSED' | 'DISCONTINUED' | 'RENAMED' | 'UNKNOWN';
  lastVerifiedDate: string;
}

export interface SchemeSearchFilters {
  query?: string;
  category?: string;
  jurisdiction?: 'CENTRAL' | 'STATE' | 'ALL';
  state?: string;
  status?: string;
}

export interface SchemeDiscoveryResponse {
  success: boolean;
  query: string;
  parsedIntent: {
    query: string;
    targetDemographic?: string;
    jurisdiction?: string;
    state?: string;
    category?: string;
    benefitType?: string;
    rawIntentSummary: string;
  };
  totalFound: number;
  schemes: SchemeItem[];
  similarSchemes: SchemeItem[];
  sourceHierarchyNotice: string;
  cached: boolean;
}

export interface EligibilityResult {
  schemeId: string;
  schemeName: string;
  evaluationStatus: 'POTENTIALLY_ELIGIBLE' | 'CRITERIA_UNMET' | 'INSUFFICIENT_INFORMATION';
  matchedCriteria: string[];
  missingCriteria: string[];
  unmetCriteria: string[];
  advisoryNote: string;
}

export type ConditionOutcome =
  | 'SATISFIED'
  | 'NOT_SATISFIED'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

export type OverallEligibilityStatus =
  | 'POTENTIALLY_ELIGIBLE'
  | 'CRITERIA_UNMET'
  | 'INSUFFICIENT_INFORMATION';

export type DocumentReadinessStatus =
  | 'AVAILABLE'
  | 'MISSING'
  | 'REQUIRES_VALIDITY_CHECK';

export interface ConditionEvaluation {
  conditionIndex: number;
  conditionText: string;
  outcome: ConditionOutcome;
  isMandatory: boolean;
  citizenInputSummary: string;
  reason: string;
  sourceCitation: SourceCitation;
}

export interface DocumentReadinessItem {
  documentName: string;
  status: DocumentReadinessStatus;
  notes: string;
  issuingAuthority: string;
  howToObtain: string;
  officialPortalUrl?: string;
}

export interface AlternativeSchemeRecommendation {
  id: string;
  schemeName: string;
  shortName?: string;
  category: string;
  benefits: string;
  matchReason: string;
  officialUrl: string;
  evaluationNotice: string;
}

export interface DetailedEligibilityAssessment {
  schemeId: string;
  schemeName: string;
  overallStatus: OverallEligibilityStatus;
  summaryTitle: string;
  summaryExplanation: string;
  mandatoryDisclaimer: string;
  conditionBreakdown: ConditionEvaluation[];
  documentReadiness: {
    totalRequired: number;
    availableCount: number;
    missingCount: number;
    validityCheckCount: number;
    checklist: DocumentReadinessItem[];
  };
  alternativeSchemes?: AlternativeSchemeRecommendation[];
  evaluatedAt: string;
}

export interface CitizenProfileInput {
  age?: number;
  state?: string;
  annualIncomeLakhs?: number;
  educationLevel?: string;
  occupation?: string;
  isLandholder?: boolean;
  landHoldingHectares?: number;
  isBusinessOwner?: boolean;
  businessType?: string;
  casteCategory?: string;
  gender?: string;
  isCollegeEnrolled?: boolean;
  attendancePercentage?: number;
  isKutchaHouse?: boolean;
  hasElectricityConnection?: boolean;
  hasActiveCropLoan?: boolean;
  isTaxPayee?: boolean;
  declaredDocuments?: string[];
}

// ==============================================================================
// PHASE 7: APPLICATION ASSISTANCE & GUIDANCE TYPES
// ==============================================================================

export type ApplicationMethod = 'ONLINE' | 'OFFLINE' | 'BOTH';

export interface WhereToObtainGuidance {
  authority: string;
  channel: 'ONLINE' | 'OFFLINE' | 'BOTH';
  portalName?: string;
  portalUrl?: string;
  instructions: string;
}

export interface ApplicationDocumentItem {
  documentId: string;
  documentName: string;
  description: string;
  isMandatory: boolean;
  formatRequirements: string;
  validityRequirements: string;
  whereToObtain: WhereToObtainGuidance;
}

export interface VerificationApprovalMilestone {
  stageNumber: number;
  stageName: string;
  responsibleAuthority: string;
  description: string;
  estimatedTimelineOrNote: string;
}

export interface ApplicationRoadmapData {
  schemeId: string;
  schemeName: string;
  ministryOrDepartment: string;
  applicationMethod: ApplicationMethod;
  officialApplicationPortal: string;
  isApplicationPortalVerified: boolean;
  applicationStartAndEndDates: {
    startDate: string;
    endDate: string;
    isVerified: boolean;
    note: string;
  };
  stepByStepInstructions: {
    online: string[];
    offline: string[];
  };
  requiredDocuments: ApplicationDocumentItem[];
  documentPreparationInstructions: string[];
  submissionAuthority: string;
  verificationAndApprovalProcess: VerificationApprovalMilestone[];
  officialContactAndGrievance: {
    helplinePhone?: string;
    helplineEmail?: string;
    grievancePortalName?: string;
    grievancePortalUrl?: string;
  };
  sourceCitations: SourceCitation[];
  statutoryDisclaimer: string;
}

export interface DocumentChecklistPreparationItem extends ApplicationDocumentItem {
  isReady: boolean;
}

export interface DocumentPreparationChecklistData {
  schemeId: string;
  schemeName: string;
  totalDocuments: number;
  readyCount: number;
  missingCount: number;
  readinessPercentage: number;
  documents: DocumentChecklistPreparationItem[];
  officialGuidanceNotice: string;
  privacyNotice: string;
}

export interface ApplicationStatusGuidanceData {
  schemeId: string;
  schemeName: string;
  currentStatus: string;
  statusMeaning: string;
  nextSteps: string[];
  trackingMethods: {
    channel: string;
    instructions: string;
    portalUrl?: string;
  }[];
  officialRecourseOrAppeal?: {
    available: boolean;
    channel: string;
    instructions: string;
    portalUrl?: string;
    timelineOrNote?: string;
  };
  disclaimer: string;
}

export interface ApplicationAssistantAnswer {
  answer: string;
  isVerified: boolean;
  citations: SourceCitation[];
  disclaimer: string;
}

class SchemeApiService {
  /**
   * Natural-language scheme discovery using Gemini intent parsing
   * with zero-latency resilient offline sovereign fallback.
   */
  public async discoverSchemes(filters: SchemeSearchFilters): Promise<SchemeDiscoveryResponse> {
    try {
      const res = await safeFetchJson<SchemeDiscoveryResponse>('/api/v1/schemes/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });

      if (res.ok && res.data && Array.isArray(res.data.schemes) && res.data.schemes.length > 0) {
        return res.data;
      }
    } catch (err: any) {
      console.warn('[GovVerify AI] Primary discovery API notice (activating sovereign fallback):', err?.message);
    }

    // Resilient offline fallback against sovereign baseline schemes
    const q = (filters.query || '').trim().toLowerCase();
    const cat = filters.category && filters.category !== 'All Categories' ? filters.category.toLowerCase() : '';
    const jur = filters.jurisdiction && filters.jurisdiction !== 'ALL' ? filters.jurisdiction : '';
    const st = (filters.state || '').trim().toLowerCase();
    const stat = filters.status && filters.status !== 'ALL' ? filters.status : '';

    const matched = FALLBACK_SOVEREIGN_SCHEMES.filter((s) => {
      if (jur && s.jurisdiction !== jur) return false;
      if (st && (!s.state || !s.state.toLowerCase().includes(st))) return false;
      if (cat && !s.category.toLowerCase().includes(cat)) return false;
      if (stat && s.status !== stat) return false;

      if (q) {
        const hay = `${s.schemeName} ${s.shortName || ''} ${s.description} ${s.benefits} ${s.category} ${s.administeringMinistry} ${s.state || ''}`.toLowerCase();
        const terms = q.split(/\s+/).filter(Boolean);
        const hasMatch = terms.some((term) => hay.includes(term));
        if (!hasMatch) return false;
      }
      return true;
    });

    const activeList = matched.length > 0 ? matched : FALLBACK_SOVEREIGN_SCHEMES;

    return {
      success: true,
      query: filters.query || '',
      parsedIntent: {
        query: filters.query || '',
        jurisdiction: filters.jurisdiction || 'ALL',
        rawIntentSummary: filters.query ? `Sovereign directory search for ${filters.query}` : 'Sovereign verified scheme catalogue',
      },
      totalFound: activeList.length,
      schemes: activeList,
      similarSchemes: [],
      sourceHierarchyNotice: 'Sovereign Repositories: myscheme.gov.in · mahadbt.maharashtra.gov.in · pib.gov.in',
      cached: false,
    };
  }

  /**
   * Retrieves specific scheme details by slug or ID with sovereign fallback.
   */
  public async getSchemeDetails(slugOrId: string): Promise<SchemeItem> {
    try {
      const res = await safeFetchJson<{ scheme: SchemeItem }>(
        `/api/v1/schemes/${encodeURIComponent(slugOrId)}`
      );
      if (res.ok && res.data?.scheme) {
        return res.data.scheme;
      }
    } catch {
      // Ignore and check fallback
    }

    const found = FALLBACK_SOVEREIGN_SCHEMES.find(
      (s) => s.id === slugOrId || s.slug === slugOrId
    );
    if (found) {
      return found;
    }

    throw new Error('Scheme details not found in sovereign registry.');
  }

  /**
   * Evaluates citizen eligibility against statutory criteria.
   */
  public async checkEligibility(
    schemeId: string,
    citizenDetails: Record<string, any>
  ): Promise<EligibilityResult> {
    const res = await safeFetchJson<{ evaluation: EligibilityResult }>(
      '/api/v1/schemes/match-eligibility',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeId, citizenDetails }),
      }
    );

    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Eligibility check failed.');
    }
    return res.data.evaluation;
  }

  /**
   * Phase 6: Granular personalized eligibility assessment.
   * Evaluates all conditions independently, assesses document readiness,
   * and provides official guidance without collecting sensitive identifiers.
   */
  public async evaluatePersonalizedEligibility(
    schemeId: string,
    citizenProfile: CitizenProfileInput
  ): Promise<DetailedEligibilityAssessment> {
    const res = await safeFetchJson<{ assessment: DetailedEligibilityAssessment }>(
      '/api/v1/schemes/evaluate-eligibility',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeId, citizenProfile }),
      }
    );

    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Personalized assessment evaluation failed.');
    }
    return res.data.assessment;
  }

  /**
   * Phase 7: Official Application Roadmap
   */
  public async getApplicationRoadmap(schemeId: string): Promise<ApplicationRoadmapData> {
    const res = await safeFetchJson<{ roadmap: ApplicationRoadmapData }>(
      `/api/v1/schemes/${encodeURIComponent(schemeId)}/application-guidance`
    );
    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Failed to load application guidance roadmap.');
    }
    return res.data.roadmap;
  }

  /**
   * Phase 7: Document Preparation Checklist
   */
  public async getDocumentChecklist(
    schemeId: string,
    readyIds: string[] = []
  ): Promise<DocumentPreparationChecklistData> {
    const query = readyIds.length > 0 ? `?ready=${readyIds.map(encodeURIComponent).join(',')}` : '';
    const res = await safeFetchJson<{ checklist: DocumentPreparationChecklistData }>(
      `/api/v1/schemes/${encodeURIComponent(schemeId)}/document-checklist${query}`
    );
    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Failed to load document checklist.');
    }
    return res.data.checklist;
  }

  /**
   * Phase 7: Application Status Guidance
   */
  public async getStatusGuidance(
    schemeId: string,
    status: string
  ): Promise<ApplicationStatusGuidanceData> {
    const res = await safeFetchJson<{ guidance: ApplicationStatusGuidanceData }>(
      `/api/v1/schemes/${encodeURIComponent(schemeId)}/status-guidance?status=${encodeURIComponent(status)}`
    );
    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Failed to load application status guidance.');
    }
    return res.data.guidance;
  }

  /**
   * Phase 7 & 8: Multilingual AI Scheme Application Assistant
   */
  public async askApplicationAssistant(
    schemeId: string,
    query: string,
    language?: string
  ): Promise<ApplicationAssistantAnswer> {
    const res = await safeFetchJson<ApplicationAssistantAnswer>(
      `/api/v1/schemes/${encodeURIComponent(schemeId)}/application-assistance`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, language }),
      }
    );
    if (!res.ok || !res.data) {
      throw new Error(res.error || 'Application assistance request failed.');
    }
    return res.data;
  }
}

export const schemeApi = new SchemeApiService();
