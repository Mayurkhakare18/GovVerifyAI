export type VerificationVerdict =
  | 'SUPPORTED'
  | 'PARTIALLY_SUPPORTED'
  | 'CONTRADICTED'
  | 'INSUFFICIENT_EVIDENCE';

export interface VerdictDefinition {
  verdict: VerificationVerdict;
  label: string;
  badgeColor: string;
  borderColor: string;
  description: string;
  exampleScenario: string;
}

export interface ExampleClaim {
  id: string;
  category: string;
  title: string;
  claimText: string;
  targetMinistry: string;
  whyPeopleAsk: string;
  iconName?: string;
}

export interface VerificationPrinciple {
  id: string;
  title: string;
  description: string;
  impact: string;
  iconName: string;
}

export interface SchemeCategory {
  id: string;
  name: string;
  description: string;
  commonExamples: string[];
  primarySources: string[];
  iconName: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: 'general' | 'sources' | 'privacy' | 'technical';
}

export interface ClaimValidationResult {
  isValid: boolean;
  errorMessage?: string;
  charCount: number;
}

export interface FileValidationResult {
  isValid: boolean;
  errorMessage?: string;
  file?: File;
}
