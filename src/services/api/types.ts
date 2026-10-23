import { VerificationVerdict } from '../../types';

export interface ClaimVerificationRequest {
  claimText: string;
  category?: string;
  language?: string;
  requestedAt: string;
}

export interface VerificationEvidenceReference {
  id: string;
  sourceTitle: string;
  sourceUrl: string;
  officialPublisher: string; // e.g. Ministry of Agriculture & Farmers Welfare, PIB
  publicationDate?: string;
  documentNumberOrGazetteId?: string;
  relevantExcerpt: string;
  relevanceExplanation: string;
  verdictContribution: VerificationVerdict;
}

export type ReasonAssertionStatus = 'SUPPORTED' | 'CONTRADICTED' | 'NOT_ESTABLISHED';

export interface ReasonAssertionDetail {
  assertion: string;
  status: ReasonAssertionStatus;
  explanation: string;
  officialFactInstead?: string;
  sourceQuote?: string;
  sourceCitationId?: string;
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

export interface AtomicClaimBreakdown {
  statement: string;
  verdict: VerificationVerdict;
  explanation: string;
}

export interface ClaimVerificationResponse {
  id: string;
  originalClaim: string;
  verdict: VerificationVerdict;
  summaryExplanation: string;
  reasonExplanation?: ClaimReasonExplanation;
  atomicBreakdown: AtomicClaimBreakdown[];
  evidenceReferences: VerificationEvidenceReference[];
  confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW';
  processedAt: string;
  engineVersion: string;
}

export interface CandidateExtractedClaim {
  id: string;
  claimText: string;
  category?: string;
  context?: string;
  confidence?: number;
}

export interface DocumentVerificationRequest {
  file: File;
  documentCategory?: string;
}

export interface DocumentVerificationResponse {
  documentId: string;
  fileName: string;
  extractedClaimsCount: number;
  extractedClaims: string[];
}

export interface DocumentExtractionApiResponse {
  documentId: string;
  status: 'SUCCESS' | 'UNREADABLE_DOCUMENT' | 'NO_FACTUAL_CLAIMS_FOUND';
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  pageCount: number;
  sha256Hash: string;
  extractedTextPreview: string;
  candidateClaims: CandidateExtractedClaim[];
  warnings?: string[];
  guestToken?: string;
  expiresAt?: string;
  message: string;
}

export interface ApiStatusResponse {
  configured: boolean;
  phase: string;
  message: string;
  targetServices: {
    database: string;
    auth: string;
    ai: string;
    search: string;
  };
}
