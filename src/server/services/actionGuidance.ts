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
}

export interface EligibilityEvaluationResult {
  matchingCriteria: Array<{ id: string; title: string; note: string; sourceUrl?: string }>;
  unmatchingCriteria: Array<{ id: string; title: string; note: string; sourceUrl?: string }>;
  unknownCriteria: Array<{ id: string; title: string; note: string; sourceUrl?: string }>;
  overallGuidance: string;
  disclaimer: string;
}

export interface RequiredDocumentItem {
  id: string;
  name: string;
  description: string;
  isMandatory: boolean;
  issuingAuthorityOrType: string;
  sourceReference?: string;
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
  const lower = hostname.toLowerCase();
  if (PRIVATE_OR_LOCAL_HOSTNAMES.has(lower)) return true;
  if (lower.endsWith('.local') || lower.endsWith('.internal') || lower.endsWith('.localhost')) return true;

  // IPv4 Private Range checks
  const ipv4Match = lower.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octet1 = parseInt(ipv4Match[1], 10);
    const octet2 = parseInt(ipv4Match[2], 10);

    // 10.0.0.0/8
    if (octet1 === 10) return true;
    // 127.0.0.0/8
    if (octet1 === 127) return true;
    // 169.254.0.0/16 (Link-Local)
    if (octet1 === 169 && octet2 === 254) return true;
    // 172.16.0.0/12
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;
    // 192.168.0.0/16
    if (octet1 === 192 && octet2 === 168) return true;
    // 0.0.0.0/8
    if (octet1 === 0) return true;
  }

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
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'GovVerify-AI-LinkVerifier/1.0 (+https://govverify.internal)',
      },
    });

    clearTimeout(timeout);

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

interface KnownServiceRecord {
  keywords: string[];
  schemeOrServiceName: string;
  departmentOrMinistry: string;
  shortDescription: string;
  whoMayQualify: string[];
  officialPortalUrl: string;
  portalTitle: string;
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
  eligibilityCriteria: EligibilityCriterion[];
  followUpAnswers: Record<string, { title: string; summary: string; points: string[] }>;
}

const KNOWN_SOVEREIGN_SCHEMES: KnownServiceRecord[] = [
  {
    keywords: ['pm kisan', 'pm-kisan', 'kisan samman', 'farmer installment', 'pmkisan'],
    schemeOrServiceName: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)',
    departmentOrMinistry: 'Ministry of Agriculture and Farmers Welfare, Government of India',
    shortDescription:
      'Direct income support scheme providing ₹6,000 per year in three equal four-monthly installments of ₹2,000 directly into the Aadhaar-seeded bank accounts of eligible landholding farmer families.',
    whoMayQualify: [
      'All landholding farmer families with cultivable land in their name.',
      'Small and marginal farmer households in rural or peri-urban areas.',
      'Exclusions apply for institutional landholders, income-tax payers, and constitutional post holders.',
    ],
    officialPortalUrl: 'https://pmkisan.gov.in',
    portalTitle: 'PM-KISAN National Portal',
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
    keywords: ['surya ghar', 'muft bijli', 'rooftop solar', 'solar subsidy', 'pmsuryaghar', 'mnre solar'],
    schemeOrServiceName: 'PM Surya Ghar: Muft Bijli Yojana',
    departmentOrMinistry: 'Ministry of New and Renewable Energy (MNRE), Government of India',
    shortDescription:
      'Residential rooftop solar subsidy initiative providing up to ₹78,000 in central financial assistance to help households generate up to 300 units of free clean solar electricity per month.',
    whoMayQualify: [
      'Residential households with an active domestic electricity connection.',
      'Applicants with undisputed roof rights or space suitable for solar panel installation.',
      'Must not have previously availed central financial assistance for the same domestic connection.',
    ],
    officialPortalUrl: 'https://pmsuryaghar.gov.in',
    portalTitle: 'PM Surya Ghar National Portal',
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
    keywords: ['ayushman', 'pmjay', 'pm-jay', 'golden card', 'health insurance 5 lakh'],
    schemeOrServiceName: 'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana (AB-PMJAY)',
    departmentOrMinistry: 'National Health Authority (NHA), Ministry of Health and Family Welfare',
    shortDescription:
      'World’s largest government-funded health assurance scheme, providing health cover of ₹5 lakh per family per year for secondary and tertiary care hospitalization.',
    whoMayQualify: [
      'Deprived rural and urban households identified under Socio-Economic Caste Census (SECC 2011).',
      'All senior citizens aged 70 years and above, irrespective of income (under expanded AB-PMJAY Senior Citizen cover).',
      'Existing RSBY cardholders and state-specific expanded beneficiary lists.',
    ],
    officialPortalUrl: 'https://beneficiary.nha.gov.in',
    portalTitle: 'Ayushman Beneficiary Portal (NHA)',
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
];

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

  // Step 1: Detect matching scheme from known sovereign knowledge registry or retrieved evidence
  let matchedScheme: KnownServiceRecord | null = null;
  for (const scheme of KNOWN_SOVEREIGN_SCHEMES) {
    if (scheme.keywords.some((kw) => claimLower.includes(kw))) {
      matchedScheme = scheme;
      break;
    }
  }

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
  };
}

// ==============================================================================
// 5. Eligibility Evaluation (Personalized Questionnaire Processing)
// ==============================================================================

/**
 * Compares user answers against documented scheme requirements without storing personal information.
 */
export function evaluateEligibilityAnswers(
  criteria: EligibilityCriterion[],
  userAnswers: Record<string, string>
): EligibilityEvaluationResult {
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

  let overallGuidance = '';
  if (unmatchingCriteria.length > 0) {
    overallGuidance = `Based on your answers, ${unmatchingCriteria.length} statutory requirement(s) may not currently match official criteria. Check whether any exceptions or alternative categories apply under official guidelines.`;
  } else if (matchingCriteria.length === criteria.length && criteria.length > 0) {
    overallGuidance =
      'Your preliminary responses match the primary documented criteria for this scheme. Proceed to review the required documents and application checklist on the official portal.';
  } else {
    overallGuidance =
      'Some criteria remain unconfirmed. Review the remaining requirements on the official government portal.';
  }

  return {
    matchingCriteria,
    unmatchingCriteria,
    unknownCriteria,
    overallGuidance,
    disclaimer:
      'This questionnaire provides preliminary civic guidance based on published guidelines. It does not constitute an official government determination or entitlement.',
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
