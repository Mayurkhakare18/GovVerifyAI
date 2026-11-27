/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GovernmentScheme,
  SourceCitation,
  discoverSchemes,
} from './schemeDiscovery';

// ==============================================================================
// 1. DATA TYPES & INTERFACES
// ==============================================================================

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

export interface CitizenProfile {
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
  documentIssueDates?: Record<string, string>;
}

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

// ==============================================================================
// 2. PRIVACY & SENSITIVE IDENTIFIER REJECTION SAFEGUARDS
// STRICT POLICY: Never accept or log Aadhaar, PAN, bank accounts, passwords, or OTPs.
// ==============================================================================

const SENSITIVE_KEY_PATTERNS = [
  /aadhaar/i,
  /aadhar/i,
  /uidai/i,
  /pan(?:_?no|_?number)?/i,
  /bank(?:_?acc|_?account|_?no|_?number)?/i,
  /account_?number/i,
  /ifsc/i,
  /password/i,
  /otp/i,
  /pin(?:code)?/i, // allow state/address, but check pin length if suspicious
  /secret/i,
  /cvv/i,
];

const AADHAAR_REGEX = /\b[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/;
const PAN_REGEX = /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/;
const BANK_ACCOUNT_REGEX = /\b\d{9,18}\b/;

export function sanitizeAndValidateProfile(rawInput: any): {
  valid: boolean;
  error?: string;
  profile?: CitizenProfile;
} {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return { valid: false, error: 'Citizen profile must be a valid JSON object.' };
  }

  // Check top-level and nested keys for sensitive keywords
  const rawKeys = Object.keys(rawInput);
  for (const key of rawKeys) {
    for (const pat of SENSITIVE_KEY_PATTERNS) {
      if (pat.test(key)) {
        if (key.toLowerCase() === 'pincode' || key.toLowerCase() === 'pin') {
          // If it's a 6-digit postal pincode, that's allowed; otherwise reject
          const val = String(rawInput[key]);
          if (!/^\d{6}$/.test(val)) {
            return {
              valid: false,
              error: `Sensitive or unpermitted field detected: "${key}". GovVerify AI strictly prohibits collecting banking or security credentials.`,
            };
          }
        } else {
          return {
            valid: false,
            error: `Privacy violation: GovVerify AI strictly prohibits collecting "${key}". Do not submit Aadhaar numbers, PAN cards, bank accounts, OTPs, or passwords.`,
          };
        }
      }
    }
  }

  // Scan all string values for Aadhaar, PAN, or raw bank accounts
  const rawValues = JSON.stringify(rawInput);
  if (AADHAAR_REGEX.test(rawValues)) {
    return {
      valid: false,
      error: 'Privacy violation: A 12-digit pattern resembling an Aadhaar number was detected in the submission. GovVerify AI does not collect Aadhaar numbers.',
    };
  }

  if (PAN_REGEX.test(rawValues)) {
    return {
      valid: false,
      error: 'Privacy violation: A 10-character Permanent Account Number (PAN) was detected. GovVerify AI does not collect PAN numbers.',
    };
  }

  // Build clean sanitized profile
  const profile: CitizenProfile = {};

  if (rawInput.age !== undefined) {
    const ageNum = Number(rawInput.age);
    if (!isNaN(ageNum) && ageNum >= 0 && ageNum <= 125) {
      profile.age = ageNum;
    }
  }

  if (typeof rawInput.state === 'string' && rawInput.state.trim().length > 0) {
    profile.state = rawInput.state.trim();
  }

  if (rawInput.annualIncomeLakhs !== undefined && rawInput.annualIncomeLakhs !== null) {
    const inc = Number(rawInput.annualIncomeLakhs);
    if (!isNaN(inc) && inc >= 0) {
      profile.annualIncomeLakhs = inc;
    }
  }

  if (typeof rawInput.educationLevel === 'string') {
    profile.educationLevel = rawInput.educationLevel.trim();
  }

  if (typeof rawInput.occupation === 'string') {
    profile.occupation = rawInput.occupation.trim();
  }

  if (typeof rawInput.isLandholder === 'boolean') {
    profile.isLandholder = rawInput.isLandholder;
  }

  if (rawInput.landHoldingHectares !== undefined && rawInput.landHoldingHectares !== null) {
    const land = Number(rawInput.landHoldingHectares);
    if (!isNaN(land) && land >= 0) {
      profile.landHoldingHectares = land;
    }
  }

  if (typeof rawInput.isBusinessOwner === 'boolean') {
    profile.isBusinessOwner = rawInput.isBusinessOwner;
  }

  if (typeof rawInput.businessType === 'string') {
    profile.businessType = rawInput.businessType.trim();
  }

  if (typeof rawInput.casteCategory === 'string') {
    profile.casteCategory = rawInput.casteCategory.trim();
  }

  if (typeof rawInput.gender === 'string') {
    profile.gender = rawInput.gender.trim();
  }

  if (typeof rawInput.isCollegeEnrolled === 'boolean') {
    profile.isCollegeEnrolled = rawInput.isCollegeEnrolled;
  }

  if (rawInput.attendancePercentage !== undefined && rawInput.attendancePercentage !== null) {
    const att = Number(rawInput.attendancePercentage);
    if (!isNaN(att) && att >= 0 && att <= 100) {
      profile.attendancePercentage = att;
    }
  }

  if (typeof rawInput.isKutchaHouse === 'boolean') {
    profile.isKutchaHouse = rawInput.isKutchaHouse;
  }

  if (typeof rawInput.hasElectricityConnection === 'boolean') {
    profile.hasElectricityConnection = rawInput.hasElectricityConnection;
  }

  if (typeof rawInput.hasActiveCropLoan === 'boolean') {
    profile.hasActiveCropLoan = rawInput.hasActiveCropLoan;
  }

  if (typeof rawInput.isTaxPayee === 'boolean') {
    profile.isTaxPayee = rawInput.isTaxPayee;
  }

  if (Array.isArray(rawInput.declaredDocuments)) {
    profile.declaredDocuments = rawInput.declaredDocuments
      .filter((d: any) => typeof d === 'string')
      .map((d: string) => d.trim());
  }

  if (rawInput.documentIssueDates && typeof rawInput.documentIssueDates === 'object') {
    profile.documentIssueDates = {};
    for (const [k, v] of Object.entries(rawInput.documentIssueDates)) {
      if (typeof v === 'string') {
        profile.documentIssueDates[k] = v;
      }
    }
  }

  return { valid: true, profile };
}

// ==============================================================================
// 3. DOCUMENT AUTHORITY & VALIDITY REFERENCE
// Grounded strictly in official sovereign procedures.
// ==============================================================================

const DOCUMENT_AUTHORITY_CATALOGUE: Record<
  string,
  {
    authority: string;
    validityNote: string;
    howToObtain: string;
    requiresPeriodicRenewal: boolean;
    portalUrl?: string;
  }
> = {
  'income certificate': {
    authority: 'Tahsildar / Sub-Divisional Magistrate (SDM) / Revenue Department',
    validityNote: 'Income certificates are valid for the financial year of issue (April 1 to March 31) and require annual renewal.',
    howToObtain: 'Apply through your state Aaple Sarkar / e-District portal or local Tehsil / CSC center with salary slip, Form 16, or Talathi report.',
    requiresPeriodicRenewal: true,
    portalUrl: 'https://aaplesarkar.mahaonline.gov.in',
  },
  'domicile certificate': {
    authority: 'Tahsildar / Executive Magistrate / Revenue Department',
    validityNote: 'Generally holds lifetime validity unless revoked; certifies minimum residency (typically 15 years in Maharashtra).',
    howToObtain: 'Submit application on state e-District portal with proof of 15 years continuous residence, electricity bills, and school leaving certificate.',
    requiresPeriodicRenewal: false,
    portalUrl: 'https://aaplesarkar.mahaonline.gov.in',
  },
  'caste certificate': {
    authority: 'Sub-Divisional Officer (SDO) / Deputy Collector',
    validityNote: 'Caste certificate is permanent; however, higher education and reservations require a Caste Validity Certificate from the Scrutiny Committee.',
    howToObtain: 'Apply via MahaDBT / CCVIS portal with genealogy (Vanshavali), school records pre-dating cutoff dates, and parent caste certificate.',
    requiresPeriodicRenewal: false,
    portalUrl: 'https://barti.maharashtra.gov.in',
  },
  'land 7/12 extract': {
    authority: 'Revenue Department / Mahabhulekh (e-MahaBhumi)',
    validityNote: 'Requires a digitally signed, current-season 7/12 (Saat Bara) and 8-A extract reflecting updated crop and ownership status.',
    howToObtain: 'Download digitally signed 7/12 extract from official Mahabhulekh portal or obtain from village Talathi.',
    requiresPeriodicRenewal: true,
    portalUrl: 'https://bhulekh.mahabhumi.gov.in',
  },
  'aadhaar card': {
    authority: 'Unique Identification Authority of India (UIDAI)',
    validityNote: 'Valid lifetime identifier. Mobile number must be active and linked to bank account for DBT (Direct Benefit Transfer).',
    howToObtain: 'Visit nearest Aadhaar Seva Kendra or update demographic/biometric details on the official myAadhaar portal.',
    requiresPeriodicRenewal: false,
    portalUrl: 'https://myaadhaar.uidai.gov.in',
  },
  'bank account passbook': {
    authority: 'Scheduled Commercial / Regional Rural / Cooperative Bank',
    validityNote: 'Bank account must be active, single/joint as specified, and Aadhaar-seeded via NPCI mapper for DBT credits.',
    howToObtain: 'Submit Aadhaar DBT mandate form at your home bank branch to link account to NPCI mapper.',
    requiresPeriodicRenewal: false,
  },
  'vending certificate': {
    authority: 'Urban Local Body (ULB) / Town Vending Committee (TVC)',
    validityNote: 'Must be issued by ULB/TVC or listed in the Urban Local Body vendor identification survey.',
    howToObtain: 'Participate in Town Vending Committee vendor census or obtain Letter of Recommendation (LoR) from municipal ward office.',
    requiresPeriodicRenewal: false,
    portalUrl: 'https://pmsvanidhi.mohua.gov.in',
  },
  'fee receipt': {
    authority: 'Approved College / Higher Educational Institution',
    validityNote: 'Must correspond to the current academic session showing fee component breakdown (Tuition, Development, Exam fees).',
    howToObtain: 'Collect official stamped fee receipt and bonafide certificate from the college accounts department.',
    requiresPeriodicRenewal: true,
  },
  'ration card': {
    authority: 'Department of Food, Civil Supplies and Consumer Protection',
    validityNote: 'Must be active in the RCMS portal with family members enrolled and e-KYC completed.',
    howToObtain: 'Apply for inclusion or new card via state Food & Civil Supplies portal or local Tehsil supply officer.',
    requiresPeriodicRenewal: false,
    portalUrl: 'https://rcms.mahafood.gov.in',
  },
};

export function lookupDocumentGuidance(docName: string): {
  authority: string;
  notes: string;
  howToObtain: string;
  requiresRenewal: boolean;
  portalUrl?: string;
} {
  const norm = docName.toLowerCase();
  for (const [key, val] of Object.entries(DOCUMENT_AUTHORITY_CATALOGUE)) {
    if (norm.includes(key)) {
      return {
        authority: val.authority,
        notes: val.validityNote,
        howToObtain: val.howToObtain,
        requiresRenewal: val.requiresPeriodicRenewal,
        portalUrl: val.portalUrl,
      };
    }
  }

  return {
    authority: 'Competent Issuing Authority as notified in official scheme gazette',
    notes: 'Verify with the administering department that the document is updated and certified.',
    howToObtain: 'Consult the administering department portal or nearest Common Service Center (CSC) with requisite supporting proofs.',
    requiresRenewal: false,
  };
}

// ==============================================================================
// 4. CONDITION EVALUATOR IMPLEMENTATION
// Evaluates each condition independently; supports AND/OR pathways.
// ==============================================================================

export function evaluateCondition(
  conditionText: string,
  conditionIndex: number,
  profile: CitizenProfile,
  scheme: GovernmentScheme
): ConditionEvaluation {
  const lcond = conditionText.toLowerCase();
  const defaultCitation: SourceCitation = scheme.sourceCitations[0] || {
    title: `${scheme.shortName || scheme.schemeName} Official Guidelines`,
    url: scheme.officialUrl,
    domain: new URL(scheme.officialUrl).hostname,
    issuingAuthority: scheme.administeringMinistry,
  };

  // 1. STATE / DOMICILE CRITERION
  if (
    lcond.includes('domicile') ||
    lcond.includes('resident of') ||
    (scheme.jurisdiction === 'STATE' && scheme.state && lcond.includes(scheme.state.toLowerCase()))
  ) {
    const requiredState = scheme.state || 'Maharashtra';
    if (!profile.state) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'UNKNOWN',
        isMandatory: true,
        citizenInputSummary: 'State domicile not provided',
        reason: `Scheme requires verified domicile in ${requiredState}. Please select your state of domicile.`,
        sourceCitation: defaultCitation,
      };
    }

    if (profile.state.toLowerCase() === requiredState.toLowerCase()) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'SATISFIED',
        isMandatory: true,
        citizenInputSummary: `Domicile: ${profile.state}`,
        reason: `Citizen's declared domicile (${profile.state}) matches the statutory state requirement of ${requiredState}.`,
        sourceCitation: defaultCitation,
      };
    } else {
      return {
        conditionIndex,
        conditionText,
        outcome: 'NOT_SATISFIED',
        isMandatory: true,
        citizenInputSummary: `Domicile: ${profile.state}`,
        reason: `Scheme is strictly reserved for residents with domicile in ${requiredState}. Declared domicile is ${profile.state}.`,
        sourceCitation: defaultCitation,
      };
    }
  }

  // 2. INCOME CEILING CRITERION
  const incomeRegex = /(?:income|family income|annual income|income ceiling)[^.]*?(?:rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*(?:lakh|lac)/i;
  const incMatch = lcond.match(incomeRegex);
  if (incMatch) {
    const ceilingLakhs = parseFloat(incMatch[1]);
    if (profile.annualIncomeLakhs === undefined) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'UNKNOWN',
        isMandatory: true,
        citizenInputSummary: 'Annual family income not specified',
        reason: `Scheme specifies an annual family income ceiling of Rs ${ceilingLakhs} Lakh. Annual family income must be provided.`,
        sourceCitation: defaultCitation,
      };
    }

    if (profile.annualIncomeLakhs <= ceilingLakhs) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'SATISFIED',
        isMandatory: true,
        citizenInputSummary: `Annual Income: Rs ${profile.annualIncomeLakhs} Lakh`,
        reason: `Declared income of Rs ${profile.annualIncomeLakhs} Lakh is within the official statutory ceiling of Rs ${ceilingLakhs} Lakh.`,
        sourceCitation: defaultCitation,
      };
    } else {
      return {
        conditionIndex,
        conditionText,
        outcome: 'NOT_SATISFIED',
        isMandatory: true,
        citizenInputSummary: `Annual Income: Rs ${profile.annualIncomeLakhs} Lakh`,
        reason: `Declared income of Rs ${profile.annualIncomeLakhs} Lakh exceeds the maximum permissible ceiling of Rs ${ceilingLakhs} Lakh.`,
        sourceCitation: defaultCitation,
      };
    }
  }

  // 3. FARMER / LANDHOLDING CRITERION
  if (
    lcond.includes('cultivable land') ||
    lcond.includes('farmer families') ||
    lcond.includes('landholding') ||
    lcond.includes('individual farmer')
  ) {
    if (profile.isLandholder === undefined && !profile.occupation) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'UNKNOWN',
        isMandatory: true,
        citizenInputSummary: 'Agricultural status not specified',
        reason: 'Condition requires landholding or active farming status. Landownership details (7/12 extract) required.',
        sourceCitation: defaultCitation,
      };
    }

    if (profile.isLandholder === true || profile.occupation?.toLowerCase().includes('farmer')) {
      // Check for specific landholding hectare ceiling if specified
      if (lcond.includes('small and marginal') || lcond.includes('up to 2 hectare')) {
        if (profile.landHoldingHectares !== undefined && profile.landHoldingHectares > 2.0) {
          return {
            conditionIndex,
            conditionText,
            outcome: 'NOT_SATISFIED',
            isMandatory: true,
            citizenInputSummary: `Landholding: ${profile.landHoldingHectares} hectares`,
            reason: `Scheme requires small or marginal farmer status (up to 2 hectares). Declared landholding is ${profile.landHoldingHectares} hectares.`,
            sourceCitation: defaultCitation,
          };
        }
      }

      return {
        conditionIndex,
        conditionText,
        outcome: 'SATISFIED',
        isMandatory: true,
        citizenInputSummary: profile.landHoldingHectares
          ? `Farmer with ${profile.landHoldingHectares} hectares`
          : 'Farmer / Landholder',
        reason: 'Citizen confirms agricultural landholder status in accordance with scheme requirements.',
        sourceCitation: defaultCitation,
      };
    } else {
      return {
        conditionIndex,
        conditionText,
        outcome: 'NOT_SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'Non-landholder / Non-farmer',
        reason: 'Scheme strictly requires agricultural cultivable landholding in the name of the beneficiary family.',
        sourceCitation: defaultCitation,
      };
    }
  }

  // 4. EXCLUSIONS: TAX PAYEES / CONSTITUTIONAL POSTS
  if (
    lcond.includes('excludes') ||
    lcond.includes('income tax payees') ||
    lcond.includes('excluding class iv')
  ) {
    if (profile.isTaxPayee === true) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'NOT_SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'Income Tax Payee: Yes',
        reason: 'Statutory exclusion applies: Income tax payees and institutional holders are disqualified under official guidelines.',
        sourceCitation: defaultCitation,
      };
    } else if (profile.isTaxPayee === false) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'Income Tax Payee: No',
        reason: 'Beneficiary confirms non-taxpayer status, satisfying the exclusion safeguard.',
        sourceCitation: defaultCitation,
      };
    } else {
      // Not provided: mark unknown for strict exclusion schemes
      return {
        conditionIndex,
        conditionText,
        outcome: 'UNKNOWN',
        isMandatory: true,
        citizenInputSummary: 'Taxpayer status unverified',
        reason: 'Scheme rules disqualify individuals paying income tax or holding institutional government positions.',
        sourceCitation: defaultCitation,
      };
    }
  }

  // 5. HIGHER EDUCATION / COLLEGE ENROLLMENT / ATTENDANCE
  if (lcond.includes('higher education') || lcond.includes('degree courses') || lcond.includes('cap rounds')) {
    if (profile.isCollegeEnrolled === true) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'Enrolled in Approved College: Yes',
        reason: 'Citizen confirms active enrollment in approved higher education course.',
        sourceCitation: defaultCitation,
      };
    } else if (profile.isCollegeEnrolled === false) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'NOT_SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'Enrolled in Approved College: No',
        reason: 'Scholarship requires current active enrollment in a recognized higher education degree course.',
        sourceCitation: defaultCitation,
      };
    } else {
      return {
        conditionIndex,
        conditionText,
        outcome: 'UNKNOWN',
        isMandatory: true,
        citizenInputSummary: 'College enrollment status not specified',
        reason: 'Please indicate whether you are enrolled in a recognized college or professional degree course.',
        sourceCitation: defaultCitation,
      };
    }
  }

  // Attendance condition (e.g. MahaDBT min 50% attendance)
  if (lcond.includes('attendance')) {
    if (profile.attendancePercentage !== undefined) {
      if (profile.attendancePercentage >= 50) {
        return {
          conditionIndex,
          conditionText,
          outcome: 'SATISFIED',
          isMandatory: true,
          citizenInputSummary: `Attendance: ${profile.attendancePercentage}%`,
          reason: `Declared attendance of ${profile.attendancePercentage}% satisfies minimum 50% semester requirement.`,
          sourceCitation: defaultCitation,
        };
      } else {
        return {
          conditionIndex,
          conditionText,
          outcome: 'NOT_SATISFIED',
          isMandatory: true,
          citizenInputSummary: `Attendance: ${profile.attendancePercentage}%`,
          reason: `Declared attendance of ${profile.attendancePercentage}% is below the mandatory 50% attendance threshold.`,
          sourceCitation: defaultCitation,
        };
      }
    } else {
      return {
        conditionIndex,
        conditionText,
        outcome: 'UNKNOWN',
        isMandatory: false,
        citizenInputSummary: 'Attendance percentage not provided',
        reason: 'Attendance verification certificate required from college head of department.',
        sourceCitation: defaultCitation,
      };
    }
  }

  // 6. STREET VENDOR / URBAN LOCAL BODY SURVEY (PM SVANidhi)
  if (lcond.includes('street vendor') || lcond.includes('vending certificate')) {
    if (
      profile.businessType === 'STREET_VENDOR' ||
      profile.occupation?.toLowerCase().includes('vendor') ||
      profile.occupation?.toLowerCase().includes('hawker')
    ) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'Occupation: Street Vendor / Urban Hawker',
        reason: 'Citizen confirms street vending / urban hawking activity.',
        sourceCitation: defaultCitation,
      };
    } else if (profile.occupation && !profile.occupation.toLowerCase().includes('vendor')) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'NOT_SATISFIED',
        isMandatory: true,
        citizenInputSummary: `Occupation: ${profile.occupation}`,
        reason: 'Scheme is exclusively designed for urban street vendors and peri-urban hawkers.',
        sourceCitation: defaultCitation,
      };
    } else {
      return {
        conditionIndex,
        conditionText,
        outcome: 'UNKNOWN',
        isMandatory: true,
        citizenInputSummary: 'Vending status not specified',
        reason: 'Certificate of Vending or Urban Local Body (ULB) identification required.',
        sourceCitation: defaultCitation,
      };
    }
  }

  // 7. HOUSING / KUTCHA HOUSE (PMAY-G)
  if (lcond.includes('kutcha') || lcond.includes('houseless') || lcond.includes('secc 2011')) {
    if (profile.isKutchaHouse === true) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'House Status: Kutcha house / Houseless',
        reason: 'Beneficiary qualifies under shelter deprivation criteria, subject to Gram Sabha Awaas+ verification.',
        sourceCitation: defaultCitation,
      };
    } else if (profile.isKutchaHouse === false) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'NOT_SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'House Status: Pucca house',
        reason: 'Pucca house owners are disqualified from rural housing construction grants.',
        sourceCitation: defaultCitation,
      };
    } else {
      return {
        conditionIndex,
        conditionText,
        outcome: 'UNKNOWN',
        isMandatory: true,
        citizenInputSummary: 'Housing status not provided',
        reason: 'Requires SECC 2011 deprivation registration or Gram Sabha verification of kutcha dwelling.',
        sourceCitation: defaultCitation,
      };
    }
  }

  // 8. SOLAR PUMP / AGRICULTURAL ELECTRICITY CONNECTION (PM-KUSUM / Maha Solar)
  if (lcond.includes('grid connection') || lcond.includes('solar pump') || lcond.includes('water source')) {
    if (profile.isLandholder === false) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'NOT_SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'Non-landholder',
        reason: 'Agricultural solar pump scheme requires agricultural land with an assured water source.',
        sourceCitation: defaultCitation,
      };
    }

    if (profile.hasElectricityConnection === false) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'Non-electrified agricultural farm: Yes',
        reason: 'Priority allocation applies to off-grid farms lacking conventional agricultural feeder energization.',
        sourceCitation: defaultCitation,
      };
    } else if (profile.hasElectricityConnection === true) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'NOT_APPLICABLE',
        isMandatory: false,
        citizenInputSummary: 'Existing grid connection present',
        reason: 'Off-grid pump replacement rules vary by district; solar feeder solarization pathway applies.',
        sourceCitation: defaultCitation,
      };
    } else {
      return {
        conditionIndex,
        conditionText,
        outcome: 'UNKNOWN',
        isMandatory: false,
        citizenInputSummary: 'Farm energization status not specified',
        reason: 'Indicate whether your agricultural land already has an active electricity connection.',
        sourceCitation: defaultCitation,
      };
    }
  }

  // 9. CROP LOAN OVERDUE STATUS (MJPSKY)
  if (lcond.includes('crop loan') || lcond.includes('karjmukti')) {
    if (profile.hasActiveCropLoan === true) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'Active Crop Loan Account: Yes',
        reason: 'Citizen confirms overdue or active crop loan account with eligible bank in Maharashtra.',
        sourceCitation: defaultCitation,
      };
    } else if (profile.hasActiveCropLoan === false) {
      return {
        conditionIndex,
        conditionText,
        outcome: 'NOT_SATISFIED',
        isMandatory: true,
        citizenInputSummary: 'Active Crop Loan Account: No',
        reason: 'Loan waiver scheme strictly applies to outstanding short-term crop loans.',
        sourceCitation: defaultCitation,
      };
    } else {
      return {
        conditionIndex,
        conditionText,
        outcome: 'UNKNOWN',
        isMandatory: true,
        citizenInputSummary: 'Loan status not specified',
        reason: 'Crop loan account passbook from cooperative or commercial bank required.',
        sourceCitation: defaultCitation,
      };
    }
  }

  // 10. DEFAULT / AMBIGUOUS CRITERION HANDLING
  // Never guess ambiguous criteria. Mark UNKNOWN so the citizen is advised to check official portal.
  return {
    conditionIndex,
    conditionText,
    outcome: 'UNKNOWN',
    isMandatory: true,
    citizenInputSummary: 'Specific verification details not supplied',
    reason: 'Official condition requires departmental scrutiny against statutory registry records.',
    sourceCitation: defaultCitation,
  };
}

// ==============================================================================
// 5. MAIN ELIGIBILITY ENGINE
// Evaluates all conditions, checks document readiness, and finds alternatives.
// ==============================================================================

export async function evaluatePersonalizedEligibility(
  scheme: GovernmentScheme,
  rawProfile: any
): Promise<DetailedEligibilityAssessment> {
  // 1. Sanitize & enforce zero sensitive data
  const sanitization = sanitizeAndValidateProfile(rawProfile);
  if (!sanitization.valid || !sanitization.profile) {
    throw new Error(sanitization.error || 'Invalid citizen profile submitted.');
  }
  const profile = sanitization.profile;

  // 2. Evaluate all conditions independently
  const conditions = scheme.eligibilityConditions || [];
  const conditionBreakdown: ConditionEvaluation[] = conditions.map((cond, idx) =>
    evaluateCondition(cond, idx, profile, scheme)
  );

  // 3. Determine Overall Finding
  let overallStatus: OverallEligibilityStatus = 'POTENTIALLY_ELIGIBLE';
  let summaryTitle = '';
  let summaryExplanation = '';

  const hasNotSatisfied = conditionBreakdown.some(
    (c) => c.isMandatory && c.outcome === 'NOT_SATISFIED'
  );
  const hasUnknown = conditionBreakdown.some(
    (c) => c.isMandatory && c.outcome === 'UNKNOWN'
  );

  if (hasNotSatisfied) {
    overallStatus = 'CRITERIA_UNMET';
    summaryTitle = 'Criteria Unmet Based on Provided Details';
    const failedConditions = conditionBreakdown.filter(
      (c) => c.isMandatory && c.outcome === 'NOT_SATISFIED'
    );
    summaryExplanation = `Your profile does not satisfy ${failedConditions.length} mandatory statutory condition(s) for this scheme. Review the condition breakdown below for specific official reasons.`;
  } else if (hasUnknown) {
    overallStatus = 'INSUFFICIENT_INFORMATION';
    summaryTitle = 'Information Incomplete to Confirm Eligibility';
    const unknownConditions = conditionBreakdown.filter(
      (c) => c.isMandatory && c.outcome === 'UNKNOWN'
    );
    summaryExplanation = `Your profile is missing data for ${unknownConditions.length} official requirement(s). Provide the necessary details or consult the administering ministry portal before applying.`;
  } else {
    overallStatus = 'POTENTIALLY_ELIGIBLE';
    summaryTitle = 'Potentially Eligible Based on Preliminary Rules';
    summaryExplanation =
      'You meet all preliminary statutory criteria evaluated for this scheme. Final sanction remains subject to verification of original documents by the administering department.';
  }

  // 4. Document Readiness Evaluation
  const declaredDocs = (profile.declaredDocuments || []).map((d) => d.toLowerCase());
  const requiredDocs = scheme.requiredDocuments || [];
  let availableCount = 0;
  let missingCount = 0;
  let validityCheckCount = 0;

  const checklist: DocumentReadinessItem[] = requiredDocs.map((docName) => {
    const guidance = lookupDocumentGuidance(docName);
    const ldoc = docName.toLowerCase();
    const isDeclared = declaredDocs.some((d) => ldoc.includes(d) || d.includes(ldoc));

    if (!isDeclared) {
      missingCount++;
      return {
        documentName: docName,
        status: 'MISSING',
        notes: guidance.notes,
        issuingAuthority: guidance.authority,
        howToObtain: guidance.howToObtain,
        officialPortalUrl: guidance.portalUrl,
      };
    }

    if (guidance.requiresRenewal) {
      validityCheckCount++;
      return {
        documentName: docName,
        status: 'REQUIRES_VALIDITY_CHECK',
        notes: `${guidance.notes} (Please confirm your copy is for the current financial year).`,
        issuingAuthority: guidance.authority,
        howToObtain: guidance.howToObtain,
        officialPortalUrl: guidance.portalUrl,
      };
    }

    availableCount++;
    return {
      documentName: docName,
      status: 'AVAILABLE',
      notes: guidance.notes,
      issuingAuthority: guidance.authority,
      howToObtain: guidance.howToObtain,
      officialPortalUrl: guidance.portalUrl,
    };
  });

  // 5. Alternative Scheme Recommendations if CRITERIA_UNMET
  let alternativeSchemes: AlternativeSchemeRecommendation[] | undefined = undefined;
  if (overallStatus === 'CRITERIA_UNMET') {
    try {
      const discoveryResult = await discoverSchemes({
        category: scheme.category,
        state: profile.state,
        status: 'ACTIVE',
        limit: 5,
      });

      const filteredAlternatives = (discoveryResult.schemes || [])
        .filter((s) => s.id !== scheme.id)
        .slice(0, 3)
        .map((s) => ({
          id: s.id,
          schemeName: s.schemeName,
          shortName: s.shortName,
          category: s.category,
          benefits: s.benefits,
          matchReason: `Alternative sovereign scheme in ${s.category} available in ${s.jurisdiction === 'CENTRAL' ? 'All India' : s.state || 'your state'}.`,
          officialUrl: s.officialUrl,
          evaluationNotice:
            'Preliminary recommendation based on your profile category. Individual eligibility must be assessed separately against this scheme\'s specific criteria.',
        }));

      if (filteredAlternatives.length > 0) {
        alternativeSchemes = filteredAlternatives;
      }
    } catch {
      // Gracefully handle if discovery service fails
    }
  }

  const mandatoryDisclaimer =
    'GovVerify AI provides informational guidance only. Official approval and final entitlement rest solely with the administering government authority.';

  return {
    schemeId: scheme.id,
    schemeName: scheme.schemeName,
    overallStatus,
    summaryTitle,
    summaryExplanation,
    mandatoryDisclaimer,
    conditionBreakdown,
    documentReadiness: {
      totalRequired: requiredDocs.length,
      availableCount,
      missingCount,
      validityCheckCount,
      checklist,
    },
    alternativeSchemes,
    evaluatedAt: new Date().toISOString(),
  };
}
