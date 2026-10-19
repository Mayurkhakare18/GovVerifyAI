/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Verify & Take Action Guidance Service
 * Connects verified claims to official government services, validated application portals,
 * non-invasive eligibility questionnaires, and interactive checklists.
 * 
 * Enforces strict SSRF protection, sovereign domain verification, and verdict-matched actions.
 */

import { URL } from 'url';
import { getServerSupabase, getSupabaseConfigStatus } from '../supabase';
import { executeTavilySearch, getTavilyConfigStatus } from './tavily';
import { classifyIndianAuthorityDomain } from './sourceDiscovery';
import { VerificationVerdict } from './verdictAnalysis';
import { isPrivateOrReservedIp } from './officialSourceRegistry';

// ==============================================================================
// 1. Data Contracts & Interfaces
// ==============================================================================

export interface ValidatedServiceUrl {
  isValid: boolean;
  isOfficialSovereign: boolean;
  cleanUrl: string;
  domain: string;
  authorityName?: string;
  validationStatus: 'VERIFIED_OFFICIAL' | 'INFORMATIONAL_ONLY' | 'UNVERIFIED_OR_UNSAFE';
  validationNote: string;
}

export type SchemeJurisdiction = 'CENTRAL' | 'STATE' | 'UT';

export interface DetectedSchemeRecord {
  schemeId: string;
  officialSchemeName: string;
  alternativeNamesOrAbbreviations: string[];
  administeringMinistryOrDepartment: string;
  jurisdiction: SchemeJurisdiction;
  schemeInformationUrl: string;
  applicationUrl?: string;
  isApplicationUrlVerified: boolean;
  relevantEvidenceIds: string[];
  lastSourceVerificationTimestamp: string;
  isMeaningfulConnection: boolean;
  matchConfidence: number;
  detectionReasoning?: string;
}

export interface StructuredSchemeGuide {
  schemeOverview: string;
  benefitsProvided: {
    description: string;
    verifiedLimits?: string;
  };
  eligibilityExplanation: Array<{
    criterionId: string;
    criterionTitle: string;
    description: string;
    whyItMatters: string;
  }>;
  requiredDocuments: Array<RequiredDocumentItem & { conditionDescription?: string }>;
  applicationInstructions: {
    onlineSteps?: string[];
    offlineOfficeSteps?: string[];
  };
  verifiedInformationUrl: string;
  verifiedApplicationUrl?: string;
  isApplicationUrlConfirmed: boolean;
  unverifiedApplicationNotice?: string;
  deadlinesFeesRenewal: {
    deadline: string | null;
    fees: string | null;
    renewalRequirements?: string | null;
    contactDetails?: {
      helplinePhone?: string;
      helplineEmail?: string;
      grievancePortalUrl?: string;
    };
  };
  nextStepsForCitizen: string[];
  sources: Array<{
    title: string;
    url: string;
    domain: string;
    retrievedAt?: string;
    isOfficial: boolean;
  }>;
  uncertaintiesAndLimitations: string[];
}

export type EligibilityVerdictCategory = 'LIKELY_ELIGIBLE' | 'MAY_NOT_MEET_CONDITION' | 'CANNOT_DETERMINE';

export interface EligibilityCriterion {
  id: string;
  title: string;
  question: string;
  category: 'location' | 'status' | 'age' | 'income' | 'general';
  options: Array<{
    label: string;
    value: string;
    isEligibleMatch: boolean;
    explanation: string;
  }>;
  officialRequirementDescription: string;
  supportingSourceUrl?: string;
  whyWeAsk?: string;
}

export interface EligibilityEvaluationResult {
  category: EligibilityVerdictCategory;
  categoryLabel: string;
  matchingCriteria: Array<{ id: string; title: string; note: string; sourceUrl?: string }>;
  unmatchingCriteria: Array<{ id: string; title: string; note: string; sourceUrl?: string }>;
  unknownCriteria: Array<{ id: string; title: string; note: string; sourceUrl?: string }>;
  overallGuidance: string;
  disclaimer: string;
  piiWarning?: string;
}

export interface RequiredDocumentItem {
  id: string;
  name: string;
  description: string;
  isMandatory: boolean;
  issuingAuthorityOrType: string;
  sourceReference?: string;
  conditionDescription?: string;
}

export interface ChecklistTaskItem {
  id: string;
  task: string;
  detail: string;
  category: 'prerequisite' | 'document' | 'portal_step' | 'post_submission';
  isOfficialMandate: boolean;
}

export interface FollowUpActionAnswer {
  key: 'check_eligibility' | 'show_documents' | 'explain_process' | 'find_portal' | 'rejection_recourse';
  label: string;
  title: string;
  summary: string;
  detailedPoints: string[];
  officialSourceUrl?: string;
}

export interface ActionServiceDetails {
  isServiceIdentified: boolean;
  schemeOrServiceName: string;
  departmentOrMinistry: string;
  shortDescription: string;
  whoMayQualify: string[];
  
  // Official Portal validation
  officialPortalUrl?: string;
  portalTitle?: string;
  portalDomain?: string;
  isPortalVerified: boolean;
  portalValidationNote: string;
  destinationNotice: string;
  
  // Action details
  applicationSteps: string[];
  requiredDocuments: RequiredDocumentItem[];
  applicationDeadline: string | null;
  applicationFees: string | null;
  grievanceOrContact: {
    helplinePhone?: string;
    helplineEmail?: string;
    grievancePortalName?: string;
    grievancePortalUrl?: string;
  };
  
  sources: Array<{
    title: string;
    url: string;
    domain: string;
    retrievedAt?: string;
    isOfficial: boolean;
  }>;
  lastCheckedDate: string;
}

export interface ActionGuidance {
  verificationRequestId: string;
  verdict: VerificationVerdict;
  hasActionableService: boolean;
  verdictActionHeading: string;
  verdictActionSummary: string;
  advisoryType: 'SUPPORTED_ACTION' | 'CONDITIONAL_ACTION' | 'CONTRADICTED_ALERT' | 'UNVERIFIED_SAFE_SEARCH';
  service?: ActionServiceDetails;
  eligibilityCriteria: EligibilityCriterion[];
  checklist: ChecklistTaskItem[];
  followUpActions: FollowUpActionAnswer[];
  officialDisclaimers: string[];
  generatedAt: string;
  // Phase 6 additions:
  detectedScheme?: DetectedSchemeRecord;
  schemeGuide?: StructuredSchemeGuide;
}

// ==============================================================================
// 2. SSRF Prevention & Safe URL Validation
// ==============================================================================

const PRIVATE_OR_LOCAL_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'test',
  'example',
  'invalid',
]);

/**
 * Checks whether an IP or hostname is private/non-routable to prevent SSRF.
 */
function isPrivateOrLocalDestination(hostname: string): boolean {
  if (isPrivateOrReservedIp(hostname)) return true;
  const lower = hostname.toLowerCase();
  if (PRIVATE_OR_LOCAL_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.localhost')) return true;
  return false;
}

/**
 * Validates candidate URLs for security, protocol compliance, and sovereign governance.
 */
export function validateOfficialServiceUrl(rawUrl: string): ValidatedServiceUrl {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return {
      isValid: false,
      isOfficialSovereign: false,
      cleanUrl: '',
      domain: '',
      validationStatus: 'UNVERIFIED_OR_UNSAFE',
      validationNote: 'Official application link not verified.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return {
      isValid: false,
      isOfficialSovereign: false,
      cleanUrl: '',
      domain: '',
      validationStatus: 'UNVERIFIED_OR_UNSAFE',
      validationNote: 'Provided destination URL is malformed or invalid.',
    };
  }

  // Protocol check: Only HTTPS or HTTP (Strictly reject javascript:, data:, file:)
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      isValid: false,
      isOfficialSovereign: false,
      cleanUrl: '',
      domain: parsed.hostname,
      validationStatus: 'UNVERIFIED_OR_UNSAFE',
      validationNote: 'Unsafe URL scheme detected. Only secure web protocols are accepted.',
    };
  }

  // SSRF Destination Check
  if (isPrivateOrLocalDestination(parsed.hostname)) {
    return {
      isValid: false,
      isOfficialSovereign: false,
      cleanUrl: '',
      domain: parsed.hostname,
      validationStatus: 'UNVERIFIED_OR_UNSAFE',
      validationNote: 'Access to private, loopback, or non-routable destinations is strictly blocked.',
    };
  }

  const cleanUrl = parsed.toString();
  const domain = parsed.hostname.toLowerCase();
  const classification = classifyIndianAuthorityDomain(cleanUrl);

  // Sovereign Tier 1: .gov.in, .nic.in, pib.gov.in, india.gov.in
  // Sovereign Tier 2: Statutory/Apex institutions (rbi.org.in, sebi.gov.in, sci.gov.in)
  if (classification.tier === 1 || classification.tier === 2) {
    return {
      isValid: true,
      isOfficialSovereign: true,
      cleanUrl,
      domain,
      authorityName: classification.suggestedAuthority,
      validationStatus: 'VERIFIED_OFFICIAL',
      validationNote: `Verified sovereign government portal (${domain}) under ${classification.suggestedAuthority || 'Government of India'}.`,
    };
  }

  return {
    isValid: true,
    isOfficialSovereign: false,
    cleanUrl,
    domain,
    authorityName: classification.suggestedAuthority,
    validationStatus: 'INFORMATIONAL_ONLY',
    validationNote: `Informational domain (${domain}). Not an official primary .gov.in or .nic.in government portal.`,
  };
}

/**
 * Safely tests whether an official portal URL is reachable via a bounded HTTP HEAD request.
 */
export async function checkOfficialDestinationReachability(
  url: string,
  timeoutMs = 3000
): Promise<{ isReachable: boolean; statusCode?: number; note: string }> {
  const validated = validateOfficialServiceUrl(url);
  if (!validated.isValid) {
    return { isReachable: false, note: validated.validationNote };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(validated.cleanUrl, {
      method: 'HEAD',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': 'GovVerify-AI-LinkVerifier/1.0 (+https://govverify.internal)',
      },
    });

    clearTimeout(timeout);

    // Handle redirects: validate redirect destination against SSRF and sovereign rules
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        try {
          const redirectUrl = new URL(location, validated.cleanUrl).toString();
          const redirectVal = validateOfficialServiceUrl(redirectUrl);
          if (!redirectVal.isValid || !redirectVal.isOfficialSovereign) {
            return {
              isReachable: false,
              statusCode: response.status,
              note: `Redirect destination (${redirectVal.domain || location}) failed sovereign safety verification.`,
            };
          }
          return {
            isReachable: true,
            statusCode: response.status,
            note: `Destination confirmed active via verified redirect (HTTP ${response.status} -> ${redirectVal.domain}).`,
          };
        } catch {
          return {
            isReachable: false,
            statusCode: response.status,
            note: 'Malformed redirect destination header.',
          };
        }
      }
    }

    const isSuccess = response.status >= 200 && response.status < 400;
    return {
      isReachable: isSuccess,
      statusCode: response.status,
      note: isSuccess
        ? `Destination confirmed active (HTTP ${response.status}).`
        : `Destination returned HTTP ${response.status}.`,
    };
  } catch (err: any) {
    // Graceful handling for timeouts or network restrictions
    return {
      isReachable: false,
      note: `Network validation check paused (${err.name === 'AbortError' ? 'timed out' : 'network unavailable'}).`,
    };
  }
}

// ==============================================================================
// 3. Known Authoritative Scheme & Service Knowledge Registry
// ==============================================================================

export interface KnownServiceRecord {
  id: string;
  keywords: string[];
  schemeOrServiceName: string;
  alternativeNamesOrAbbreviations: string[];
  departmentOrMinistry: string;
  jurisdiction: SchemeJurisdiction;
  shortDescription: string;
  benefitsDescription: string;
  verifiedLimits?: string;
  whoMayQualify: string[];
  officialInformationUrl: string;
  officialPortalUrl: string;
  applicationUrl?: string;
  portalTitle: string;
  applicationSteps: string[];
  offlineSteps?: string[];
  requiredDocuments: RequiredDocumentItem[];
  applicationDeadline: string | null;
  applicationFees: string | null;
  renewalRequirements?: string | null;
  grievanceOrContact: {
    helplinePhone?: string;
    helplineEmail?: string;
    grievancePortalName?: string;
    grievancePortalUrl?: string;
  };
  eligibilityCriteria: EligibilityCriterion[];
  uncertaintiesAndLimitations?: string[];
  followUpAnswers: Record<string, { title: string; summary: string; points: string[] }>;
}

const KNOWN_SOVEREIGN_SCHEMES: KnownServiceRecord[] = [
  {
    id: 'pm-kisan',
    keywords: ['pm kisan', 'pm-kisan', 'kisan samman', 'farmer installment', 'pmkisan'],
    schemeOrServiceName: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
    alternativeNamesOrAbbreviations: ['PM-KISAN', 'PM Kisan', 'Kisan Samman Nidhi'],
    departmentOrMinistry: 'Ministry of Agriculture and Farmers Welfare, Government of India',
    jurisdiction: 'CENTRAL',
    shortDescription:
      'Direct income support scheme providing ₹6,000 per year in three equal four-monthly installments of ₹2,000 directly into the Aadhaar-seeded bank accounts of eligible landholding farmer families.',
    benefitsDescription:
      '₹6,000 annual direct income support disbursed in three equal 4-monthly installments of ₹2,000 directly via DBT into bank accounts seeded with Aadhaar and NPCI.',
    verifiedLimits: 'Maximum ₹6,000 per financial year per eligible landholding farmer family.',
    whoMayQualify: [
      'All landholding farmer families with cultivable land in their name.',
      'Small and marginal farmer households in rural or peri-urban areas.',
      'Exclusions apply for institutional landholders, income-tax payers, and constitutional post holders.',
    ],
    officialInformationUrl: 'https://pmkisan.gov.in',
    officialPortalUrl: 'https://pmkisan.gov.in',
    applicationUrl: 'https://pmkisan.gov.in/RegistrationFormNew.aspx',
    portalTitle: 'PM-KISAN National Portal',
    offlineSteps: [
      'Visit your nearest Common Service Center (CSC) or local District Agriculture / Taluka Revenue Office.',
      'Provide physical copies of land ownership records (RoR / Jamabandi / Khatoni) and Aadhaar card.',
      'Complete biometric e-KYC on the CSC biometric scanner terminal.',
      'Collect an acknowledgment slip containing your reference application number for status tracking.',
    ],
    renewalRequirements: 'Mandatory annual e-KYC and land record re-verification via state portal.',
    applicationSteps: [
      'Navigate to the official PM-KISAN portal (pmkisan.gov.in) and locate the "Farmers Corner".',
      'Select "New Farmer Registration" and choose either Rural Farmer or Urban Farmer Registration.',
      'Enter your 12-digit Aadhaar Number, active mobile number, and select your State.',
      'Complete Aadhaar OTP verification to unlock the registration intake form.',
      'Enter landholding details exactly as shown on your state land record (Khata / Khasra number).',
      'Complete mandatory e-KYC (via OTP on portal or biometric at nearest Common Service Center).',
    ],
    requiredDocuments: [
      {
        id: 'doc-aadhaar',
        name: 'Aadhaar Card',
        description: 'Mandatory identification for biometrics and Direct Benefit Transfer (DBT).',
        isMandatory: true,
        issuingAuthorityOrType: 'Unique Identification Authority of India (UIDAI)',
      },
      {
        id: 'doc-land',
        name: 'Land Ownership Records (Jamabandi / RoR / Khasra)',
        description: 'Official revenue document showing cultivable land registered in your name.',
        isMandatory: true,
        issuingAuthorityOrType: 'State Department of Revenue / Land Records',
      },
      {
        id: 'doc-bank',
        name: 'Active Bank Account with Aadhaar-NPCI Seeding',
        description: 'Bank passbook / account seeded with Aadhaar for DBT transfer.',
        isMandatory: true,
        issuingAuthorityOrType: 'Scheduled Commercial Bank / Post Office Bank',
      },
      {
        id: 'doc-mobile',
        name: 'Aadhaar-Linked Mobile Number',
        description: 'Required for OTP-based e-KYC verification and installment status SMS alerts.',
        isMandatory: true,
        issuingAuthorityOrType: 'Telecom Service Provider',
      },
      {
        id: 'doc-nomination',
        name: 'Succession Certificate / Legal Heir Affidavit',
        description: 'Required if land title is being transferred from a deceased farmer family member.',
        isMandatory: false,
        issuingAuthorityOrType: 'Tehsildar / Taluk Revenue Office',
        conditionDescription: 'Mandatory only when applying under inherited land before title mutation is complete.',
      },
    ],
    applicationDeadline: 'Continuous rolling enrollment throughout the financial year. No fixed closing date.',
    applicationFees: 'Completely free on the official portal. Nominal ₹15 fee if completing biometric e-KYC at an offline CSC.',
    grievanceOrContact: {
      helplinePhone: '155261 / 011-24300606',
      helplineEmail: 'pmkisan-ict@gov.in',
      grievancePortalName: 'CPGRAMS Central Public Grievance Portal',
      grievancePortalUrl: 'https://pgportal.gov.in',
    },
    eligibilityCriteria: [
      {
        id: 'pmk-crit-land',
        title: 'Agricultural Landholding',
        question: 'Do you or your family hold cultivable agricultural land registered in your name?',
        category: 'status',
        options: [
          {
            label: 'Yes, cultivable land is registered in my name',
            value: 'yes_land',
            isEligibleMatch: true,
            explanation: 'Meets primary requirement of being a landholding farmer family.',
          },
          {
            label: 'No, I am a tenant / agricultural laborer without land title',
            value: 'no_land',
            isEligibleMatch: false,
            explanation: 'PM-KISAN guidelines currently require title ownership in official state land records.',
          },
        ],
        officialRequirementDescription: 'Applicant family must possess cultivable landholding as per state land records.',
        supportingSourceUrl: 'https://pmkisan.gov.in',
      },
      {
        id: 'pmk-crit-tax',
        title: 'Income Tax Assessment',
        question: 'Did any member of your household pay Income Tax in the previous assessment year?',
        category: 'income',
        options: [
          {
            label: 'No, nobody in my household paid income tax',
            value: 'no_tax',
            isEligibleMatch: true,
            explanation: 'Satisfies the exclusion criteria guidelines.',
          },
          {
            label: 'Yes, an income tax return was filed and tax was paid',
            value: 'yes_tax',
            isEligibleMatch: false,
            explanation: 'Individuals who paid income tax in the last assessment year are excluded from PM-KISAN benefits.',
          },
        ],
        officialRequirementDescription: 'Beneficiaries must not have paid income tax in the previous assessment year.',
        supportingSourceUrl: 'https://pmkisan.gov.in',
      },
      {
        id: 'pmk-crit-ekyc',
        title: 'Aadhaar e-KYC Readiness',
        question: 'Is your mobile number linked to your Aadhaar card for OTP-based e-KYC?',
        category: 'general',
        options: [
          {
            label: 'Yes, mobile number is linked to Aadhaar',
            value: 'yes_ekyc',
            isEligibleMatch: true,
            explanation: 'Can complete e-KYC instantly online on the portal.',
          },
          {
            label: 'No, mobile is not linked (need biometric CSC visit)',
            value: 'no_ekyc',
            isEligibleMatch: false,
            explanation: 'Will require in-person biometric authentication at a local Common Service Center.',
          },
        ],
        officialRequirementDescription: 'Mandatory e-KYC verification is required before installment disbursement.',
        supportingSourceUrl: 'https://pmkisan.gov.in',
      },
    ],
    followUpAnswers: {
      check_eligibility: {
        title: 'Eligibility Requirements for PM-KISAN',
        summary: 'All landholding farmer families with cultivable land are eligible, subject to exclusion rules.',
        points: [
          'Must possess cultivable land ownership as recorded in state revenue records.',
          'Excluded: Institutional landholders, constitutional post holders, current/former ministers, civil servants, and pension recipients receiving ₹10,000/month or more.',
          'Excluded: Anyone who paid income tax in the last assessment year.',
        ],
      },
      show_documents: {
        title: 'Documents Required for PM-KISAN',
        summary: 'Have your land records, Aadhaar, and bank details ready before applying.',
        points: [
          'Aadhaar card with linked mobile phone.',
          'Copy of Jamabandi / Khasra / Land Ownership Certificate.',
          'Bank passbook showing account number and IFSC code seeded with NPCI for DBT.',
        ],
      },
      explain_process: {
        title: 'Step-by-Step PM-KISAN Application Process',
        summary: 'Applications can be completed online on pmkisan.gov.in or offline at your local CSC.',
        points: [
          'Step 1: Open pmkisan.gov.in and click New Farmer Registration under Farmers Corner.',
          'Step 2: Enter Aadhaar number and state, verify OTP.',
          'Step 3: Fill personal details, land parcel numbers, and bank account information.',
          'Step 4: Submit form and save registration application reference number.',
          'Step 5: District agriculture office validates land records with state revenue department.',
        ],
      },
      find_portal: {
        title: 'Official PM-KISAN Portal',
        summary: 'Always access through the official sovereign government portal: https://pmkisan.gov.in',
        points: [
          'Official domain: pmkisan.gov.in (National Informatics Centre, NIC).',
          'Avoid imitation third-party apps or fake registration links that charge unauthorized fees.',
          'Official portal displays government crest and sovereign NIC domain footer.',
        ],
      },
      rejection_recourse: {
        title: 'What to Do If Your PM-KISAN Application Is Delayed or Rejected',
        summary: 'Most delays are due to land record mismatch or pending e-KYC.',
        points: [
          'Check application status online: Use "Know Your Status" tab on pmkisan.gov.in with registration number.',
          'Correct land record details: Contact your local Patwari / Revenue Officer (Lekhpal) or Block Agriculture Officer.',
          'Resolve Aadhaar / Bank mismatch: Ensure bank account is active and seeded with NPCI via your home branch.',
          'File an official grievance: Call helpline 155261 or submit an appeal on pgportal.gov.in.',
        ],
      },
    },
  },
  {
    id: 'pm-surya-ghar',
    keywords: ['surya ghar', 'muft bijli', 'rooftop solar', 'solar subsidy', 'pmsuryaghar', 'mnre solar', 'pm surya ghar'],
    schemeOrServiceName: 'PM Surya Ghar: Muft Bijli Yojana',
    alternativeNamesOrAbbreviations: ['PM Surya Ghar', 'Muft Bijli Yojana', 'National Rooftop Solar'],
    departmentOrMinistry: 'Ministry of New and Renewable Energy (MNRE), Government of India',
    jurisdiction: 'CENTRAL',
    shortDescription:
      'Residential rooftop solar subsidy initiative providing up to ₹78,000 in central financial assistance to help households generate up to 300 units of free clean solar electricity per month.',
    benefitsDescription:
      'Central financial subsidy providing up to 300 units free electricity monthly through subsidies of ₹30,000 for 1 kW, ₹60,000 for 2 kW, and up to ₹78,000 for 3 kW or higher systems.',
    verifiedLimits: 'Maximum ₹78,000 central subsidy for residential systems 3 kW and above.',
    whoMayQualify: [
      'Residential households with an active domestic electricity connection.',
      'Applicants with undisputed roof rights or space suitable for solar panel installation.',
      'Must not have previously availed central financial assistance for the same domestic connection.',
    ],
    officialInformationUrl: 'https://pmsuryaghar.gov.in',
    officialPortalUrl: 'https://pmsuryaghar.gov.in',
    applicationUrl: 'https://pmsuryaghar.gov.in/consumerRegistration',
    portalTitle: 'PM Surya Ghar National Portal',
    offlineSteps: [
      'Visit your local electricity DISCOM sub-division office or an empaneled rooftop solar vendor in your district.',
      'Obtain vendor contact details directly from the certified list displayed on pmsuryaghar.gov.in.',
      'Vendor representatives assist in taking rooftop measurements and submitting DISCOM feasibility requests.',
    ],
    renewalRequirements: 'Standard 25-year panel performance warranty; net metering agreement valid as per DISCOM regulations.',
    applicationSteps: [
      'Visit the official National Portal (pmsuryaghar.gov.in) and register with State and local DISCOM.',
      'Enter your active electricity consumer account number and mobile number.',
      'Submit online application for rooftop solar feasibility approval from your local DISCOM.',
      'Once DISCOM approves feasibility, choose an empaneled vendor listed on the national portal.',
      'Vendor installs the grid-connected solar panels and inverters as per technical standards.',
      'DISCOM inspects the system, installs a bi-directional net meter, and issues a commissioning certificate.',
      'Submit your bank account details and cancelled cheque on the portal for direct subsidy credit.',
    ],
    requiredDocuments: [
      {
        id: 'doc-ebill',
        name: 'Recent Electricity Bill (within last 6 months)',
        description: 'Shows active domestic connection, consumer number (CA number), and sanctioned load.',
        isMandatory: true,
        issuingAuthorityOrType: 'State Electricity Distribution Company (DISCOM)',
      },
      {
        id: 'doc-aadhaar-solar',
        name: 'Aadhaar Card of Electricity Consumer',
        description: 'Identification proof matching the name on the electricity account or title.',
        isMandatory: true,
        issuingAuthorityOrType: 'UIDAI',
      },
      {
        id: 'doc-bank-solar',
        name: 'Cancelled Cheque / Bank Passbook Copy',
        description: 'Required for Direct Benefit Transfer of the central subsidy amount.',
        isMandatory: true,
        issuingAuthorityOrType: 'Bank',
      },
      {
        id: 'doc-roof',
        name: 'Proof of Roof Rights / Property Tax Receipt',
        description: 'Documents demonstrating authorization to install panels on the terrace or rooftop.',
        isMandatory: true,
        issuingAuthorityOrType: 'Municipal Corporation / Property Authority',
      },
      {
        id: 'doc-noc-solar',
        name: 'Rooftop No Objection Certificate (NOC)',
        description: 'NOC from housing society, co-owners, or landlord permitting rooftop panel installation.',
        isMandatory: false,
        issuingAuthorityOrType: 'Resident Welfare Association (RWA) / Landlord',
        conditionDescription: 'Mandatory only for tenants, joint property co-owners, or multi-apartment society residents.',
      },
    ],
    applicationDeadline: 'Scheme active with national target of 1 crore households. Applications accepted on rolling basis.',
    applicationFees: 'No application fee on the government portal. Consumer pays remaining installation cost after subsidy to the vendor.',
    grievanceOrContact: {
      helplinePhone: '15555 / 1800-180-3333',
      helplineEmail: 'support-pmsuryaghar@gov.in',
      grievancePortalName: 'National Rooftop Solar Grievance Cell',
      grievancePortalUrl: 'https://pmsuryaghar.gov.in',
    },
    eligibilityCriteria: [
      {
        id: 'solar-crit-conn',
        title: 'Domestic Electricity Connection',
        question: 'Do you have an active domestic (residential) electricity connection in your home?',
        category: 'status',
        options: [
          {
            label: 'Yes, active domestic residential connection',
            value: 'yes_conn',
            isEligibleMatch: true,
            explanation: 'Eligible for residential rooftop solar central financial assistance.',
          },
          {
            label: 'No, or connection is commercial / agricultural',
            value: 'no_conn',
            isEligibleMatch: false,
            explanation: 'Commercial and industrial connections are not eligible under PM Surya Ghar residential scheme.',
          },
        ],
        officialRequirementDescription: 'Connection must be categorized as domestic/residential under local DISCOM tariff.',
        supportingSourceUrl: 'https://pmsuryaghar.gov.in',
      },
      {
        id: 'solar-crit-roof',
        title: 'Rooftop Space Availability',
        question: 'Do you have adequate shade-free roof space (approx. 100 sq. ft. per 1 kW system)?',
        category: 'general',
        options: [
          {
            label: 'Yes, adequate shade-free roof space is available',
            value: 'yes_roof',
            isEligibleMatch: true,
            explanation: 'Sufficient space for mounting solar panels.',
          },
          {
            label: 'No adequate roof space',
            value: 'no_roof',
            isEligibleMatch: false,
            explanation: 'Grid-connected rooftop solar requires structural roof space for photovoltaic modules.',
          },
        ],
        officialRequirementDescription: 'Premises must possess suitable shade-free roof area for grid installation.',
        supportingSourceUrl: 'https://pmsuryaghar.gov.in',
      },
    ],
    followUpAnswers: {
      check_eligibility: {
        title: 'PM Surya Ghar Eligibility Criteria',
        summary: 'Open to all Indian households with domestic power connection and roof rights.',
        points: [
          'Must be a residential consumer with an active electricity connection.',
          'Must possess an unshaded terrace or rooftop capable of bearing panel structure.',
          'Subsidy amounts: ₹30,000 for 1 kW, ₹60,000 for 2 kW, and up to ₹78,000 for 3 kW or higher.',
        ],
      },
      show_documents: {
        title: 'Required Documents for Rooftop Solar',
        summary: 'Electricity bill and cancelled cheque are the primary documents.',
        points: [
          'Latest electricity bill with Consumer Account number.',
          'Aadhaar card matching electricity consumer details.',
          'Cancelled cheque or bank passbook for subsidy direct credit.',
        ],
      },
      explain_process: {
        title: 'Rooftop Solar Installation Workflow',
        summary: 'Apply online -> Feasibility approval -> Vendor installation -> Net metering -> Subsidy credit.',
        points: [
          'Step 1: Register on pmsuryaghar.gov.in with state, DISCOM, and consumer number.',
          'Step 2: Submit rooftop solar application and await DISCOM technical feasibility clearance.',
          'Step 3: Select an empaneled vendor and sign the agreement.',
          'Step 4: Vendor completes physical installation; DISCOM installs bidirectional net meter.',
          'Step 5: Commissioning certificate generated; apply for direct DBT subsidy disbursement on portal.',
        ],
      },
      find_portal: {
        title: 'Official PM Surya Ghar Portal',
        summary: 'National Portal: https://pmsuryaghar.gov.in',
        points: [
          'Only apply through the official sovereign portal: pmsuryaghar.gov.in.',
          'Do not pay cash subsidies to unauthorized third parties.',
          'Check list of empaneled vendors directly on the official portal.',
        ],
      },
      rejection_recourse: {
        title: 'DISCOM Feasibility or Subsidy Delay Assistance',
        summary: 'Technical feasibility issues or transformer capacity bottlenecks can cause delays.',
        points: [
          'If feasibility rejected due to transformer capacity: Request DISCOM capacity augmentation through local division office.',
          'If subsidy delayed post-metering: Verify bank account IFSC and name match on the national portal.',
          'Lodge formal grievance: Call toll-free 15555 or contact local DISCOM nodal solar officer.',
        ],
      },
    },
  },
  {
    id: 'ab-pmjay',
    keywords: ['ayushman', 'pmjay', 'pm-jay', 'golden card', 'health insurance 5 lakh'],
    schemeOrServiceName: 'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (AB-PMJAY)',
    alternativeNamesOrAbbreviations: ['AB-PMJAY', 'PM-JAY', 'Ayushman Bharat', 'PM Jan Arogya Yojana'],
    departmentOrMinistry: 'National Health Authority (NHA), Ministry of Health and Family Welfare',
    jurisdiction: 'CENTRAL',
    shortDescription:
      'World’s largest government-funded health assurance scheme, providing health cover of ₹5 lakh per family per year for secondary and tertiary care hospitalization.',
    benefitsDescription:
      'Cashless and paperless inpatient secondary and tertiary hospital care coverage up to ₹5 lakh per family per year, with universal coverage extended to all senior citizens aged 70+.',
    verifiedLimits: '₹5,00,000 per family per year for inpatient secondary and tertiary hospitalization.',
    whoMayQualify: [
      'Deprived rural and urban households identified under Socio-Economic Caste Census (SECC 2011).',
      'All senior citizens aged 70 years and above, irrespective of income (under expanded AB-PMJAY Senior Citizen cover).',
      'Existing RSBY cardholders and state-specific expanded beneficiary lists.',
    ],
    officialInformationUrl: 'https://pmjay.gov.in',
    officialPortalUrl: 'https://beneficiary.nha.gov.in',
    applicationUrl: 'https://beneficiary.nha.gov.in',
    portalTitle: 'Ayushman Beneficiary Portal (NHA)',
    offlineSteps: [
      'Visit the Ayushman Mitra helpdesk at any empaneled public or private hospital nationwide.',
      'Present your Aadhaar card and Ration Card / Family ID to the Ayushman Mitra.',
      'Complete on-the-spot biometric authentication and receive a laminated Ayushman Card.',
    ],
    renewalRequirements: 'Cards have lifelong validity; annual renewal not required.',
    applicationSteps: [
      'Visit the official NHA Beneficiary Portal (beneficiary.nha.gov.in).',
      'Log in with your mobile number and complete OTP verification.',
      'Search for your family by Scheme, State, Sub-scheme, and search mode (Aadhaar Number / Ration Card / Family ID).',
      'If your family is listed, initiate e-KYC using Aadhaar OTP or facial authentication.',
      'Capture a live photograph and submit contact information.',
      'Upon approval, download your verified Ayushman Card directly to your phone or print at a CSC/empanelled hospital.',
    ],
    requiredDocuments: [
      {
        id: 'doc-aadhaar-pmjay',
        name: 'Aadhaar Card',
        description: 'Mandatory for individual biometric/OTP verification and identity seeding.',
        isMandatory: true,
        issuingAuthorityOrType: 'UIDAI',
      },
      {
        id: 'doc-ration-card',
        name: 'Ration Card / Family ID',
        description: 'Proof of family composition to identify all co-beneficiary family members.',
        isMandatory: true,
        issuingAuthorityOrType: 'State Department of Food & Civil Supplies',
      },
      {
        id: 'doc-mobile-pmjay',
        name: 'Active Mobile Number',
        description: 'Required to receive OTP and download digital Ayushman Card.',
        isMandatory: true,
        issuingAuthorityOrType: 'Telecom Provider',
      },
    ],
    applicationDeadline: 'Continuous open enrollment. Beneficiaries can generate cards anytime.',
    applicationFees: 'Completely free of cost. Ayushman Card generation and cashless treatment are 100% free at all empaneled hospitals.',
    grievanceOrContact: {
      helplinePhone: '14555 / 1800-111-565',
      helplineEmail: 'ayushmanbharat@nha.gov.in',
      grievancePortalName: 'NHA Grievance Redressal Portal (CGRMS)',
      grievancePortalUrl: 'https://cgrms.nha.gov.in',
    },
    eligibilityCriteria: [
      {
        id: 'pmjay-crit-senior',
        title: 'Senior Citizen 70+ Coverage',
        question: 'Are you or any family member aged 70 years or older?',
        category: 'age',
        options: [
          {
            label: 'Yes, age 70 or older',
            value: 'yes_70',
            isEligibleMatch: true,
            explanation: 'Eligible under the universal Ayushman Bharat Senior Citizen scheme regardless of income.',
          },
          {
            label: 'No, all members below 70',
            value: 'no_70',
            isEligibleMatch: false,
            explanation: 'Under 70 individuals must qualify through SECC deprivation criteria or state ration card categories.',
          },
        ],
        officialRequirementDescription: 'Citizens aged 70+ receive universal ₹5 lakh top-up cover.',
        supportingSourceUrl: 'https://beneficiary.nha.gov.in',
      },
    ],
    followUpAnswers: {
      check_eligibility: {
        title: 'Ayushman Bharat Eligibility Verification',
        summary: 'Check online using Aadhaar or Ration Card on beneficiary.nha.gov.in.',
        points: [
          'Visit beneficiary.nha.gov.in and select "Beneficiary" login.',
          'Search by your state, ration card number, or Aadhaar number.',
          'If name appears, card can be issued immediately upon instant e-KYC.',
        ],
      },
      show_documents: {
        title: 'Documents Required for Ayushman Card',
        summary: 'Aadhaar Card and Ration Card are the two required documents.',
        points: [
          'Aadhaar card of the beneficiary.',
          'Ration card or Family identity certificate.',
          'Active phone number for OTP verification.',
        ],
      },
      explain_process: {
        title: 'How to Get Your Ayushman Card',
        summary: 'Online at beneficiary.nha.gov.in or in-person at any Empaneled Hospital or Common Service Center.',
        points: [
          'Visit beneficiary.nha.gov.in or nearest Ayushman Mitra at any public hospital.',
          'Verify identity through Aadhaar OTP or fingerprint scan.',
          'Instant digital card approval; download and present at any empaneled hospital nationwide.',
        ],
      },
      find_portal: {
        title: 'Official NHA Ayushman Portals',
        summary: 'National Health Authority: beneficiary.nha.gov.in | Hospital search: hospitals.pmjay.gov.in',
        points: [
          'Beneficiary self-service portal: https://beneficiary.nha.gov.in',
          'Search nearby empaneled hospitals: https://hospitals.pmjay.gov.in',
          'Helpline: 14555 (Toll-Free, 24x7).',
        ],
      },
      rejection_recourse: {
        title: 'Ayushman Grievance & Hospital Denial Support',
        summary: 'Empaneled hospitals cannot deny treatment to verified Ayushman cardholders.',
        points: [
          'If hospital denies cashless admission: Report to the on-site Ayushman Mitra or call 14555 immediately.',
          'Submit an online complaint on the Central Grievance Redressal Portal: https://cgrms.nha.gov.in',
          'State Health Agency (SHA) investigates complaints with mandatory 24-hour turnaround.',
        ],
      },
    },
  },
  {
    id: 'atal-pension-yojana',
    keywords: ['atal pension', 'apy', 'pfrda pension', 'guaranteed monthly pension'],
    schemeOrServiceName: 'Atal Pension Yojana (APY)',
    alternativeNamesOrAbbreviations: ['APY', 'Atal Pension'],
    departmentOrMinistry: 'Pension Fund Regulatory and Development Authority (PFRDA), Ministry of Finance',
    jurisdiction: 'CENTRAL',
    shortDescription:
      'Guaranteed periodic pension scheme for unorganized sector citizens, providing ₹1,000 to ₹5,000 monthly pension from age 60 based on contributions made between ages 18 and 40.',
    benefitsDescription:
      'Guaranteed lifetime monthly pension of ₹1,000, ₹2,000, ₹3,000, ₹4,000, or ₹5,000 from age 60. Continued to spouse post-demise, with full return of accumulated corpus to legal nominee.',
    verifiedLimits: 'Maximum guaranteed pension of ₹5,000 per month starting at age 60.',
    whoMayQualify: [
      'All Indian citizens between 18 and 40 years of age with an active savings bank account.',
      'Must not be an income-tax payer (effective 1 October 2022).',
      'Targeted primarily towards workers in the unorganized sector.',
    ],
    officialInformationUrl: 'https://www.npscra.nsdl.co.in',
    officialPortalUrl: 'https://enps.nsdl.co.in',
    applicationUrl: 'https://enps.nsdl.co.in/#/apy/register',
    portalTitle: 'eNPS APY Enrollment Portal (NSDL / Protean)',
    applicationSteps: [
      'Approach your bank branch where you maintain a savings bank account or visit enps.nsdl.co.in.',
      'Provide your Aadhaar number and active mobile number.',
      'Select your chosen monthly pension slab (₹1,000 to ₹5,000).',
      'Authorize the auto-debit mandate for monthly/quarterly contribution deduction from your bank account.',
      'Obtain your Permanent Retirement Account Number (PRAN) acknowledgment slip.',
    ],
    offlineSteps: [
      'Visit any public or private sector commercial bank or post office branch where you hold a savings account.',
      'Request and fill out the APY Subscriber Registration Form.',
      'Submit the auto-debit consent mandate and nominate your spouse or legal heir.',
    ],
    requiredDocuments: [
      {
        id: 'doc-bank-apy',
        name: 'Active Savings Bank Account with Auto-Debit',
        description: 'Bank or Post Office account from which regular contributions are automatically deducted.',
        isMandatory: true,
        issuingAuthorityOrType: 'Commercial Bank / India Post Payments Bank',
      },
      {
        id: 'doc-aadhaar-apy',
        name: 'Aadhaar Card',
        description: 'Primary identity document for subscriber identity authentication.',
        isMandatory: true,
        issuingAuthorityOrType: 'UIDAI',
      },
      {
        id: 'doc-mobile-apy',
        name: 'Active Mobile Number',
        description: 'Required for transaction SMS receipts and PRAN statements.',
        isMandatory: true,
        issuingAuthorityOrType: 'Telecom Provider',
      },
      {
        id: 'doc-nominee',
        name: 'Nominee Identity & Relationship Proof',
        description: 'Identification of spouse or nominee entitled to pension corpus.',
        isMandatory: false,
        issuingAuthorityOrType: 'Government ID',
        conditionDescription: 'Required for non-spouse nominees or minor dependents.',
      },
    ],
    applicationDeadline: 'Continuous enrollment for eligible citizens between 18 and 40 years of age.',
    applicationFees: 'No enrollment fee. Subscriber pays only the statutory monthly contribution slab.',
    renewalRequirements: 'Maintain sufficient balance in bank account for automatic monthly auto-debit deduction.',
    grievanceOrContact: {
      helplinePhone: '1800-110-069',
      helplineEmail: 'cra@nsdl.co.in',
      grievancePortalName: 'PFRDA Central Grievance Management System',
      grievancePortalUrl: 'https://cgms.pfrda.org.in',
    },
    eligibilityCriteria: [
      {
        id: 'apy-crit-age',
        title: 'Entry Age Between 18 and 40',
        question: 'Is your current age between 18 and 40 years?',
        category: 'age',
        options: [
          {
            label: 'Yes, between 18 and 40 years',
            value: 'yes_age',
            isEligibleMatch: true,
            explanation: 'Eligible: Meets statutory entry age requirement allowing at least 20 years of contribution before age 60.',
          },
          {
            label: 'No, age is under 18 or above 40',
            value: 'no_age',
            isEligibleMatch: false,
            explanation: 'Ineligible: Citizens over 40 cannot join APY under statutory PFRDA scheme rules.',
          },
        ],
        officialRequirementDescription: 'Entry age strictly restricted to 18-40 years.',
        supportingSourceUrl: 'https://www.npscra.nsdl.co.in',
        whyWeAsk: 'PFRDA rules mandate minimum 20 contribution years prior to age 60 maturity.',
      },
      {
        id: 'apy-crit-tax',
        title: 'Non-Income Tax Paying Status',
        question: 'Are you currently or have you previously been an Income Tax payer?',
        category: 'income',
        options: [
          {
            label: 'No, I have never paid income tax',
            value: 'no_tax',
            isEligibleMatch: true,
            explanation: 'Eligible: Meets criteria for government-subsidized pension scheme.',
          },
          {
            label: 'Yes, I pay or have paid income tax',
            value: 'yes_tax',
            isEligibleMatch: false,
            explanation: 'Statutory Exclusion: Since 1 October 2022, income tax payers cannot join Atal Pension Yojana.',
          },
        ],
        officialRequirementDescription: 'Income tax payers excluded since 1 October 2022.',
        supportingSourceUrl: 'https://www.npscra.nsdl.co.in',
        whyWeAsk: 'Ministry of Finance amended APY rules to focus government subsidies exclusively on non-taxpaying unorganized workers.',
      },
    ],
    uncertaintiesAndLimitations: [
      'Failure to maintain adequate account balance leads to nominal overdue interest penalty per month.',
      'Premature withdrawal prior to age 60 permitted only under exceptional circumstances (terminal illness/death).',
    ],
    followUpAnswers: {
      check_eligibility: {
        title: 'Atal Pension Yojana Criteria',
        summary: 'Indian citizens aged 18-40 who are non-taxpayers qualify.',
        points: [
          'Age strictly between 18 and 40 years.',
          'Must have savings bank account with auto-debit facility.',
          'Must not be an income-tax payer.',
        ],
      },
      show_documents: {
        title: 'Documents for APY',
        summary: 'Savings bank account passbook, Aadhaar, and mobile number.',
        points: ['Bank passbook with IFSC code.', 'Aadhaar card.', 'Active mobile number.'],
      },
      explain_process: {
        title: 'Enrollment Steps',
        summary: 'Register online via eNPS or offline at your bank branch.',
        points: ['Choose pension slab (₹1K to ₹5K).', 'Submit auto-debit mandate.', 'Receive PRAN number.'],
      },
      find_portal: {
        title: 'Official APY Portals',
        summary: 'PFRDA: pfrda.org.in | NSDL CRA: npscra.nsdl.co.in',
        points: ['Access official PRAN portal on sovereign banking domains.'],
      },
      rejection_recourse: {
        title: 'Resolving APY Deductions or PRAN Issues',
        summary: 'Lodge formal complaints with your bank or PFRDA CGMS portal.',
        points: ['Contact home branch manager.', 'Lodge grievance on cgms.pfrda.org.in.'],
      },
    },
  },
  {
    id: 'pm-ujjwala',
    keywords: ['pm ujjwala', 'pmuy', 'ujjwala yojana', 'free lpg gas', 'lpg subsidy'],
    schemeOrServiceName: 'Pradhan Mantri Ujjwala Yojana (PMUY / Ujjwala 2.0)',
    alternativeNamesOrAbbreviations: ['PMUY', 'Ujjwala 2.0', 'Pradhan Mantri Ujjwala Yojana'],
    departmentOrMinistry: 'Ministry of Petroleum and Natural Gas, Government of India',
    jurisdiction: 'CENTRAL',
    shortDescription:
      'Welfare initiative providing deposit-free LPG connections with free first cylinder refill and stove to adult women from BPL and low-income rural households.',
    benefitsDescription:
      'Deposit-free 14.2 kg or 5 kg LPG connection, free first cylinder refill, free hotplate/stove, plus financial assistance of ₹1,600 per connection.',
    verifiedLimits: 'One deposit-free LPG connection per eligible household in the name of an adult female member.',
    whoMayQualify: [
      'Adult women belonging to eligible poor households (SC/ST, PMAY, AAY, Most Backward Classes).',
      'Applicant must not possess any existing LPG connection in her household.',
    ],
    officialInformationUrl: 'https://pmuy.gov.in',
    officialPortalUrl: 'https://pmuy.gov.in',
    applicationUrl: 'https://pmuy.gov.in/ujjwalamap.aspx',
    portalTitle: 'PMUY Ujjwala Portal',
    applicationSteps: [
      'Visit the official PMUY portal (pmuy.gov.in) and choose your preferred LPG distributor (Indane, Bharatgas, or HP Gas).',
      'Download and complete the Ujjwala 2.0 application form or submit online.',
      'Provide Aadhaar of applicant and adult family members.',
      'Submit bank account details with IFSC code for targeted direct subsidy transfer.',
      'Distributor validates de-duplication across all three oil marketing companies (OMCs) before issuing cylinder.',
    ],
    offlineSteps: [
      'Visit any authorized local LPG distributorship (IOCL Indane, BPCL Bharatgas, or HPCL HP Gas).',
      'Request the free Ujjwala 2.0 application form.',
      'Submit self-attested copies of Aadhaar, Ration Card, and bank passbook.',
    ],
    requiredDocuments: [
      {
        id: 'doc-aadhaar-pmuy',
        name: 'Aadhaar Card of Adult Woman Applicant',
        description: 'Mandatory proof of identity and address for connection release.',
        isMandatory: true,
        issuingAuthorityOrType: 'UIDAI',
      },
      {
        id: 'doc-ration-pmuy',
        name: 'Ration Card / Family Composition Document',
        description: 'Issued by State Government showing household member list.',
        isMandatory: true,
        issuingAuthorityOrType: 'State Food & Civil Supplies Department',
      },
      {
        id: 'doc-bank-pmuy',
        name: 'Bank Passbook / Account with Aadhaar-NPCI Seeding',
        description: 'Required for Direct Benefit Transfer of ongoing refill subsidies.',
        isMandatory: true,
        issuingAuthorityOrType: 'Commercial Bank',
      },
      {
        id: 'doc-migrant-decl',
        name: 'Self-Declaration for Migrant Workers',
        description: 'Self-declaration of address in lieu of local ration card under Ujjwala 2.0.',
        isMandatory: false,
        issuingAuthorityOrType: 'Self-declaration',
        conditionDescription: 'Permitted for migrant families lacking local address documentation.',
      },
    ],
    applicationDeadline: 'Rolling enrollment under Ujjwala 2.0 guidelines.',
    applicationFees: 'Completely free of cost. Security deposit, cylinder, hose, and first refill are 100% covered.',
    renewalRequirements: 'Ongoing domestic cylinder refills booked via OMC mobile apps or WhatsApp.',
    grievanceOrContact: {
      helplinePhone: '1906 (Emergency) / 1800-266-6696 (PMUY Helpline)',
      helplineEmail: 'support@pmuy.gov.in',
      grievancePortalName: 'MoPNG Citizen Grievance Portal',
      grievancePortalUrl: 'https://mopng.gov.in',
    },
    eligibilityCriteria: [
      {
        id: 'pmuy-crit-gender',
        title: 'Adult Woman Applicant',
        question: 'Is the applicant an adult woman aged 18 years or older?',
        category: 'status',
        options: [
          {
            label: 'Yes, applicant is an adult woman',
            value: 'yes_woman',
            isEligibleMatch: true,
            explanation: 'Eligible: Ujjwala connections are statutorily registered exclusively in the name of adult women.',
          },
          {
            label: 'No, applicant is male or minor',
            value: 'no_woman',
            isEligibleMatch: false,
            explanation: 'Ineligible: Male family members cannot apply under PMUY rules.',
          },
        ],
        officialRequirementDescription: 'Application must be submitted by an adult woman from the household.',
        supportingSourceUrl: 'https://pmuy.gov.in',
        whyWeAsk: 'The scheme statutorily empowers women by releasing domestic clean fuel connections in the female head of household name.',
      },
      {
        id: 'pmuy-crit-existing',
        title: 'No Existing LPG Connection in Household',
        question: 'Does anyone in your immediate household currently possess an active LPG connection?',
        category: 'general',
        options: [
          {
            label: 'No, no existing LPG connection in home',
            value: 'no_existing',
            isEligibleMatch: true,
            explanation: 'Eligible: Meets non-possession prerequisite.',
          },
          {
            label: 'Yes, household already has an LPG connection',
            value: 'yes_existing',
            isEligibleMatch: false,
            explanation: 'Ineligible: OMC de-duplication algorithms strictly prohibit multiple connections per household.',
          },
        ],
        officialRequirementDescription: 'Strictly zero existing domestic LPG connections in the applicant household.',
        supportingSourceUrl: 'https://pmuy.gov.in',
        whyWeAsk: 'National OMC de-duplication databases block issuance if an active connection is already registered for that address.',
      },
    ],
    uncertaintiesAndLimitations: [
      'OMC de-duplication matches against all three national distributors; unlinked duplicate family records will trigger automated rejection.',
    ],
    followUpAnswers: {
      check_eligibility: {
        title: 'PM Ujjwala Eligibility Rules',
        summary: 'Adult women from low-income families without an existing LPG cylinder qualify.',
        points: ['Must be an adult woman (18+).', 'No existing domestic LPG connection in family.', 'Listed in eligible BPL/priority categories.'],
      },
      show_documents: {
        title: 'Required Documents for Ujjwala',
        summary: 'Aadhaar, Ration card, and Aadhaar-seeded bank account.',
        points: ['Aadhaar card of applicant.', 'Ration card with family list.', 'Bank passbook.'],
      },
      explain_process: {
        title: 'Application Workflow',
        summary: 'Apply online on pmuy.gov.in or directly at nearest LPG gas agency.',
        points: ['Submit documents to distributor.', 'OMC de-duplication check is performed.', 'Receive cylinder and stove free of charge.'],
      },
      find_portal: {
        title: 'Official PMUY Portal',
        summary: 'Official National Portal: https://pmuy.gov.in',
        points: ['Never pay unauthorized middlemen for connection registration.'],
      },
      rejection_recourse: {
        title: 'Resolving De-duplication or Application Rejections',
        summary: 'Check if an old inactive connection is still linked in OMC records.',
        points: ['Surrender obsolete inactive connections at distributor.', 'Call toll-free helpline 1800-266-6696.'],
      },
    },
  },
  {
    id: 'national-scholarship-portal',
    keywords: ['national scholarship portal', 'nsp scholarship', 'central sector scholarship', 'post matric scholarship'],
    schemeOrServiceName: 'National Scholarship Portal (NSP / Central Sector Schemes)',
    alternativeNamesOrAbbreviations: ['NSP', 'National Scholarship Portal', 'CSSS'],
    departmentOrMinistry: 'Ministry of Electronics and Information Technology (MeitY) & Ministry of Education',
    jurisdiction: 'CENTRAL',
    shortDescription:
      'Single-window common electronic portal providing central and state merit-cum-means scholarships directly to students via Direct Benefit Transfer.',
    benefitsDescription:
      'Financial scholarships ranging from ₹10,000 to ₹20,000 per academic year for undergraduate and postgraduate study, disbursed directly to verified student bank accounts.',
    verifiedLimits: '₹10,000 per year at Graduation level (first 3 years); ₹20,000 per year at Post-Graduation level.',
    whoMayQualify: [
      'Students enrolled in regular full-time degree/diploma courses in AICTE/UGC recognized colleges.',
      'Students scoring above 80th percentile in relevant stream in Class 12 board examinations.',
      'Family gross annual income not exceeding published scheme ceilings (e.g. ₹4.5 lakh).',
    ],
    officialInformationUrl: 'https://scholarships.gov.in',
    officialPortalUrl: 'https://scholarships.gov.in',
    applicationUrl: 'https://scholarships.gov.in/fresh/newstdRegfrmInstruction',
    portalTitle: 'National Scholarship Portal (NSP)',
    applicationSteps: [
      'Register on scholarships.gov.in using your Aadhaar Number and active mobile number.',
      'Complete One-Time Registration (OTR) to obtain your persistent NSP Student Reference ID.',
      'Log in, complete academic details, enter college AISHE code, and upload marksheet and income certificate.',
      'Submit application online for Level 1 (Institute Nodal Officer) verification.',
      'Application proceeds to Level 2 (District/State Nodal Officer) verification before DBT merit disbursement.',
    ],
    offlineSteps: [
      'After online submission, print the system-generated application acknowledgment.',
      'Submit the printed form along with self-attested photocopies of marksheet and income certificate to your College Scholarship Nodal Officer.',
    ],
    requiredDocuments: [
      {
        id: 'doc-aadhaar-nsp',
        name: 'Student Aadhaar Card',
        description: 'Mandatory identification for biometric authentication and DBT payout.',
        isMandatory: true,
        issuingAuthorityOrType: 'UIDAI',
      },
      {
        id: 'doc-marksheet-nsp',
        name: 'Class 12 / Qualifying Exam Marksheet',
        description: 'Shows academic score meeting percentile threshold.',
        isMandatory: true,
        issuingAuthorityOrType: 'State / Central Education Board',
      },
      {
        id: 'doc-income-nsp',
        name: 'Competent Authority Income Certificate',
        description: 'Official revenue document showing annual family income under ceiling.',
        isMandatory: true,
        issuingAuthorityOrType: 'Tehsildar / Sub-Divisional Magistrate',
      },
      {
        id: 'doc-bank-nsp',
        name: 'Student Savings Bank Account Passbook',
        description: 'Account in student name seeded with Aadhaar for DBT transfer.',
        isMandatory: true,
        issuingAuthorityOrType: 'Commercial Bank',
      },
      {
        id: 'doc-caste-nsp',
        name: 'Category / Caste Certificate (SC/ST/OBC/EWS)',
        description: 'Required if applying under designated reserved category schemes.',
        isMandatory: false,
        issuingAuthorityOrType: 'Competent Revenue Authority',
        conditionDescription: 'Required only if claiming category-specific reservation or quota.',
      },
      {
        id: 'doc-pwd-nsp',
        name: 'Disability Certificate (PwD)',
        description: 'Official medical certificate showing minimum 40% permanent benchmark disability.',
        isMandatory: false,
        issuingAuthorityOrType: 'District Medical Board',
        conditionDescription: 'Required only for students applying under disability quota.',
      },
    ],
    applicationDeadline: 'Annual cycle: typically open July to November; renewal applications accepted concurrently.',
    applicationFees: 'Completely free. No registration or processing fee on the official portal.',
    renewalRequirements: 'Annual online renewal application with minimum 50% marks in previous year examination.',
    grievanceOrContact: {
      helplinePhone: '0120-6619540',
      helplineEmail: 'helpdesk@nsp.gov.in',
      grievancePortalName: 'NSP Grievance Desk',
      grievancePortalUrl: 'https://scholarships.gov.in',
    },
    eligibilityCriteria: [
      {
        id: 'nsp-crit-enrollment',
        title: 'Regular Full-Time College Student',
        question: 'Are you enrolled in a regular, full-time course at a recognized college or university?',
        category: 'status',
        options: [
          {
            label: 'Yes, regular full-time enrolled student',
            value: 'yes_enrolled',
            isEligibleMatch: true,
            explanation: 'Eligible: Regular enrollment at recognized institutions meets statutory study requirements.',
          },
          {
            label: 'No, correspondence or distance education',
            value: 'no_enrolled',
            isEligibleMatch: false,
            explanation: 'Ineligible: Central Sector Scheme excludes distance and correspondence courses.',
          },
        ],
        officialRequirementDescription: 'Course must be regular full-time at an institution with valid AISHE code.',
        supportingSourceUrl: 'https://scholarships.gov.in',
        whyWeAsk: 'Ministry guidelines restrict central higher education scholarships to regular full-time degree programs.',
      },
      {
        id: 'nsp-crit-income',
        title: 'Annual Family Income Below ₹4.5 Lakh',
        question: 'Is your total gross family annual income less than or equal to ₹4.50 lakh?',
        category: 'income',
        options: [
          {
            label: 'Yes, family income is under ₹4.5 lakh',
            value: 'yes_income',
            isEligibleMatch: true,
            explanation: 'Eligible: Meets means criteria for central scholarship assistance.',
          },
          {
            label: 'No, family income exceeds ₹4.5 lakh',
            value: 'no_income',
            isEligibleMatch: false,
            explanation: 'Ineligible: Central Sector scheme imposes strict income cutoff of ₹4.5 lakh per annum.',
          },
        ],
        officialRequirementDescription: 'Gross family income must not exceed ₹4.5 lakh per annum.',
        supportingSourceUrl: 'https://scholarships.gov.in',
        whyWeAsk: 'Statutory income caps ensure public scholarship funds reach economically deserving students.',
      },
    ],
    uncertaintiesAndLimitations: [
      'Both Institute Level (L1) and State Nodal Officer (L2) verification must be completed prior to the national deadline.',
      'Students cannot concurrently draw benefits from multiple central or state government scholarship schemes.',
    ],
    followUpAnswers: {
      check_eligibility: {
        title: 'NSP Eligibility Criteria',
        summary: 'Regular students meeting academic score and family income limits qualify.',
        points: ['Regular enrolled student.', 'Class 12 score above percentile threshold.', 'Family income under ₹4.5 lakh.'],
      },
      show_documents: {
        title: 'Required Documents for NSP',
        summary: 'Marksheet, Income certificate, Student Aadhaar, and Bank passbook.',
        points: ['Exam marksheet.', 'Income certificate.', 'Aadhaar card.', 'Bank passbook.'],
      },
      explain_process: {
        title: 'Scholarship Application Steps',
        summary: 'Complete OTR -> Submit form -> College verification -> State verification -> DBT disbursement.',
        points: ['Register on scholarships.gov.in.', 'Fill scheme application.', 'Submit hardcopy to college.'],
      },
      find_portal: {
        title: 'Official NSP Portal',
        summary: 'Official Portal: https://scholarships.gov.in',
        points: ['Always check portal URL ends with .gov.in.'],
      },
      rejection_recourse: {
        title: 'Resolving Defective Applications',
        summary: 'If marked "Defective" by college, log in and update corrections before cutoff.',
        points: ['Check reason on dashboard.', 'Correct marksheet or certificate.', 'Resubmit for college approval.'],
      },
    },
  },
  {
    id: 'pm-awas-yojana',
    keywords: ['pm awas', 'pmay', 'housing for all', 'pmay-g', 'pmay-u'],
    schemeOrServiceName: 'Pradhan Mantri Awas Yojana (PMAY)',
    alternativeNamesOrAbbreviations: ['PMAY', 'PMAY-Gramin', 'PMAY-Urban', 'Housing for All'],
    departmentOrMinistry: 'Ministry of Housing and Urban Affairs (MoHUA) & Ministry of Rural Development',
    jurisdiction: 'CENTRAL',
    shortDescription:
      'National flagship housing mission providing direct financial grants and interest subsidies to homeless families and those living in kutcha or dilapidated houses for constructing permanent pucca homes.',
    benefitsDescription:
      'Direct grant of ₹1.20 lakh (plains) to ₹1.30 lakh (hilly/difficult areas) under PMAY-Gramin, plus interest subsidies up to ₹2.67 lakh under PMAY-Urban Credit Linked Subsidy Scheme.',
    verifiedLimits: 'Grant of ₹1,20,000 to ₹1,30,000 for rural construction; up to ₹2,67,000 interest subsidy in urban areas.',
    whoMayQualify: [
      'Beneficiary families identified under SECC 2011 deprivation criteria or Awas+ survey.',
      'Homeless households or families living in zero, one, or two-room houses with kutcha walls and roof.',
      'Family must not own a pucca house anywhere in India.',
    ],
    officialInformationUrl: 'https://pmaymis.gov.in',
    officialPortalUrl: 'https://pmaymis.gov.in',
    applicationUrl: 'https://pmaymis.gov.in/Open/Check_Aadhar_Existence.aspx',
    portalTitle: 'PMAY National MIS Portal',
    applicationSteps: [
      'Check inclusion on the Awas+ rural list via your Gram Panchayat or visit pmaymis.gov.in for urban eligibility.',
      'Submit Aadhaar verification and consent form.',
      'Geo-tagging team inspects site and uploads photographs of existing kutcha structure.',
      'First installment released directly via DBT to bank account upon sanction.',
      'Subsequent installments released in milestone stages upon geo-tagged physical progress (plinth, lintel, roof).',
    ],
    offlineSteps: [
      'In rural areas: Contact your Gram Panchayat Secretary, Village Extension Officer (VEO), or Block Development Office (BDO).',
      'In urban areas: Visit your local Municipal Corporation / Municipality Housing Cell or Common Service Center.',
    ],
    requiredDocuments: [
      {
        id: 'doc-aadhaar-pmay',
        name: 'Aadhaar Card of All Family Members',
        description: 'Mandatory identification to ensure single-benefit deduplication across India.',
        isMandatory: true,
        issuingAuthorityOrType: 'UIDAI',
      },
      {
        id: 'doc-bank-pmay',
        name: 'Active Bank Account with Aadhaar-NPCI Seeding',
        description: 'Account where construction milestone grants are deposited directly.',
        isMandatory: true,
        issuingAuthorityOrType: 'Commercial Bank',
      },
      {
        id: 'doc-land-pmay',
        name: 'Land Ownership / Possession Certificate',
        description: 'Proof of legal possession of residential plot or homestead land.',
        isMandatory: true,
        issuingAuthorityOrType: 'Revenue Authority / Gram Panchayat NOC',
      },
      {
        id: 'doc-income-pmay',
        name: 'Income Certificate (EWS / LIG)',
        description: 'Proof of income bracket for urban interest subsidy classification.',
        isMandatory: false,
        issuingAuthorityOrType: 'Competent Authority',
        conditionDescription: 'Mandatory for PMAY-Urban Credit Linked Subsidy; not required for rural Gramin priority lists.',
      },
    ],
    applicationDeadline: 'Continuous rolling implementation under Cabinet-approved scheme targets.',
    applicationFees: 'Completely free. No payment or fee of any kind is required to be paid to any agent.',
    renewalRequirements: 'Not applicable; one-time capital grant for permanent home construction.',
    grievanceOrContact: {
      helplinePhone: '1800-11-6163 (Urban) / 1800-11-6446 (Rural)',
      helplineEmail: 'support-pmay@gov.in',
      grievancePortalName: 'PMAY Grievance Cell',
      grievancePortalUrl: 'https://pmaymis.gov.in',
    },
    eligibilityCriteria: [
      {
        id: 'pmay-crit-pucca',
        title: 'No Existing Pucca House in India',
        question: 'Do you or any member of your immediate family own a permanent (pucca) house anywhere in India?',
        category: 'status',
        options: [
          {
            label: 'No, we do not own a pucca house anywhere',
            value: 'no_pucca',
            isEligibleMatch: true,
            explanation: 'Eligible: Homeless and kutcha dwelling households qualify for government construction assistance.',
          },
          {
            label: 'Yes, family already owns a pucca house',
            value: 'yes_pucca',
            isEligibleMatch: false,
            explanation: 'Ineligible: PMAY strictly prohibits beneficiaries who already own a permanent home.',
          },
        ],
        officialRequirementDescription: 'Beneficiary household must not own a pucca house in their name anywhere in India.',
        supportingSourceUrl: 'https://pmaymis.gov.in',
        whyWeAsk: 'PMAY is targeted strictly at homeless families or those living in kutcha/dilapidated homes.',
      },
    ],
    uncertaintiesAndLimitations: [
      'Grant installments are released in tranches tied directly to geo-tagged photographic inspection of physical construction stages.',
    ],
    followUpAnswers: {
      check_eligibility: {
        title: 'PMAY Eligibility Requirements',
        summary: 'Homeless or kutcha-house living households who own no pucca house qualify.',
        points: ['No pucca house anywhere in India.', 'Homestead land possession.', 'Listed in Gram Panchayat priority / urban survey.'],
      },
      show_documents: {
        title: 'Required Documents for PMAY',
        summary: 'Aadhaar, Land title/NOC, and NPCI-seeded bank passbook.',
        points: ['Aadhaar of all family members.', 'Plot ownership/possession proof.', 'Bank account passbook.'],
      },
      explain_process: {
        title: 'PMAY Construction & Grant Release',
        summary: 'Sanction -> Geo-tagging -> 1st Installment -> Milestone verification -> Final completion.',
        points: ['Sanction letter issued.', 'Inspection of plinth/roof levels.', 'Direct credit of funds.'],
      },
      find_portal: {
        title: 'Official Housing Portals',
        summary: 'Urban: https://pmaymis.gov.in | Rural: https://pmayg.nic.in',
        points: ['Beware of fake housing lottery websites.'],
      },
      rejection_recourse: {
        title: 'Checking Awas+ Inclusion & Appeals',
        summary: 'Contact your Block Development Officer (BDO) or Gram Panchayat Secretary.',
        points: ['Check Awas+ listing.', 'Lodge grievance on pgportal.gov.in.'],
      },
    },
  },
];

// ==============================================================================
// 3.1 Passing Mention & Sensitive PII Detection Helpers
// ==============================================================================

/**
 * Checks if a scheme is merely mentioned in passing, as a comparison, or in a negative clause.
 * Prevents false positives where a claim mentions a scheme only peripherally.
 */
export function isPassingMention(claimText: string, keywords: string[]): boolean {
  if (!claimText) return false;
  const text = claimText.toLowerCase();

  const passingPrefixPatterns = [
    /\bunlike\s+([^,.;]+)/i,
    /\bcompared\s+to\s+([^,.;]+)/i,
    /\bdifferent\s+from\s+([^,.;]+)/i,
    /\bdistinct\s+from\s+([^,.;]+)/i,
    /\bas\s+opposed\s+to\s+([^,.;]+)/i,
    /\bnot\s+to\s+be\s+confused\s+with\s+([^,.;]+)/i,
    /\bnot\s+related\s+to\s+([^,.;]+)/i,
    /\binstead\s+of\s+([^,.;]+)/i,
    /\bin\s+contrast\s+to\s+([^,.;]+)/i,
    /\brather\s+than\s+([^,.;]+)/i,
    /\bbetter\s+than\s+([^,.;]+)/i,
    /\balternative\s+to\s+([^,.;]+)/i,
    /\bnot\s+eligible\s+for\s+([^,.;]+)/i,
  ];

  for (const pattern of passingPrefixPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const phrase = match[1];
      for (const kw of keywords) {
        if (phrase.includes(kw.toLowerCase())) {
          return true;
        }
      }
    }
  }

  return false;
}

const SENSITIVE_PII_PATTERNS = [
  { name: 'Aadhaar Number', regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/ },
  { name: 'Permanent Account Number (PAN)', regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/i },
  { name: 'Bank Account Number', regex: /\b\d{9,18}\b/ },
  { name: 'Authentication Credential / OTP / PIN', regex: /\b(otp|password|pin|cvv|secret)\b/i },
];

/**
 * Validates questionnaire inputs to reject any sensitive PII.
 */
export function detectSensitivePii(answers: Record<string, string>): { hasPii: boolean; piiType?: string } {
  if (!answers || typeof answers !== 'object') return { hasPii: false };
  for (const [key, value] of Object.entries(answers)) {
    if (typeof value !== 'string') continue;
    for (const pattern of SENSITIVE_PII_PATTERNS) {
      if (pattern.regex.test(value)) {
        return { hasPii: true, piiType: pattern.name };
      }
    }
  }
  return { hasPii: false };
}

/**
 * Identifies whether a claim relates to an identifiable government scheme
 * using sovereign knowledge matching and passing-mention rejection.
 */
export function detectSchemeFromClaimAndEvidence(params: {
  originalClaim: string;
  evidence?: any[];
  sources?: any[];
}): DetectedSchemeRecord | null {
  const { originalClaim, evidence, sources } = params;
  if (!originalClaim) return null;
  const claimLower = originalClaim.toLowerCase();

  let matchedScheme: KnownServiceRecord | null = null;
  let matchScore = 0;

  for (const scheme of KNOWN_SOVEREIGN_SCHEMES) {
    const matchedKw = scheme.keywords.find((kw) => claimLower.includes(kw.toLowerCase()));
    if (matchedKw) {
      if (isPassingMention(originalClaim, scheme.keywords)) {
        continue;
      }
      matchedScheme = scheme;
      matchScore = 0.95;
      break;
    }
  }

  // If no direct keyword match in claim, check verified evidence context
  if (!matchedScheme && evidence && Array.isArray(evidence) && evidence.length > 0) {
    for (const ev of evidence) {
      const textToSearch = `${ev.claim_text || ''} ${ev.sources?.title || ''} ${ev.sources?.url || ''}`.toLowerCase();
      for (const scheme of KNOWN_SOVEREIGN_SCHEMES) {
        if (scheme.keywords.some((kw) => textToSearch.includes(kw.toLowerCase()))) {
          if (!isPassingMention(originalClaim, scheme.keywords)) {
            matchedScheme = scheme;
            matchScore = 0.75;
            break;
          }
        }
      }
      if (matchedScheme) break;
    }
  }

  if (!matchedScheme) {
    return null;
  }

  // Validate URLs with SSRF protections
  const infoValidation = validateOfficialServiceUrl(matchedScheme.officialInformationUrl || matchedScheme.officialPortalUrl);
  const appValidation = matchedScheme.applicationUrl ? validateOfficialServiceUrl(matchedScheme.applicationUrl) : null;
  const isAppUrlVerified = Boolean(appValidation?.isValid && appValidation.isOfficialSovereign);

  const relevantEvidenceIds: string[] = [];
  if (evidence && Array.isArray(evidence)) {
    for (const ev of evidence) {
      if (ev.id) relevantEvidenceIds.push(ev.id);
    }
  }

  return {
    schemeId: matchedScheme.id,
    officialSchemeName: matchedScheme.schemeOrServiceName,
    alternativeNamesOrAbbreviations: matchedScheme.alternativeNamesOrAbbreviations,
    administeringMinistryOrDepartment: matchedScheme.departmentOrMinistry,
    jurisdiction: matchedScheme.jurisdiction,
    schemeInformationUrl: infoValidation.cleanUrl || matchedScheme.officialInformationUrl || matchedScheme.officialPortalUrl,
    applicationUrl: isAppUrlVerified ? appValidation?.cleanUrl : undefined,
    isApplicationUrlVerified: isAppUrlVerified,
    relevantEvidenceIds,
    lastSourceVerificationTimestamp: new Date().toISOString(),
    isMeaningfulConnection: true,
    matchConfidence: matchScore,
    detectionReasoning: `Identified primary sovereign scheme '${matchedScheme.schemeOrServiceName}' under ${matchedScheme.departmentOrMinistry}.`,
  };
}

/**
 * Builds a structured, source-grounded scheme guide incorporating benefits,
 * limits, mandatory vs conditional documents, and online/offline application instructions.
 */
export function buildSourceGroundedSchemeGuide(params: {
  schemeRecord: DetectedSchemeRecord;
  knownScheme?: KnownServiceRecord;
  verifiedSourcesList?: any[];
}): StructuredSchemeGuide {
  const { schemeRecord, knownScheme, verifiedSourcesList } = params;

  const appSteps = knownScheme?.applicationSteps || [
    'Visit the verified official government portal on a sovereign .gov.in domain.',
    'Review the official operational guidelines and citizen eligibility criteria.',
    'Prepare mandatory identification and supporting documents.',
    'Submit your application through the official designated portal or nearest CSC.',
    'Save your acknowledgment or application tracking number for future follow-up.',
  ];

  const offlineSteps = knownScheme?.offlineSteps || [
    'Visit your nearest Common Service Center (CSC) or designated Block Development / Taluka Revenue Office.',
    'Request the official application form for the scheme free of charge.',
    'Submit self-attested photocopies of mandatory documents and complete biometric e-KYC where required.',
    'Collect a physical receipt or acknowledgment slip containing your tracking number.',
  ];

  const docs = knownScheme?.requiredDocuments || [];

  const eligibilityExplanation = (knownScheme?.eligibilityCriteria || []).map((crit) => ({
    criterionId: crit.id,
    criterionTitle: crit.title,
    description: crit.officialRequirementDescription,
    whyItMatters: crit.whyWeAsk || `Required to establish statutory entitlement under ${schemeRecord.officialSchemeName} guidelines.`,
  }));

  const uncertainties: string[] = [];
  if (!schemeRecord.isApplicationUrlVerified) {
    uncertainties.push(
      'A direct online application link could not be independently confirmed on a primary sovereign portal. Beneficiaries should use the verified scheme information portal or visit an official local CSC.'
    );
  }
  if (knownScheme?.uncertaintiesAndLimitations) {
    uncertainties.push(...knownScheme.uncertaintiesAndLimitations);
  }

  const sourcesList = (verifiedSourcesList && verifiedSourcesList.length > 0)
    ? verifiedSourcesList
    : [
        {
          title: `${schemeRecord.officialSchemeName} Official Portal`,
          url: schemeRecord.schemeInformationUrl,
          domain: 'gov.in',
          retrievedAt: schemeRecord.lastSourceVerificationTimestamp,
          isOfficial: true,
        },
      ];

  return {
    schemeOverview: knownScheme?.shortDescription || `${schemeRecord.officialSchemeName} is an official government program administered by ${schemeRecord.administeringMinistryOrDepartment}.`,
    benefitsProvided: {
      description: knownScheme?.benefitsDescription || 'Official financial assistance or welfare coverage according to published government norms.',
      verifiedLimits: knownScheme?.verifiedLimits || undefined,
    },
    eligibilityExplanation,
    requiredDocuments: docs,
    applicationInstructions: {
      onlineSteps: appSteps,
      offlineOfficeSteps: offlineSteps,
    },
    verifiedInformationUrl: schemeRecord.schemeInformationUrl,
    verifiedApplicationUrl: schemeRecord.applicationUrl,
    isApplicationUrlConfirmed: schemeRecord.isApplicationUrlVerified,
    unverifiedApplicationNotice: !schemeRecord.isApplicationUrlVerified
      ? 'The direct online application link could not be independently confirmed on sovereign .gov.in/.nic.in infrastructure. Refer to the verified scheme information portal or visit an official local center.'
      : undefined,
    deadlinesFeesRenewal: {
      deadline: knownScheme?.applicationDeadline || 'Rolling enrollment throughout the year.',
      fees: knownScheme?.applicationFees || 'Completely free on the official portal.',
      renewalRequirements: knownScheme?.renewalRequirements || 'Annual e-KYC or life certificate where mandated.',
      contactDetails: knownScheme?.grievanceOrContact ? {
        helplinePhone: knownScheme.grievanceOrContact.helplinePhone,
        helplineEmail: knownScheme.grievanceOrContact.helplineEmail,
        grievancePortalUrl: knownScheme.grievanceOrContact.grievancePortalUrl,
      } : undefined,
    },
    nextStepsForCitizen: [
      'Verify your individual criteria against the published rules.',
      'Gather mandatory identification documents (Aadhaar, Bank Passbook, residency/income proof).',
      'Access the verified official portal or visit an authorized CSC to submit your intake form.',
      'Never pay unauthorized middleman fees or share OTPs/passwords with private third parties.',
    ],
    sources: sourcesList,
    uncertaintiesAndLimitations: uncertainties,
  };
}

// ==============================================================================
// 4. Action Guidance Synthesizer
// ==============================================================================

/**
 * Synthesizes official next steps, validated portal, checklist, and eligibility questions
 * tailored to the claim, its verified evidence, and the specific verdict outcome.
 */
export async function generateActionGuidance(params: {
  verificationRequestId: string;
  originalClaim: string;
  verdict: VerificationVerdict;
  summaryExplanation?: string;
  evidence?: any[];
  sources?: any[];
}): Promise<ActionGuidance> {
  const { verificationRequestId, originalClaim, verdict, summaryExplanation, evidence, sources } = params;
  const claimLower = originalClaim.toLowerCase();

  // Step 1: Detect matching scheme using Phase 6 detection logic (with passing-mention rejection)
  const detectedScheme = detectSchemeFromClaimAndEvidence({
    originalClaim,
    evidence,
    sources,
  });

  const matchedScheme = detectedScheme
    ? KNOWN_SOVEREIGN_SCHEMES.find((s) => s.id === detectedScheme.schemeId) || null
    : null;

  // Also inspect verified source domains and titles if available
  const verifiedSourcesList: Array<{ title: string; url: string; domain: string; retrievedAt?: string; isOfficial: boolean }> = [];
  if (sources && sources.length > 0) {
    for (const src of sources) {
      const validated = validateOfficialServiceUrl(src.url || '');
      verifiedSourcesList.push({
        title: src.title || 'Official Government Source',
        url: src.url || '',
        domain: src.domain || validated.domain,
        retrievedAt: src.retrieved_at,
        isOfficial: validated.isOfficialSovereign,
      });
    }
  }

  // If evidence exists with sources
  if (evidence && evidence.length > 0) {
    for (const ev of evidence) {
      if (ev.sources) {
        const validated = validateOfficialServiceUrl(ev.sources.url || '');
        if (!verifiedSourcesList.some((s) => s.url === ev.sources.url)) {
          verifiedSourcesList.push({
            title: ev.sources.title || 'Official Government Source',
            url: ev.sources.url || '',
            domain: ev.sources.domain || validated.domain,
            retrievedAt: ev.sources.retrieved_at,
            isOfficial: validated.isOfficialSovereign,
          });
        }
      }
    }
  }

  // Build Phase 6 Source-Grounded Scheme Guide if a scheme is detected
  const schemeGuide = detectedScheme
    ? buildSourceGroundedSchemeGuide({
        schemeRecord: detectedScheme,
        knownScheme: matchedScheme || undefined,
        verifiedSourcesList,
      })
    : undefined;

  // ============================================================================
  // Step 2: VERDICT MATCHING RULES (Requirement 3)
  // ============================================================================

  // CASE 1: CONTRADICTED CLAIMS
  // Rules: Explain why claim is contradicted. Do NOT guide users to act on the false claim!
  if (verdict === 'CONTRADICTED') {
    return {
      verificationRequestId,
      verdict,
      hasActionableService: false,
      verdictActionHeading: 'Protect Yourself from Misinformation & Unauthorized Demands',
      verdictActionSummary:
        'This claim has been officially refuted by government records. Do not attempt to pay unauthorized fees, share banking credentials, or register on unofficial third-party portals based on this statement.',
      advisoryType: 'CONTRADICTED_ALERT',
      eligibilityCriteria: [],
      checklist: [
        {
          id: 'task-no-pay',
          task: 'Do not pay any fee or surcharge based on this claim',
          detail: 'Official agencies have confirmed that no such order, surcharge, or mandatory payment exists.',
          category: 'prerequisite',
          isOfficialMandate: true,
        },
        {
          id: 'task-no-share',
          task: 'Protect your Aadhaar, OTP, and UPI PIN',
          detail: 'Fraudulent messages often use fake government notices to solicit private citizen credentials.',
          category: 'prerequisite',
          isOfficialMandate: true,
        },
        {
          id: 'task-verify-pib',
          task: 'Cross-check viral rumors with PIB Fact Check',
          detail: 'Check official debunkings on pib.gov.in before sharing on social media or messaging platforms.',
          category: 'portal_step',
          isOfficialMandate: false,
        },
        {
          id: 'task-report-cyber',
          task: 'Report suspicious links or online extortion',
          detail: 'Lodge a cyber fraud complaint on the National Cyber Crime Reporting Portal (cybercrime.gov.in) or dial 1930.',
          category: 'post_submission',
          isOfficialMandate: true,
        },
      ],
      followUpActions: [
        {
          key: 'rejection_recourse',
          label: 'What if someone demands payment based on this claim?',
          title: 'Official Grievance & Scam Reporting Channels',
          summary: 'Immediately report unauthorized financial demands to official grievance authorities.',
          detailedPoints: [
            'National Cyber Crime Reporting Portal: https://cybercrime.gov.in (Helpline: 1930).',
            'RBI Banking Ombudsman: https://cms.rbi.org.in for payment disputes.',
            'Do not engage with unverified WhatsApp or Telegram channels claiming to be government representatives.',
          ],
          officialSourceUrl: 'https://cybercrime.gov.in',
        },
        {
          key: 'find_portal',
          label: 'Where can I see the official fact-check notice?',
          title: 'Official PIB Fact Check Archive',
          summary: 'The Press Information Bureau regularly archives viral misinformation warnings.',
          detailedPoints: [
            'Visit the official portal at https://pib.gov.in.',
            'Search the official Ministry clarification notices archive.',
          ],
          officialSourceUrl: 'https://pib.gov.in',
        },
      ],
      service: {
        isServiceIdentified: false,
        schemeOrServiceName: 'Official Clarification / Consumer Protection Alert',
        departmentOrMinistry: 'Press Information Bureau / Cyber Crime Cell, Government of India',
        shortDescription:
          'Authoritative advisories protecting citizens from fraudulent viral rumors, fake orders, and unauthorized surcharges.',
        whoMayQualify: ['All citizens seeking protection from fraudulent misinformation.'],
        isPortalVerified: false,
        portalValidationNote: 'Official application link not verified (No genuine application exists for a contradicted claim).',
        destinationNotice:
          'Because the claim is contradicted, no official application portal exists for this false premise. Use the verified grievance channels below to report cyber fraud.',
        applicationSteps: [
          'Verify the original government circular on sovereign .gov.in websites.',
          'Do not click shortened URLs (bit.ly, tinyurl) circulated in viral messages.',
          'Report fraudulent demands on cybercrime.gov.in or helpline 1930.',
        ],
        requiredDocuments: [],
        applicationDeadline: null,
        applicationFees: 'No fee officially prescribed or demanded.',
        grievanceOrContact: {
          helplinePhone: '1930 (National Cyber Crime Helpline)',
          helplineEmail: 'contact@cybercrime.gov.in',
          grievancePortalName: 'National Cyber Crime Reporting Portal',
          grievancePortalUrl: 'https://cybercrime.gov.in',
        },
        sources: verifiedSourcesList,
        lastCheckedDate: new Date().toISOString().split('T')[0],
      },
      officialDisclaimers: [
        'GovVerify AI is an independent civic research platform and is not affiliated with or endorsed by any government department.',
        'Never submit private identity tokens, passwords, or bank OTPs to unverified sources.',
      ],
      generatedAt: new Date().toISOString(),
      detectedScheme: detectedScheme || undefined,
      schemeGuide: schemeGuide || undefined,
    };
  }

  // CASE 2: INSUFFICIENT EVIDENCE CLAIMS
  // Rules: Do NOT recommend an application or claim user qualifies. Provide safe official directories.
  if (verdict === 'INSUFFICIENT_EVIDENCE') {
    return {
      verificationRequestId,
      verdict,
      hasActionableService: false,
      verdictActionHeading: 'Verify Further on Safe Sovereign Government Directories',
      verdictActionSummary:
        'Because reliable primary government records could not be found to verify or refute this claim, we do not recommend applying or submitting private data. Use official national directories to check whether a genuine scheme exists.',
      advisoryType: 'UNVERIFIED_SAFE_SEARCH',
      eligibilityCriteria: [],
      checklist: [
        {
          id: 'task-no-personal-data',
          task: 'Do not submit Aadhaar, bank details, or passwords',
          detail: 'Unverified schemes may be fraudulent intake traps. Only enter data on verified .gov.in domains.',
          category: 'prerequisite',
          isOfficialMandate: true,
        },
        {
          id: 'task-check-myscheme',
          task: 'Search the National myScheme Portal',
          detail: 'Explore authentic central and state government schemes on myscheme.gov.in.',
          category: 'portal_step',
          isOfficialMandate: false,
        },
        {
          id: 'task-check-indiagov',
          task: 'Inspect National Portal of India directory',
          detail: 'Verify ministry programs directly on india.gov.in/my-government/schemes.',
          category: 'portal_step',
          isOfficialMandate: false,
        },
      ],
      followUpActions: [
        {
          key: 'find_portal',
          label: 'Where can I find genuine government schemes?',
          title: 'Official National Government Directories',
          summary: 'Use the official National myScheme directory or National Portal of India.',
          detailedPoints: [
            'myScheme platform: https://www.myscheme.gov.in (Official Government of India portal).',
            'National Portal of India: https://india.gov.in/my-government/schemes.',
            'Directly contact the relevant Central Ministry via their official .gov.in website.',
          ],
          officialSourceUrl: 'https://www.myscheme.gov.in',
        },
      ],
      service: {
        isServiceIdentified: false,
        schemeOrServiceName: 'Unverified Scheme / Central Directory Research',
        departmentOrMinistry: 'Ministry / Department Unverified',
        shortDescription:
          'This claim could not be confirmed in primary official gazettes. Exercise caution before trusting secondary reports.',
        whoMayQualify: [],
        isPortalVerified: false,
        portalValidationNote: 'Official application link not verified (No authentic government gazette found).',
        destinationNotice:
          'No authenticated service endpoint could be established. Visit the official myScheme directory to discover active programs.',
        applicationSteps: [
          'Visit official national directory: https://www.myscheme.gov.in.',
          'Filter by category, state, and verified eligibility requirements.',
          'Confirm program existence before taking any administrative steps.',
        ],
        requiredDocuments: [],
        applicationDeadline: null,
        applicationFees: null,
        grievanceOrContact: {
          helplinePhone: '1800-111-555 (National Government Services Helpline)',
          grievancePortalName: 'CPGRAMS Central Public Grievance Portal',
          grievancePortalUrl: 'https://pgportal.gov.in',
        },
        sources: verifiedSourcesList,
        lastCheckedDate: new Date().toISOString().split('T')[0],
      },
      officialDisclaimers: [
        'GovVerify AI does not make official determinations of government policy or citizen eligibility.',
        'Official application links are shown only when validated against sovereign .gov.in or .nic.in infrastructure.',
      ],
      generatedAt: new Date().toISOString(),
      detectedScheme: detectedScheme || undefined,
      schemeGuide: schemeGuide || undefined,
    };
  }

  // CASE 3 & 4: SUPPORTED OR PARTIALLY_SUPPORTED CLAIMS
  // If matchedScheme exists, use its detailed verified data; otherwise generate safe structured guidance
  const serviceName = matchedScheme?.schemeOrServiceName || 'Identified Government Program';
  const departmentName = matchedScheme?.departmentOrMinistry || 'Central / State Ministry';
  const portalUrl = matchedScheme?.officialPortalUrl || (verifiedSourcesList[0]?.isOfficial ? verifiedSourcesList[0].url : undefined);
  const portalTitle = matchedScheme?.portalTitle || (verifiedSourcesList[0]?.title || 'Official Government Portal');
  const validatedPortal = portalUrl ? validateOfficialServiceUrl(portalUrl) : null;
  const isPortalVerified = Boolean(validatedPortal?.isOfficialSovereign);

  const isPartiallySupported = verdict === 'PARTIALLY_SUPPORTED';

  const verdictActionHeading = isPartiallySupported
    ? 'Important Conditions & Verified Next Steps'
    : 'Verified Official Next Steps & Application Guidance';

  const verdictActionSummary = isPartiallySupported
    ? 'This claim is partially supported. While the core benefit or initiative exists, crucial conditions, mandatory prerequisites, or specific exclusions apply. Review the verified conditions below before proceeding.'
    : 'Evidence confirms this government initiative. However, a supported general claim does not prove individual eligibility. Review the official eligibility criteria, required documents, and validated portal below.';

  const steps = matchedScheme?.applicationSteps || [
    'Visit the verified official government portal on a sovereign .gov.in domain.',
    'Review the official operational guidelines and citizen eligibility criteria.',
    'Prepare mandatory identification and supporting documents.',
    'Submit your application through the official designated portal or nearest CSC.',
    'Save your acknowledgment or application tracking number for future follow-up.',
  ];

  const docs = matchedScheme?.requiredDocuments || [
    {
      id: 'doc-aadhaar-gen',
      name: 'Aadhaar Card',
      description: 'Primary proof of identity and biometric verification for DBT schemes.',
      isMandatory: true,
      issuingAuthorityOrType: 'UIDAI',
    },
    {
      id: 'doc-bank-gen',
      name: 'Bank Passbook / Cancelled Cheque',
      description: 'Active bank account linked with Aadhaar/NPCI for direct benefit transfer.',
      isMandatory: true,
      issuingAuthorityOrType: 'Bank',
    },
    {
      id: 'doc-address-gen',
      name: 'Proof of Residence / Address',
      description: 'Ration card, voter ID, or electricity bill proving residency in target state/jurisdiction.',
      isMandatory: false,
      issuingAuthorityOrType: 'State Authority',
    },
  ];

  const checklist: ChecklistTaskItem[] = [
    {
      id: 'chk-prereq-verify',
      task: 'Confirm your individual eligibility against documented rules',
      detail: isPartiallySupported
        ? 'Pay special attention to mandatory prerequisites that condition this benefit.'
        : 'Ensure your household meets all statutory criteria before applying.',
      category: 'prerequisite',
      isOfficialMandate: true,
    },
    {
      id: 'chk-docs-ready',
      task: 'Gather all mandatory documents in advance',
      detail: 'Keep clear scanned copies (PDF/JPEG under 200KB) of identity and address proofs ready.',
      category: 'document',
      isOfficialMandate: true,
    },
    {
      id: 'chk-portal-submit',
      task: 'Submit application only on the verified official portal',
      detail: `Always verify that the address bar shows .gov.in or .nic.in (${validatedPortal?.domain || 'official portal'}).`,
      category: 'portal_step',
      isOfficialMandate: true,
    },
    {
      id: 'chk-track-ack',
      task: 'Note down and securely store your Application / Acknowledgment Number',
      detail: 'Required for tracking application status and lodging future grievance inquiries.',
      category: 'post_submission',
      isOfficialMandate: false,
    },
  ];

  // Follow-up actions
  const followUpActions: FollowUpActionAnswer[] = [];
  if (matchedScheme?.followUpAnswers) {
    for (const [key, val] of Object.entries(matchedScheme.followUpAnswers)) {
      followUpActions.push({
        key: key as any,
        label: key === 'check_eligibility' ? 'Check my eligibility' :
               key === 'show_documents' ? 'Show required documents' :
               key === 'explain_process' ? 'Explain the application process' :
               key === 'find_portal' ? 'Find the official portal' :
               'What if my application is rejected?',
        title: val.title,
        summary: val.summary,
        detailedPoints: val.points,
        officialSourceUrl: matchedScheme.officialPortalUrl,
      });
    }
  } else {
    followUpActions.push(
      {
        key: 'check_eligibility',
        label: 'Check my eligibility',
        title: 'Eligibility Guidelines',
        summary: 'Verify criteria on the official ministry portal.',
        detailedPoints: [
          'Review documented age, income, and landholding thresholds.',
          'Verify state-specific domiciliary conditions where applicable.',
        ],
        officialSourceUrl: portalUrl,
      },
      {
        key: 'show_documents',
        label: 'Show required documents',
        title: 'Required Documentation',
        summary: 'Aadhaar, active bank account, and proof of residence are required.',
        detailedPoints: docs.map((d) => `${d.name}: ${d.description}`),
        officialSourceUrl: portalUrl,
      },
      {
        key: 'explain_process',
        label: 'Explain the application process',
        title: 'Application Workflow',
        summary: 'Step-by-step guidance for applying through official channels.',
        detailedPoints: steps,
        officialSourceUrl: portalUrl,
      },
      {
        key: 'find_portal',
        label: 'Find the official portal',
        title: 'Official Portal Access',
        summary: isPortalVerified
          ? `Verified sovereign portal: ${portalUrl}`
          : 'Official application link not verified.',
        detailedPoints: [
          `Destination: ${portalUrl || 'Not verified'}`,
          'Never submit applications on unofficial or suspicious websites.',
        ],
        officialSourceUrl: portalUrl,
      },
      {
        key: 'rejection_recourse',
        label: 'What if my application is rejected?',
        title: 'Grievance & Appeal Redressal',
        summary: 'Lodge an appeal with the concerned department or through CPGRAMS.',
        detailedPoints: [
          'Verify reason for rejection in your application portal account.',
          'Submit a formal grievance on the CPGRAMS portal: https://pgportal.gov.in.',
          'Contact the designated District Nodal Officer or Block Development Office.',
        ],
        officialSourceUrl: 'https://pgportal.gov.in',
      }
    );
  }

  const service: ActionServiceDetails = {
    isServiceIdentified: true,
    schemeOrServiceName: serviceName,
    departmentOrMinistry: departmentName,
    shortDescription: matchedScheme?.shortDescription || summaryExplanation || 'Verified government service initiative.',
    whoMayQualify: matchedScheme?.whoMayQualify || [
      'Citizens fulfilling statutory eligibility criteria laid out in official ministry guidelines.',
    ],
    officialPortalUrl: isPortalVerified ? portalUrl : undefined,
    portalTitle,
    portalDomain: validatedPortal?.domain,
    isPortalVerified,
    portalValidationNote: isPortalVerified
      ? `Verified official government portal (${validatedPortal?.domain}).`
      : 'Official application link not verified.',
    destinationNotice: isPortalVerified
      ? `You will complete your application directly on the official ${validatedPortal?.domain} government website. GovVerify AI is an independent research tool and does not submit applications on your behalf.`
      : 'An official application endpoint could not be verified with primary sovereign records.',
    applicationSteps: steps,
    requiredDocuments: docs,
    applicationDeadline: matchedScheme?.applicationDeadline || null,
    applicationFees: matchedScheme?.applicationFees || 'Free of cost on the official portal.',
    grievanceOrContact: matchedScheme?.grievanceOrContact || {
      helplinePhone: '1800-111-555',
      grievancePortalName: 'CPGRAMS Central Public Grievance Portal',
      grievancePortalUrl: 'https://pgportal.gov.in',
    },
    sources: verifiedSourcesList,
    lastCheckedDate: new Date().toISOString().split('T')[0],
  };

  return {
    verificationRequestId,
    verdict,
    hasActionableService: true,
    verdictActionHeading,
    verdictActionSummary,
    advisoryType: isPartiallySupported ? 'CONDITIONAL_ACTION' : 'SUPPORTED_ACTION',
    service,
    eligibilityCriteria: matchedScheme?.eligibilityCriteria || [],
    checklist,
    followUpActions,
    officialDisclaimers: [
      'GovVerify AI is an independent civic research platform and is not affiliated with or endorsed by any government department.',
      'A supported claim confirms the existence of official rules but does not constitute an individual determination of eligibility.',
      'Citizens must complete all applications directly on the official government portal.',
    ],
    generatedAt: new Date().toISOString(),
    detectedScheme: detectedScheme || undefined,
    schemeGuide: schemeGuide || undefined,
  };
}

// ==============================================================================
// 5. Eligibility Evaluation (Personalized Questionnaire Processing)
// ==============================================================================

/**
 * Compares user answers against documented scheme requirements deterministically,
 * rejecting sensitive personal credentials and enforcing strict 3-category classification.
 */
export function evaluateEligibilityAnswers(
  criteria: EligibilityCriterion[],
  userAnswers: Record<string, string>
): EligibilityEvaluationResult {
  // PII Prevention Guard: Reject and redact sensitive citizen data
  const piiCheck = detectSensitivePii(userAnswers);
  if (piiCheck.hasPii) {
    return {
      category: 'CANNOT_DETERMINE',
      categoryLabel: 'Cannot determine from the available information',
      matchingCriteria: [],
      unmatchingCriteria: [],
      unknownCriteria: criteria.map((c) => ({
        id: c.id,
        title: c.title,
        note: 'Evaluation aborted due to sensitive personal identification data in input.',
        sourceUrl: c.supportingSourceUrl,
      })),
      overallGuidance: `Sensitive personal data (${piiCheck.piiType}) detected in input. For your security and privacy, GovVerify AI immediately redacts and rejects sensitive personal identification credentials.`,
      disclaimer: 'GovVerify AI strictly rejects the collection or evaluation of sensitive citizen credentials (Aadhaar, PAN, bank accounts, passwords, or OTPs). Please remove sensitive numbers before checking eligibility.',
      piiWarning: `Potential ${piiCheck.piiType} detected. GovVerify AI never collects, stores, or processes private citizen credentials.`,
    };
  }

  const matchingCriteria: Array<{ id: string; title: string; note: string; sourceUrl?: string }> = [];
  const unmatchingCriteria: Array<{ id: string; title: string; note: string; sourceUrl?: string }> = [];
  const unknownCriteria: Array<{ id: string; title: string; note: string; sourceUrl?: string }> = [];

  for (const crit of criteria) {
    const selectedValue = userAnswers[crit.id];
    if (!selectedValue) {
      unknownCriteria.push({
        id: crit.id,
        title: crit.title,
        note: 'Not answered yet. Review the documented requirement.',
        sourceUrl: crit.supportingSourceUrl,
      });
      continue;
    }

    const matchedOption = crit.options.find((opt) => opt.value === selectedValue);
    if (!matchedOption) {
      unknownCriteria.push({
        id: crit.id,
        title: crit.title,
        note: 'Unknown answer provided.',
        sourceUrl: crit.supportingSourceUrl,
      });
    } else if (matchedOption.isEligibleMatch) {
      matchingCriteria.push({
        id: crit.id,
        title: crit.title,
        note: matchedOption.explanation,
        sourceUrl: crit.supportingSourceUrl,
      });
    } else {
      unmatchingCriteria.push({
        id: crit.id,
        title: crit.title,
        note: matchedOption.explanation,
        sourceUrl: crit.supportingSourceUrl,
      });
    }
  }

  // Phase 6 Deterministic 3-Category Classification
  let category: EligibilityVerdictCategory;
  let categoryLabel: string;
  let overallGuidance = '';

  if (unmatchingCriteria.length > 0) {
    category = 'MAY_NOT_MEET_CONDITION';
    categoryLabel = 'May not meet a listed condition';
    overallGuidance = `Based on your answers, ${unmatchingCriteria.length} statutory requirement(s) may not currently match official criteria. Check whether any exceptions, alternative categories, or exemptions apply under official guidelines.`;
  } else if (criteria.length > 0 && matchingCriteria.length === criteria.length) {
    category = 'LIKELY_ELIGIBLE';
    categoryLabel = 'Likely eligible based on your answers';
    overallGuidance =
      'Your preliminary responses match the primary documented criteria for this scheme. Proceed to review the required documents and application checklist on the official portal.';
  } else {
    category = 'CANNOT_DETERMINE';
    categoryLabel = 'Cannot determine from the available information';
    overallGuidance =
      'Some criteria remain unconfirmed or unanswered. Review the remaining requirements on the official government portal.';
  }

  return {
    category,
    categoryLabel,
    matchingCriteria,
    unmatchingCriteria,
    unknownCriteria,
    overallGuidance,
    disclaimer:
      'This preliminary questionnaire is based solely on published government guidelines. It does not constitute an official government determination, grant, or guarantee of benefit disbursement. Only the designated government authority can approve official applications.',
  };
}

// ==============================================================================
// 6. In-Memory Cache & Resilient Persistence
// ==============================================================================

const actionGuidanceCache = new Map<string, ActionGuidance>();

/**
 * Retrieves or generates action guidance for a specific verification request ID.
 */
export async function getOrGenerateActionGuidance(
  verificationRequestId: string
): Promise<ActionGuidance> {
  // Check memory cache first
  if (actionGuidanceCache.has(verificationRequestId)) {
    return actionGuidanceCache.get(verificationRequestId)!;
  }

  // Attempt database retrieval
  const supabase = getServerSupabase();
  const { data: requestRecord, error: reqErr } = await supabase
    .from('verification_requests')
    .select('*, claims(*), evidence(*, sources(*)), verification_results(*)')
    .eq('id', verificationRequestId)
    .single();

  if (reqErr || !requestRecord) {
    throw new Error(`Verification request ${verificationRequestId} not found.`);
  }

  const vrData = requestRecord.verification_results;
  const verdictRecord = Array.isArray(vrData) ? vrData[0] : vrData;
  const verdict: VerificationVerdict = (verdictRecord?.verdict as VerificationVerdict) || 'INSUFFICIENT_EVIDENCE';

  const guidance = await generateActionGuidance({
    verificationRequestId,
    originalClaim: requestRecord.original_claim || '',
    verdict,
    summaryExplanation: verdictRecord?.explanation,
    evidence: requestRecord.evidence,
  });

  // Save to cache
  actionGuidanceCache.set(verificationRequestId, guidance);

  // Attempt non-blocking database persistence if action_guidance table exists
  try {
    await supabase.from('action_guidance').upsert(
      {
        verification_request_id: verificationRequestId,
        has_actionable_service: guidance.hasActionableService,
        guidance_data: guidance,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'verification_request_id' }
    );
  } catch {
    // Graceful fallback: table might not be migrated yet in some test environments
  }

  return guidance;
}
