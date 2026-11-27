/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Verified Sovereign Scheme Offline Baseline Catalog
 * Provides zero-crash offline resilience for citizen discovery
 * when backend connectivity or edge proxy lambdas are initializing.
 */

import { SchemeItem } from '../services/api/schemes';

export const FALLBACK_SOVEREIGN_SCHEMES: SchemeItem[] = [
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
