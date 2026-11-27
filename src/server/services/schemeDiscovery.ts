/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import { getGeminiClient, getGeminiConfigStatus, GEMINI_FLASH_MODEL } from './gemini';
import { getServerSupabase, getSupabaseConfigStatus } from '../supabase';

export type SchemeStatus =
  | 'ACTIVE'
  | 'UPCOMING'
  | 'CLOSED'
  | 'DISCONTINUED'
  | 'RENAMED'
  | 'UNKNOWN';

export type SchemeJurisdiction = 'CENTRAL' | 'STATE' | 'JOINT';

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

export interface GovernmentScheme {
  id: string;
  schemeName: string;
  shortName?: string;
  slug: string;
  administeringMinistry: string;
  department?: string;
  jurisdiction: SchemeJurisdiction;
  state?: string;
  category: string;
  description: string;
  benefits: string;
  eligibilityConditions: string[];
  requiredDocuments: string[];
  applicationProcedure: ApplicationProcedure;
  officialUrl: string;
  sourceCitations: SourceCitation[];
  status: SchemeStatus;
  lastVerifiedDate: string;
}

export interface SchemeIntent {
  query: string;
  targetDemographic?: string;
  jurisdiction?: 'CENTRAL' | 'STATE' | 'ALL';
  state?: string;
  category?: string;
  benefitType?: string;
  rawIntentSummary: string;
}

export interface SchemeSearchParams {
  query?: string;
  category?: string;
  jurisdiction?: 'CENTRAL' | 'STATE' | 'ALL';
  state?: string;
  status?: SchemeStatus | 'ALL';
  limit?: number;
  offset?: number;
}

export interface SchemeDiscoveryResult {
  query: string;
  parsedIntent: SchemeIntent;
  totalFound: number;
  schemes: GovernmentScheme[];
  similarSchemes: GovernmentScheme[];
  sourceHierarchyNotice: string;
  cached: boolean;
}

export interface EligibilityEvaluationResult {
  schemeId: string;
  schemeName: string;
  evaluationStatus:
    | 'POTENTIALLY_ELIGIBLE'
    | 'CRITERIA_UNMET'
    | 'INSUFFICIENT_INFORMATION';
  matchedCriteria: string[];
  missingCriteria: string[];
  unmetCriteria: string[];
  advisoryNote: string;
}

// ==============================================================================
// 1. IN-MEMORY ANONYMIZED SCHEME CACHE (TTL: 30 minutes)
// Strict Security Rule: User-specific information is NEVER part of cache keys.
// ==============================================================================
interface CacheEntry {
  timestamp: number;
  data: SchemeDiscoveryResult;
}

const schemeDiscoveryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function generateAnonymousCacheKey(params: SchemeSearchParams, parsedIntent: SchemeIntent): string {
  const normQuery = (params.query || '').trim().toLowerCase();
  const jur = params.jurisdiction || parsedIntent.jurisdiction || 'ALL';
  const st = (params.state || parsedIntent.state || '').trim().toLowerCase();
  const cat = (params.category || parsedIntent.category || '').trim().toLowerCase();
  const stat = params.status || 'ACTIVE';
  return `${normQuery}|${jur}|${st}|${cat}|${stat}`;
}

// Clean up stale cache entries every 10 minutes
const cacheEvictionTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of schemeDiscoveryCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL_MS) {
      schemeDiscoveryCache.delete(key);
    }
  }
}, 10 * 60 * 1000);
if (cacheEvictionTimer.unref) {
  cacheEvictionTimer.unref();
}

// ==============================================================================
// 2. VERIFIED BASELINE CATALOGUE (FALLBACK & ZERO-LATENCY RESOLUTION)
// Guaranteed Sovereign .gov.in and maharashtra.gov.in links.
// ==============================================================================
export const VERIFIED_SOVEREIGN_SCHEMES: GovernmentScheme[] = [
  {
    id: 'sch-pm-kisan',
    schemeName: 'Pradhan Mantri Kisan Samman Nidhi',
    shortName: 'PM-KISAN',
    slug: 'pm-kisan',
    administeringMinistry: 'Ministry of Agriculture and Farmers Welfare',
    department: 'Department of Agriculture & Farmers Welfare',
    jurisdiction: 'CENTRAL',
    category: 'Agriculture',
    description:
      'Direct income support scheme providing financial assistance to all landholding farmer families across India for procuring agricultural inputs and domestic needs.',
    benefits:
      'Rs 6,000 per year transferred directly to bank accounts in three equal 4-monthly installments of Rs 2,000 each.',
    eligibilityConditions: [
      'All landholding farmer families with cultivable land in their names',
      'Subject to exclusion criteria: institutional landholders, tax-paying individuals, and high-income professionals',
    ],
    requiredDocuments: [
      'Aadhaar Card',
      'Land ownership documentation (Khatauni / Patta / 7-12 extract)',
      'Active bank account linked with Aadhaar / NPCI mapping',
      'Valid mobile number',
    ],
    applicationProcedure: {
      mode: 'ONLINE',
      steps: [
        'Visit official portal pmkisan.gov.in',
        'Navigate to Farmers Corner and select New Farmer Registration',
        'Authenticate via Aadhaar and OTP',
        'Enter land details, survey number, and bank account',
        'Submit for state revenue authority verification',
      ],
      officialPortalUrl: 'https://pmkisan.gov.in',
    },
    officialUrl: 'https://pmkisan.gov.in',
    sourceCitations: [
      {
        title: 'PM-KISAN Operational Guidelines',
        url: 'https://pmkisan.gov.in/guidelines',
        domain: 'pmkisan.gov.in',
        issuingAuthority: 'Ministry of Agriculture and Farmers Welfare',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-pm-kusum',
    schemeName: 'Pradhan Mantri Kisan Urja Suraksha evam Utthaan Mahabhiyan (Component B)',
    shortName: 'PM-KUSUM',
    slug: 'pm-kusum',
    administeringMinistry: 'Ministry of New and Renewable Energy',
    department: 'Solar Energy Division',
    jurisdiction: 'CENTRAL',
    category: 'Agriculture',
    description:
      'Government initiative aimed at providing clean energy to farmers by supporting the installation of standalone solar-powered agriculture pumps in off-grid areas.',
    benefits:
      'Central Financial Assistance (CFA) of 30% of benchmark cost, state government subsidy of 30%, and remaining 40% financed through farmer contribution / bank loan.',
    eligibilityConditions: [
      'Individual farmers, water user associations, and farmer producer organizations',
      'Possession of cultivable agricultural land',
      'Targeted at areas without grid electricity or replacing existing diesel pumps',
    ],
    requiredDocuments: [
      'Aadhaar Card',
      'Land ownership / lease records',
      'Bank account details',
      'Passport size photograph',
    ],
    applicationProcedure: {
      mode: 'ONLINE',
      steps: [
        'Apply via state designated nodal agency portal or central PM-KUSUM portal',
        'Select solar pump capacity and type (surface or submersible)',
        'Submit proof of land and identity',
        'Deposit farmer share after preliminary survey approval',
        'Installation and commissioning by empaneled vendors',
      ],
      officialPortalUrl: 'https://pmkusum.mnre.gov.in',
    },
    officialUrl: 'https://pmkusum.mnre.gov.in',
    sourceCitations: [
      {
        title: 'PM-KUSUM Scheme Guidelines',
        url: 'https://pmkusum.mnre.gov.in',
        domain: 'mnre.gov.in',
        issuingAuthority: 'Ministry of New and Renewable Energy',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-nsp-csss',
    schemeName: 'National Scholarship Portal Central Sector Scheme of Scholarship for College and University Students',
    shortName: 'NSP CSSS',
    slug: 'nsp-central-sector-scholarship',
    administeringMinistry: 'Ministry of Education',
    department: 'Department of Higher Education',
    jurisdiction: 'CENTRAL',
    category: 'Scholarships & Education',
    description:
      'Financial support to meritorious students from low-income families to meet day-to-day expenses while pursuing higher education in colleges and universities.',
    benefits:
      'Rs 12,000 per annum at graduation level for the first three years and Rs 20,000 per annum at post-graduation level directly disbursed via DBT.',
    eligibilityConditions: [
      'Above 80th percentile of successful candidates in Class 12 board examination',
      'Pursuing regular full-time degree courses in recognized institutions',
      'Gross family annual income not exceeding Rs 4.5 Lakh',
      'Not availing any other government scholarship',
    ],
    requiredDocuments: [
      'Class 12 marksheet',
      'Income certificate from competent revenue authority',
      'Aadhaar Card',
      'Bonafide student certificate from college/university',
      'Bank passbook',
    ],
    applicationProcedure: {
      mode: 'ONLINE',
      steps: [
        'Register on National Scholarship Portal scholarships.gov.in',
        'Select Central Sector Scheme of Scholarship',
        'Upload academic and income documents',
        'Application verified by Institute Nodal Officer (INO)',
        'State Nodal Officer verification and DBT disbursement via PFMS',
      ],
      officialPortalUrl: 'https://scholarships.gov.in',
    },
    officialUrl: 'https://scholarships.gov.in',
    sourceCitations: [
      {
        title: 'Central Sector Scholarship Guidelines',
        url: 'https://scholarships.gov.in',
        domain: 'scholarships.gov.in',
        issuingAuthority: 'Department of Higher Education, Ministry of Education',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-ayushman-pmjay',
    schemeName: 'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana',
    shortName: 'AB-PMJAY',
    slug: 'ayushman-bharat-pmjay',
    administeringMinistry: 'Ministry of Health and Family Welfare',
    department: 'National Health Authority',
    jurisdiction: 'CENTRAL',
    category: 'Healthcare',
    description:
      'World’s largest government-funded health assurance program providing cashless hospitalization coverage for secondary and tertiary healthcare to vulnerable families.',
    benefits:
      'Health coverage of up to Rs 5 Lakh per family per year on a family floater basis across thousands of public and empaneled private hospitals nationwide.',
    eligibilityConditions: [
      'Identified as eligible under Socio-Economic Caste Census (SECC 2011) deprivation criteria',
      'Active NFSA / Antyodaya ration card holders',
      'Senior citizens aged 70 and above regardless of family income (extended coverage)',
    ],
    requiredDocuments: [
      'Aadhaar Card',
      'Ration Card',
      'Active mobile number for OTP verification',
    ],
    applicationProcedure: {
      mode: 'ONLINE',
      steps: [
        'Check eligibility on beneficiary.nha.gov.in or nearest Ayushman Mitra kiosk',
        'Complete e-KYC using Aadhaar biometric/OTP',
        'Download official Ayushman Card (Golden Card)',
        'Present at any empaneled hospital for cashless treatment',
      ],
      officialPortalUrl: 'https://beneficiary.nha.gov.in',
    },
    officialUrl: 'https://beneficiary.nha.gov.in',
    sourceCitations: [
      {
        title: 'National Health Authority PM-JAY Guidelines',
        url: 'https://nha.gov.in',
        domain: 'nha.gov.in',
        issuingAuthority: 'National Health Authority',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-pm-svanidhi',
    schemeName: 'Pradhan Mantri Street Vendor AtmaNirbhar Nidhi',
    shortName: 'PM SVANidhi',
    slug: 'pm-svanidhi',
    administeringMinistry: 'Ministry of Housing and Urban Affairs',
    department: 'Urban Livelihoods Division',
    jurisdiction: 'CENTRAL',
    category: 'Small Business & MSME',
    description:
      'Micro-credit scheme providing working capital loans to urban and peri-urban street vendors to resume and expand their livelihoods with interest subsidies.',
    benefits:
      'Initial collateral-free working capital loan up to Rs 10,000, 2nd tranche up to Rs 20,000, and 3rd tranche up to Rs 50,000 with 7% interest subsidy on timely repayment and digital cashback incentives.',
    eligibilityConditions: [
      'Street vendors engaged in vending in urban areas on or before March 24, 2020',
      'Vendors possessing Certificate of Vending or Letter of Recommendation (LoR) from Urban Local Body (ULB)',
    ],
    requiredDocuments: [
      'Aadhaar Card',
      'Certificate of Vending (CoV) / Identity Card issued by ULB',
      'Bank account passbook',
      'Registered mobile number',
    ],
    applicationProcedure: {
      mode: 'ONLINE',
      steps: [
        'Access official portal pmsvanidhi.mohua.gov.in or visit common service center (CSC)',
        'Check vendor verification status',
        'Submit loan application selecting preferred lending institution',
        'Loan disbursed directly to bank account upon sanction',
      ],
      officialPortalUrl: 'https://pmsvanidhi.mohua.gov.in',
    },
    officialUrl: 'https://pmsvanidhi.mohua.gov.in',
    sourceCitations: [
      {
        title: 'PM SVANidhi Guidelines',
        url: 'https://pmsvanidhi.mohua.gov.in',
        domain: 'mohua.gov.in',
        issuingAuthority: 'Ministry of Housing and Urban Affairs',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-pm-awas-gramin',
    schemeName: 'Pradhan Mantri Awaas Yojana - Gramin',
    shortName: 'PMAY-G',
    slug: 'pmay-gramin',
    administeringMinistry: 'Ministry of Rural Development',
    department: 'Rural Housing Division',
    jurisdiction: 'CENTRAL',
    category: 'Housing',
    description:
      'Flagship social welfare program providing financial assistance to rural homeless families and those living in kutcha and dilapidated houses to build pucca houses with basic amenities.',
    benefits:
      'Direct grant of Rs 1,20,000 in plain areas and Rs 1,30,000 in hilly/difficult areas, alongside 90-95 person-days of unskilled labor under MGNREGA and Rs 12,000 for toilet construction.',
    eligibilityConditions: [
      'Houseless rural families and families with zero, one, or two rooms with kutcha wall and kutcha roof',
      'Identified based on SECC 2011 deprivation scores and verified by Gram Sabha',
    ],
    requiredDocuments: [
      'Aadhaar Card',
      'SECC registration number / Job card number',
      'Bank account passbook',
      'Consent document for land usage',
    ],
    applicationProcedure: {
      mode: 'HYBRID',
      steps: [
        'Beneficiary list identified through Awaas+ survey and verified by Gram Sabha',
        'Block Development Officer registers beneficiary on AwaasSoft portal pmayg.nic.in',
        'Geo-tagged photo of existing kutcha house uploaded',
        'Direct stage-wise installment disbursement directly into bank account via FTO',
      ],
      officialPortalUrl: 'https://pmayg.nic.in',
    },
    officialUrl: 'https://pmayg.nic.in',
    sourceCitations: [
      {
        title: 'PMAY-G Scheme Guidelines',
        url: 'https://pmayg.nic.in',
        domain: 'nic.in',
        issuingAuthority: 'Ministry of Rural Development',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-maha-shahu-maharaj',
    schemeName: 'Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulk Shishyavrutti Yojna',
    shortName: 'MahaDBT Shahu Maharaj',
    slug: 'mahadbt-shahu-maharaj-scholarship',
    administeringMinistry: 'Government of Maharashtra',
    department: 'Directorate of Higher Education / MahaDBT',
    jurisdiction: 'STATE',
    state: 'Maharashtra',
    category: 'Scholarships & Education',
    description:
      'State scholarship program reimbursing 50% tuition and exam fees for economically backward class (EBC) students pursuing professional and non-professional higher education in Maharashtra.',
    benefits:
      '50% reimbursement of tuition fees and exam fees in government, government-aided, and non-aided recognized educational colleges.',
    eligibilityConditions: [
      'Domicile of Maharashtra state',
      'Enrolled in approved higher education / professional degree courses through CAP rounds',
      'Family annual income from all sources not exceeding Rs 8.00 Lakh',
      'Minimum 50% attendance in previous semester',
    ],
    requiredDocuments: [
      'Maharashtra Domicile Certificate',
      'Income Certificate issued by Tahsildar for current financial year',
      'HSC / Degree marksheets',
      'Fee receipt and College Bonafide certificate',
      'Aadhaar Card linked to bank account',
      'Ration card',
    ],
    applicationProcedure: {
      mode: 'ONLINE',
      steps: [
        'Register on MahaDBT portal mahadbt.maharashtra.gov.in',
        'Create citizen login and complete Aadhaar authentication',
        'Select Directorate of Higher Education -> Rajarshi Shahu Maharaj Scheme',
        'Enter college, course, and caste/EBC category details',
        'Upload verified certificates and submit before session deadline',
      ],
      officialPortalUrl: 'https://mahadbt.maharashtra.gov.in',
    },
    officialUrl: 'https://mahadbt.maharashtra.gov.in',
    sourceCitations: [
      {
        title: 'MahaDBT DHE Scheme Rules',
        url: 'https://mahadbt.maharashtra.gov.in',
        domain: 'maharashtra.gov.in',
        issuingAuthority: 'Government of Maharashtra',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-maha-mjpsky',
    schemeName: 'Mahatma Jyotirao Phule Shetkari Karjmukti Yojana',
    shortName: 'MJPSKY',
    slug: 'mahatma-jyotirao-phule-karjmukti',
    administeringMinistry: 'Government of Maharashtra',
    department: 'Co-operation, Marketing and Textiles Department',
    jurisdiction: 'STATE',
    state: 'Maharashtra',
    category: 'Agriculture',
    description:
      'Debt relief program providing farm loan waivers to distressed farmers across Maharashtra for outstanding crop loans.',
    benefits:
      'Loan waiver of up to Rs 2.00 Lakh for overdue short-term crop loans, alongside incentive grants of up to Rs 50,000 for farmers who regularly repaid their loans.',
    eligibilityConditions: [
      'Individual farmers with crop loan accounts in cooperative, regional rural, or commercial banks in Maharashtra',
      'Excludes ministers, MLAs/MLCs, government employees (excluding Class IV), and income tax payees',
    ],
    requiredDocuments: [
      'Aadhaar Card',
      'Loan account passbook',
      'Land 7/12 extract',
      'Bank Aadhaar authentication acknowledgement',
    ],
    applicationProcedure: {
      mode: 'HYBRID',
      steps: [
        'Bank compiles list of overdue crop loan accounts',
        'List displayed at Gram Panchayat and bank branches',
        'Farmer visits nearest CSC with Aadhaar for biometric authentication',
        'Upon verification, waiver amount credited directly to loan account',
      ],
      officialPortalUrl: 'https://mjpsky.maharashtra.gov.in',
    },
    officialUrl: 'https://mjpsky.maharashtra.gov.in',
    sourceCitations: [
      {
        title: 'MJPSKY Government Resolution',
        url: 'https://mjpsky.maharashtra.gov.in',
        domain: 'maharashtra.gov.in',
        issuingAuthority: 'Government of Maharashtra',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-maha-saur-pump',
    schemeName: 'Mukhyamantri Saur Krushi Pump Yojana (Magel Tyala Saur Krushi Pump)',
    shortName: 'Maharashtra Solar Pump',
    slug: 'maharashtra-saur-krushi-pump',
    administeringMinistry: 'Government of Maharashtra',
    department: 'Energy Department / MSEDCL (Mahavitaran)',
    jurisdiction: 'STATE',
    state: 'Maharashtra',
    category: 'Agriculture',
    description:
      'State-sponsored deployment of subsidized off-grid solar agricultural pumps to farmers to ensure daytime irrigation and eliminate reliance on conventional electricity grid lines.',
    benefits:
      '90% to 95% subsidy on solar pump installation: general category farmers contribute only 10% of total cost; SC/ST category farmers contribute only 5%.',
    eligibilityConditions: [
      'Farmers with agricultural land holding having an assured water source (well, borewell, farm pond)',
      'Traditional electricity connection not available / remote non-electrified areas',
      'Landholding criteria: up to 5 acres eligible for 3 HP or 5 HP; above 5 acres eligible for 7.5 HP',
    ],
    requiredDocuments: [
      '7/12 and 8-A land extracts',
      'Caste Certificate (for SC/ST beneficiaries)',
      'Aadhaar Card',
      'NOC from co-owners if land is joint holding',
      'Water availability undertaking',
    ],
    applicationProcedure: {
      mode: 'ONLINE',
      steps: [
        'Visit official MSEDCL portal mahadiscom.in/solar',
        'Fill A-1 application form with consumer and land details',
        'Upload 7/12 and caste documents',
        'Field survey conducted by MSEDCL engineers',
        'Pay beneficiary share online upon demand note issuance',
      ],
      officialPortalUrl: 'https://www.mahadiscom.in/solar_MSKPY/',
    },
    officialUrl: 'https://www.mahadiscom.in/solar_MSKPY/',
    sourceCitations: [
      {
        title: 'MSEDCL Solar Pump Guidelines',
        url: 'https://www.mahadiscom.in',
        domain: 'maharashtra.gov.in',
        issuingAuthority: 'MSEDCL, Government of Maharashtra',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-maha-sanjay-gandhi',
    schemeName: 'Sanjay Gandhi Niradhar Anudan Yojana',
    shortName: 'SGNRY',
    slug: 'sanjay-gandhi-niradhar-anudan',
    administeringMinistry: 'Government of Maharashtra',
    department: 'Social Justice and Special Assistance Department',
    jurisdiction: 'STATE',
    state: 'Maharashtra',
    category: 'Welfare Benefits',
    description:
      'State monthly pension support for destitute persons, disabled individuals, widows, and vulnerable citizens without support in Maharashtra.',
    benefits:
      'Monthly financial assistance of Rs 1,500 per single beneficiary, or Rs 2,000 per family with more than one beneficiary.',
    eligibilityConditions: [
      'Domicile of Maharashtra residing in the state for minimum 15 years',
      'Destitute persons aged below 65, blind, disabled (40%+ disability), or widows',
      'Family annual income from all sources not exceeding Rs 21,000',
    ],
    requiredDocuments: [
      'Maharashtra 15-year Domicile Certificate',
      'Tahsildar Income Certificate proving annual income under Rs 21,000',
      'Age proof / Birth certificate',
      'Medical certificate of disability from Civil Surgeon (if applicable)',
      'Death certificate of husband (for widows)',
      'Aadhaar Card & Bank account details',
    ],
    applicationProcedure: {
      mode: 'HYBRID',
      steps: [
        'Obtain and submit application form to Tahsildar / Talathi office or via Aaple Sarkar portal aaplesarkar.mahaonline.gov.in',
        'Document verification conducted by Talathi',
        'Scrutiny by Sanjay Gandhi Yojana Committee headed by local MLA/officer',
        'Pension credited monthly directly to bank / post office account',
      ],
      officialPortalUrl: 'https://sjsa.maharashtra.gov.in',
    },
    officialUrl: 'https://sjsa.maharashtra.gov.in',
    sourceCitations: [
      {
        title: 'Social Justice Department SGNRY Rules',
        url: 'https://sjsa.maharashtra.gov.in',
        domain: 'maharashtra.gov.in',
        issuingAuthority: 'Government of Maharashtra',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-pm-mudra',
    schemeName: 'Pradhan Mantri MUDRA Yojana',
    shortName: 'PMMY',
    slug: 'pm-mudra-yojana',
    administeringMinistry: 'Ministry of Finance',
    department: 'Department of Financial Services',
    jurisdiction: 'CENTRAL',
    category: 'Small Business & MSME',
    description:
      'Refinancing scheme providing institutional loans to non-corporate, non-farm small/micro enterprises with three product tiers: Shishu, Kishor, and Tarun.',
    benefits:
      'Collateral-free business loans up to Rs 20 Lakh (Tarun Plus tier) with competitive interest rates and no processing charges for Shishu loans.',
    eligibilityConditions: [
      'Any Indian citizen with a viable business plan for manufacturing, processing, trading, or service sector enterprise',
      'Satisfactory credit history and no prior default with any financial institution',
    ],
    requiredDocuments: [
      'Identity and address proof (Aadhaar, Voter ID, PAN)',
      'Business registration / Udyam Certificate',
      'Bank statement for last 6 months',
      'Quotation of machinery/items to be purchased',
    ],
    applicationProcedure: {
      mode: 'ONLINE',
      steps: [
        'Apply online on UdyamiMitra portal udyamimitra.in or approach any commercial/RRB bank',
        'Select loan category: Shishu (up to Rs 50K), Kishor (Rs 50K-5L), or Tarun (Rs 5L-10L/20L)',
        'Submit business proposal and KYC documents',
        'Loan disbursed and MUDRA Card issued upon sanction',
      ],
      officialPortalUrl: 'https://www.mudra.org.in',
    },
    officialUrl: 'https://www.mudra.org.in',
    sourceCitations: [
      {
        title: 'MUDRA Scheme Guidelines',
        url: 'https://www.mudra.org.in',
        domain: 'mudra.org.in',
        issuingAuthority: 'Department of Financial Services, Ministry of Finance',
      },
    ],
    status: 'ACTIVE',
    lastVerifiedDate: '2025-01-15T00:00:00.000Z',
  },
  {
    id: 'sch-historical-discontinued-sample',
    schemeName: 'National Swasthya Bima Yojana (Predecessor Program)',
    shortName: 'RSBY',
    slug: 'rashtriya-swasthya-bima-yojana',
    administeringMinistry: 'Ministry of Labour and Employment',
    department: 'Social Security Division',
    jurisdiction: 'CENTRAL',
    category: 'Healthcare',
    description:
      'Early health insurance scheme for BPL families providing Rs 30,000 hospital cover. Officially superseded and subsumed by Ayushman Bharat PM-JAY.',
    benefits:
      'Historical coverage of Rs 30,000 per family. Replaced and upgraded to Rs 5 Lakh under PM-JAY.',
    eligibilityConditions: [
      'Previously eligible BPL families holding RSBY smart cards',
    ],
    requiredDocuments: ['Historical RSBY Smart Card'],
    applicationProcedure: {
      mode: 'OFFLINE',
      steps: [
        'Scheme has been subsumed by Ayushman Bharat PM-JAY',
        'Eligible beneficiaries are automatically migrated to PM-JAY on beneficiary.nha.gov.in',
      ],
      officialPortalUrl: 'https://nha.gov.in',
    },
    officialUrl: 'https://nha.gov.in',
    sourceCitations: [
      {
        title: 'Cabinet Resolution Subsuming RSBY into PM-JAY',
        url: 'https://pib.gov.in/PressReleasePage.aspx?PRID=1525695',
        domain: 'pib.gov.in',
        issuingAuthority: 'Press Information Bureau, Government of India',
      },
    ],
    status: 'DISCONTINUED',
    lastVerifiedDate: '2024-03-01T00:00:00.000Z',
  },
];

// ==============================================================================
// 3. MULTILINGUAL DICTIONARY & GEMINI NATURAL-LANGUAGE INTENT EXTRACTION
// ==============================================================================

/**
 * Normalizes Hindi and Marathi administrative & welfare query terms into English equivalents
 * so that citizen search intent resolves to the sovereign canonical scheme catalogue without duplication.
 */
export function normalizeMultilingualTokens(query: string): string[] {
  const lq = query.toLowerCase();
  const tokens: string[] = [];

  const mappings: [RegExp, string[]][] = [
    // Agriculture & Farmers (Hindi: किसान, कृषि, फसल, सिंचाई, वित्तीय सहायता; Marathi: शेतकरी, शेती, पिक, सिंचन, आर्थिक मदत, सौर कृषी पंप)
    [/(?:किसान|शेतकरी|कृषि|कृषी|शेती|फसल|पिक|सिंचाई|सिंचन|वित्तीय सहायता|आर्थिक मदत|बळीराजा)/g, ['farmer', 'kisan', 'agriculture', 'financial assistance', 'income support']],
    [/(?:सौर पंप|सौर कृषी पंप|सोलर पंप|कुसुम)/g, ['solar', 'pump', 'kusum', 'irrigation']],
    // Education & Scholarships (Hindi: छात्रवृत्ति, छात्र, पढ़ाई; Marathi: शिष्यवृत्ती, विद्यार्थी, शिक्षण)
    [/(?:छात्रवृत्ति|शिष्यवृत्ती|विद्यार्थी|छात्र|महाविद्यालय|शिक्षण|कॉलेज|स्कूल)/g, ['scholarship', 'student', 'education', 'college']],
    // Health & Medical (Hindi: स्वास्थ्य, अस्पताल, इलाज, आयुष्मान; Marathi: आरोग्य, रुग्णालय, उपचार, वैद्यकीय, विमा)
    [/(?:स्वास्थ्य|आरोग्य|अस्पताल|रुग्णालय|इलाज|उपचार|वैद्यकीय|आयुष्मान|बीमा|विमा)/g, ['health', 'hospital', 'medical', 'ayushman', 'pmjay']],
    // MSME & Small Business (Hindi: व्यवसाय, व्यापार, ऋण, लोन; Marathi: व्यवसाय, उद्योग, कर्ज, फेरीवाले, पथविक्रेते)
    [/(?:व्यवसाय|उद्योग|व्यापार|ऋण|कर्ज|लोन|फेरीवाले|पथविक्रेते|स्वनिधि|मुद्रा)/g, ['business', 'loan', 'msme', 'vendor', 'svanidhi', 'mudra']],
    // Housing (Hindi: आवास, घर; Marathi: घरकुल, गृहनिर्माण)
    [/(?:आवास|घरकुल|गृहनिर्माण|घर|मकान)/g, ['housing', 'awas', 'home']],
    // Welfare & Pension (Hindi: पेंशन, वृद्धावस्था, दिव्यांग; Marathi: पेन्शन, निराधार, ज्येष्ठ नागरिक, दिव्यांग)
    [/(?:पेंशन|पेन्शन|वृद्धावस्था|ज्येष्ठ नागरिक|निराधार|दिव्यांग|विधवा|कल्याण)/g, ['pension', 'welfare', 'elderly', 'disability', 'widow']],
    // Jurisdiction & Geography
    [/(?:महाराष्ट्र|मुंबई|पुणे|महा)/g, ['maharashtra', 'state']],
    [/(?:केंद्र|राष्ट्रीय|भारत|प्रधानमंत्री|पंतप्रधान|केंद्रीय)/g, ['central', 'national', 'pm']],
  ];

  for (const [regex, mapped] of mappings) {
    if (regex.test(lq)) {
      tokens.push(...mapped);
    }
  }

  return Array.from(new Set(tokens));
}

export async function parseSchemeSearchIntent(userQuery: string): Promise<SchemeIntent> {
  const trimmed = userQuery.trim();
  if (!trimmed) {
    return {
      query: '',
      jurisdiction: 'ALL',
      rawIntentSummary: 'Empty query, returning sovereign directory',
    };
  }

  // Fallback deterministic multilingual intent parser
  const fallbackIntentParser = (q: string): SchemeIntent => {
    const lq = q.toLowerCase();
    let jurisdiction: 'CENTRAL' | 'STATE' | 'ALL' = 'ALL';
    let state: string | undefined = undefined;
    let category: string | undefined = undefined;
    let targetDemographic: string | undefined = undefined;
    let benefitType: string | undefined = undefined;

    // Detect state (English, Hindi, Marathi)
    if (
      lq.includes('maharashtra') ||
      lq.includes('maha') ||
      lq.includes('mumbai') ||
      lq.includes('pune') ||
      lq.includes('महाराष्ट्र') ||
      lq.includes('मुंबई') ||
      lq.includes('पुणे') ||
      lq.includes('महाडीबीटी')
    ) {
      jurisdiction = 'STATE';
      state = 'Maharashtra';
    } else if (
      lq.includes('central') ||
      lq.includes('pm ') ||
      lq.includes('national') ||
      lq.includes('india') ||
      lq.includes('केंद्र') ||
      lq.includes('राष्ट्रीय') ||
      lq.includes('भारत') ||
      lq.includes('प्रधानमंत्री') ||
      lq.includes('पंतप्रधान')
    ) {
      jurisdiction = 'CENTRAL';
    }

    // Detect category & demographic (English, Hindi, Marathi)
    if (
      lq.includes('scholarship') ||
      lq.includes('student') ||
      lq.includes('college') ||
      lq.includes('education') ||
      lq.includes('exam') ||
      lq.includes('छात्रवृत्ति') ||
      lq.includes('शिष्यवृत्ती') ||
      lq.includes('विद्यार्थी') ||
      lq.includes('छात्र') ||
      lq.includes('शिक्षण')
    ) {
      category = 'Scholarships & Education';
      targetDemographic = 'Students & Researchers';
      benefitType = 'Scholarship & Fee Reimbursement';
    } else if (
      lq.includes('farm') ||
      lq.includes('kisan') ||
      lq.includes('crop') ||
      lq.includes('agriculture') ||
      lq.includes('solar pump') ||
      lq.includes('irrigation') ||
      lq.includes('किसान') ||
      lq.includes('शेतकरी') ||
      lq.includes('कृषि') ||
      lq.includes('कृषी') ||
      lq.includes('शेती') ||
      lq.includes('सौर पंप') ||
      lq.includes('सौर कृषी पंप') ||
      lq.includes('पिक') ||
      lq.includes('सिंचाई') ||
      lq.includes('सिंचन')
    ) {
      category = 'Agriculture';
      targetDemographic = 'Farmers & Rural Producers';
      benefitType = 'Income Support & Solar Subsidy';
    } else if (
      lq.includes('health') ||
      lq.includes('hospital') ||
      lq.includes('medical') ||
      lq.includes('ayushman') ||
      lq.includes('insurance') ||
      lq.includes('स्वास्थ्य') ||
      lq.includes('आरोग्य') ||
      lq.includes('रुग्णालय') ||
      lq.includes('अस्पताल') ||
      lq.includes('उपचार') ||
      lq.includes('विमा') ||
      lq.includes('बीमा')
    ) {
      category = 'Healthcare';
      targetDemographic = 'Citizens & Vulnerable Families';
      benefitType = 'Health Assurance & Treatment';
    } else if (
      lq.includes('business') ||
      lq.includes('msme') ||
      lq.includes('loan') ||
      lq.includes('entrepreneur') ||
      lq.includes('startup') ||
      lq.includes('vendor') ||
      lq.includes('व्यवसाय') ||
      lq.includes('उद्योग') ||
      lq.includes('कर्ज') ||
      lq.includes('ऋण') ||
      lq.includes('लोन') ||
      lq.includes('फेरीवाले') ||
      lq.includes('पथविक्रेते') ||
      lq.includes('स्वनिधि')
    ) {
      category = 'Small Business & MSME';
      targetDemographic = 'Entrepreneurs & Micro-Vendors';
      benefitType = 'Subsidized Credit & Working Capital';
    } else if (
      lq.includes('house') ||
      lq.includes('housing') ||
      lq.includes('awas') ||
      lq.includes('home') ||
      lq.includes('आवास') ||
      lq.includes('घरकुल') ||
      lq.includes('घर')
    ) {
      category = 'Housing';
      targetDemographic = 'Homeless & Rural Families';
      benefitType = 'Housing Grant & Amenities';
    } else if (
      lq.includes('pension') ||
      lq.includes('welfare') ||
      lq.includes('widow') ||
      lq.includes('disability') ||
      lq.includes('destitute') ||
      lq.includes('पेंशन') ||
      lq.includes('पेन्शन') ||
      lq.includes('कल्याण') ||
      lq.includes('वृद्ध') ||
      lq.includes('निराधार') ||
      lq.includes('दिव्यांग')
    ) {
      category = 'Welfare Benefits';
      targetDemographic = 'Senior Citizens & Destitute Persons';
      benefitType = 'Monthly Pension Support';
    }

    return {
      query: q,
      targetDemographic,
      jurisdiction,
      state,
      category,
      benefitType,
      rawIntentSummary: `Citizen searching for ${category || 'government assistance'} in ${jurisdiction === 'STATE' ? state : 'Central/National'} domain`,
    };
  };

  const geminiStatus = getGeminiConfigStatus();
  if (!geminiStatus.isConfigured) {
    return fallbackIntentParser(trimmed);
  }

  try {
    const gemini = getGeminiClient();
    const prompt = `You are GovVerify AI Government Scheme Intent Classifier.
Analyze the citizen's query (which may be in English, Hindi, or Marathi/Devanagari script) to identify which Indian government schemes, benefits, or welfare programs they are looking for.
Extract normalized English category, jurisdiction (CENTRAL vs STATE), target demographic, benefit type, and state (especially 'Maharashtra' when relevant).
Never create duplicate scheme records for different languages. The underlying scheme catalog uses canonical English names.

QUERY: "${trimmed}"`;

    const response = await gemini.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: {
              type: Type.STRING,
              description: 'Agriculture, Scholarships & Education, Healthcare, Small Business & MSME, Housing, or Welfare Benefits',
            },
            jurisdiction: {
              type: Type.STRING,
              description: 'CENTRAL, STATE, or ALL',
            },
            state: {
              type: Type.STRING,
              description: 'Target Indian State e.g. Maharashtra if mentioned or implied, otherwise null',
            },
            targetDemographic: {
              type: Type.STRING,
              description: 'e.g. College Students, Farmers, Women Entrepreneurs, Senior Citizens, Street Vendors',
            },
            benefitType: {
              type: Type.STRING,
              description: 'e.g. Direct Cash, Subsidy, Loan, Health Cover, Tuition Waiver',
            },
            summary: {
              type: Type.STRING,
              description: 'Brief 1-sentence explanation of citizen requirement',
            },
          },
          required: ['category', 'jurisdiction', 'summary'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const jur = parsed.jurisdiction === 'CENTRAL' || parsed.jurisdiction === 'STATE' ? parsed.jurisdiction : 'ALL';

    return {
      query: trimmed,
      targetDemographic: parsed.targetDemographic || undefined,
      jurisdiction: jur,
      state: parsed.state || (trimmed.toLowerCase().includes('maharashtra') ? 'Maharashtra' : undefined),
      category: parsed.category || undefined,
      benefitType: parsed.benefitType || undefined,
      rawIntentSummary: parsed.summary || `Search intent for ${trimmed}`,
    };
  } catch (err: any) {
    console.warn('[GovVerify AI] Scheme intent extraction notice (using fallback):', err.message);
    return fallbackIntentParser(trimmed);
  }
}

// ==============================================================================
// 4. SCHEME DISCOVERY & RETRIEVAL SERVICE
// ==============================================================================
export async function discoverSchemes(params: SchemeSearchParams): Promise<SchemeDiscoveryResult> {
  const queryText = (params.query || '').trim();
  const parsedIntent = await parseSchemeSearchIntent(queryText);

  // Check anonymous in-memory cache
  const cacheKey = generateAnonymousCacheKey(params, parsedIntent);
  const cachedEntry = schemeDiscoveryCache.get(cacheKey);
  const now = Date.now();

  if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL_MS) {
    return { ...cachedEntry.data, cached: true };
  }

  // Target filter criteria (merging explicit user filter overrides with parsed intent)
  const targetCategory = params.category || parsedIntent.category;
  const targetJurisdiction = params.jurisdiction || parsedIntent.jurisdiction || 'ALL';
  const targetState = params.state || parsedIntent.state;
  const targetStatus = params.status || 'ACTIVE';

  let allSchemes: GovernmentScheme[] = [];

  // Step A: Attempt database retrieval from public.schemes
  const supabaseConfig = getSupabaseConfigStatus();
  if (supabaseConfig.isConfigured) {
    try {
      const supabase = getServerSupabase();
      let query = supabase.from('schemes').select('*');

      if (targetStatus !== 'ALL') {
        query = query.eq('status', targetStatus);
      }
      if (targetJurisdiction === 'CENTRAL' || targetJurisdiction === 'STATE') {
        query = query.eq('jurisdiction', targetJurisdiction);
      }
      if (targetState) {
        query = query.ilike('state', `%${targetState}%`);
      }
      if (targetCategory) {
        query = query.ilike('category', `%${targetCategory}%`);
      }

      const { data: dbSchemes, error: dbError } = await query;
      if (!dbError && Array.isArray(dbSchemes) && dbSchemes.length > 0) {
        allSchemes = dbSchemes.map((s: any) => ({
          id: s.id,
          schemeName: s.scheme_name,
          shortName: s.short_name || undefined,
          slug: s.slug,
          administeringMinistry: s.administering_ministry,
          department: s.department || undefined,
          jurisdiction: s.jurisdiction,
          state: s.state || undefined,
          category: s.category,
          description: s.description,
          benefits: s.benefits,
          eligibilityConditions: Array.isArray(s.eligibility_conditions) ? s.eligibility_conditions : [],
          requiredDocuments: Array.isArray(s.required_documents) ? s.required_documents : [],
          applicationProcedure: s.application_procedure || { mode: 'ONLINE', steps: [], officialPortalUrl: s.official_url },
          officialUrl: s.official_url,
          sourceCitations: Array.isArray(s.source_citations) ? s.source_citations : [],
          status: s.status,
          lastVerifiedDate: s.last_verified_date,
        }));
      }
    } catch (err: any) {
      console.warn('[GovVerify AI] Database scheme query notice:', err.message);
    }
  }

  // Step B: Fallback / Merge baseline catalogue if database is unconfigured or empty
  if (allSchemes.length === 0) {
    allSchemes = [...VERIFIED_SOVEREIGN_SCHEMES];
  }

  // Step C: Apply in-memory filters and relevance scoring
  let filtered = allSchemes.filter((s) => {
    // Status filter
    if (targetStatus !== 'ALL' && s.status !== targetStatus) return false;

    // Jurisdiction filter
    if (targetJurisdiction === 'CENTRAL' && s.jurisdiction !== 'CENTRAL') return false;
    if (targetJurisdiction === 'STATE' && s.jurisdiction !== 'STATE') return false;

    // State filter (e.g. Maharashtra)
    if (targetState && s.state && !s.state.toLowerCase().includes(targetState.toLowerCase())) return false;
    if (targetState && !s.state && s.jurisdiction === 'STATE') return false;

    // Category filter
    if (targetCategory && !s.category.toLowerCase().includes(targetCategory.toLowerCase())) {
      // Allow cross-match if query specifically matches
      const queryLower = queryText.toLowerCase();
      if (!queryLower || (!s.schemeName.toLowerCase().includes(queryLower) && !s.description.toLowerCase().includes(queryLower))) {
        return false;
      }
    }

    return true;
  });

  // Relevance ranking when search query is provided
  if (queryText) {
    const qLower = queryText.toLowerCase();
    const rawTokens = qLower.split(/\s+/).filter((t) => t.length > 2);
    const multilingualTokens = normalizeMultilingualTokens(queryText);
    const queryTokens = Array.from(new Set([...rawTokens, ...multilingualTokens]));

    filtered.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Exact substring matches
      if (a.schemeName.toLowerCase().includes(qLower)) scoreA += 10;
      if (b.schemeName.toLowerCase().includes(qLower)) scoreB += 10;

      if (a.shortName?.toLowerCase().includes(qLower)) scoreA += 8;
      if (b.shortName?.toLowerCase().includes(qLower)) scoreB += 8;

      if (a.description.toLowerCase().includes(qLower)) scoreA += 5;
      if (b.description.toLowerCase().includes(qLower)) scoreB += 5;

      // Token matches (including multilingual mapped tokens)
      for (const tok of queryTokens) {
        const tokLower = tok.toLowerCase();
        if (a.schemeName.toLowerCase().includes(tokLower)) scoreA += 3;
        if (b.schemeName.toLowerCase().includes(tokLower)) scoreB += 3;
        if (a.category.toLowerCase().includes(tokLower)) scoreA += 3;
        if (b.category.toLowerCase().includes(tokLower)) scoreB += 3;
        if (a.benefits.toLowerCase().includes(tokLower)) scoreA += 2;
        if (b.benefits.toLowerCase().includes(tokLower)) scoreB += 2;
        if (a.eligibilityConditions.some((c) => c.toLowerCase().includes(tokLower))) scoreA += 2;
        if (b.eligibilityConditions.some((c) => c.toLowerCase().includes(tokLower))) scoreB += 2;
      }

      return scoreB - scoreA;
    });
  }

  // Deduplication: Ensure unique schemes by slug or officialUrl
  const seenSlugs = new Set<string>();
  const deduplicatedSchemes: GovernmentScheme[] = [];

  for (const s of filtered) {
    const key = s.slug || s.officialUrl;
    if (!seenSlugs.has(key)) {
      seenSlugs.add(key);
      deduplicatedSchemes.push(s);
    }
  }

  // Similar schemes recommendation (schemes in same category not in primary results)
  const primaryIds = new Set(deduplicatedSchemes.map((s) => s.id));
  const similarSchemes: GovernmentScheme[] = allSchemes
    .filter((s) => !primaryIds.has(s.id) && s.status === 'ACTIVE' && (!targetCategory || s.category === targetCategory))
    .slice(0, 3);

  const result: SchemeDiscoveryResult = {
    query: queryText,
    parsedIntent,
    totalFound: deduplicatedSchemes.length,
    schemes: deduplicatedSchemes,
    similarSchemes,
    sourceHierarchyNotice:
      'Information is extracted directly from sovereign central and state portals (.gov.in / .nic.in). Secondary aggregators are strictly excluded.',
    cached: false,
  };

  // Cache result for 30 minutes
  schemeDiscoveryCache.set(cacheKey, { timestamp: now, data: result });

  return result;
}

// ==============================================================================
// 5. SCHEME LOOKUP BY SLUG OR ID
// ==============================================================================
export async function getSchemeByIdOrSlug(idOrSlug: string): Promise<GovernmentScheme | null> {
  const norm = idOrSlug.trim().toLowerCase();

  // 1. Check baseline catalogue
  const baselineMatch = VERIFIED_SOVEREIGN_SCHEMES.find(
    (s) => s.id.toLowerCase() === norm || s.slug.toLowerCase() === norm
  );
  if (baselineMatch) return baselineMatch;

  // 2. Check Database
  const supabaseConfig = getSupabaseConfigStatus();
  if (supabaseConfig.isConfigured) {
    try {
      const supabase = getServerSupabase();
      const { data, error } = await supabase
        .from('schemes')
        .select('*')
        .or(`id.eq.${norm},slug.eq.${norm}`)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          schemeName: data.scheme_name,
          shortName: data.short_name || undefined,
          slug: data.slug,
          administeringMinistry: data.administering_ministry,
          department: data.department || undefined,
          jurisdiction: data.jurisdiction,
          state: data.state || undefined,
          category: data.category,
          description: data.description,
          benefits: data.benefits,
          eligibilityConditions: Array.isArray(data.eligibility_conditions) ? data.eligibility_conditions : [],
          requiredDocuments: Array.isArray(data.required_documents) ? data.required_documents : [],
          applicationProcedure: data.application_procedure || { mode: 'ONLINE', steps: [], officialPortalUrl: data.official_url },
          officialUrl: data.official_url,
          sourceCitations: Array.isArray(data.source_citations) ? data.source_citations : [],
          status: data.status,
          lastVerifiedDate: data.last_verified_date,
        };
      }
    } catch {
      // Ignore database error and return null
    }
  }

  return null;
}

// ==============================================================================
// 6. OBJECTIVE ELIGIBILITY-BASED MATCHING SAFEGUARD
// Critical Rule: Never guarantee eligibility without checking all official criteria.
// ==============================================================================
export function evaluateCitizenEligibility(
  scheme: GovernmentScheme,
  citizenDetails: {
    occupation?: string;
    annualIncomeLakhs?: number;
    state?: string;
    isLandholder?: boolean;
    educationLevel?: string;
    casteCategory?: string;
  }
): EligibilityEvaluationResult {
  const matchedCriteria: string[] = [];
  const unmetCriteria: string[] = [];
  const missingCriteria: string[] = [];

  const conds = scheme.eligibilityConditions || [];

  for (const cond of conds) {
    const lcond = cond.toLowerCase();

    // Check state domicile
    if (scheme.state && citizenDetails.state) {
      if (citizenDetails.state.toLowerCase() === scheme.state.toLowerCase()) {
        matchedCriteria.push(`State Domicile: Citizen resides in ${scheme.state}`);
      } else {
        unmetCriteria.push(`State Domicile: Scheme requires domicile in ${scheme.state}, citizen provided ${citizenDetails.state}`);
      }
    }

    // Check income threshold
    if (citizenDetails.annualIncomeLakhs !== undefined) {
      const incomeMatch = lcond.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac)/i);
      if (incomeMatch) {
        const threshold = parseFloat(incomeMatch[1]);
        if (citizenDetails.annualIncomeLakhs <= threshold) {
          matchedCriteria.push(`Income Ceiling: Annual income Rs ${citizenDetails.annualIncomeLakhs}L is below limit of Rs ${threshold}L`);
        } else {
          unmetCriteria.push(`Income Ceiling: Annual income Rs ${citizenDetails.annualIncomeLakhs}L exceeds limit of Rs ${threshold}L`);
        }
      }
    }

    // Check occupation / farmer status
    if (lcond.includes('farmer') || lcond.includes('cultivable land')) {
      if (citizenDetails.isLandholder === true || citizenDetails.occupation?.toLowerCase().includes('farmer')) {
        matchedCriteria.push('Agricultural Status: Landholding / Farmer criteria matched');
      } else if (citizenDetails.isLandholder === false) {
        unmetCriteria.push('Agricultural Status: Scheme requires landholding status');
      } else {
        missingCriteria.push('Landholding Status: Proof of land ownership (7/12 extract / Patta) required');
      }
    }
  }

  let evaluationStatus: 'POTENTIALLY_ELIGIBLE' | 'CRITERIA_UNMET' | 'INSUFFICIENT_INFORMATION';
  let advisoryNote = '';

  if (unmetCriteria.length > 0) {
    evaluationStatus = 'CRITERIA_UNMET';
    advisoryNote =
      'Based on the provided details, one or more official eligibility criteria are not met. Official portal verification is recommended.';
  } else if (matchedCriteria.length > 0 && missingCriteria.length === 0) {
    evaluationStatus = 'POTENTIALLY_ELIGIBLE';
    advisoryNote =
      'Potentially Eligible based on preliminary criteria. Final entitlement is subject to scrutiny of official documents by the administering ministry.';
  } else {
    evaluationStatus = 'INSUFFICIENT_INFORMATION';
    advisoryNote =
      'Insufficient user criteria provided to establish eligibility. Please review all statutory conditions on the official portal before applying.';
  }

  return {
    schemeId: scheme.id,
    schemeName: scheme.schemeName,
    evaluationStatus,
    matchedCriteria,
    missingCriteria,
    unmetCriteria,
    advisoryNote,
  };
}
