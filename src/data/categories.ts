import { SchemeCategory } from '../types';

export const SCHEME_CATEGORIES: SchemeCategory[] = [
  {
    id: 'government-schemes',
    name: 'Government Schemes',
    description:
      'Flagship central and state welfare programs, direct benefit transfers (DBT), infrastructure incentives, and citizen entitlements.',
    commonExamples: ['PM-KISAN', 'PM Awas Yojana', 'Jal Jeevan Mission', 'Ujjwala Yojana'],
    primarySources: ['myscheme.gov.in', 'dbtbharat.gov.in', 'Individual Ministry Portals'],
    iconName: 'Landmark',
  },
  {
    id: 'scholarships',
    name: 'Scholarships & Education',
    description:
      'National and state scholarship portals, merit-cum-means awards, fellowship quotas, education loan subsidies, and exam guidelines.',
    commonExamples: ['NSP (National Scholarship Portal)', 'NMMSS', 'Post-Matric Scholarships', 'PM-USPY'],
    primarySources: ['scholarships.gov.in', 'education.gov.in', 'ugc.gov.in'],
    iconName: 'GraduationCap',
  },
  {
    id: 'welfare-benefits',
    name: 'Welfare Benefits',
    description:
      'Pension transfers, healthcare subsidies, food rations, disability allowances, and maternity assistance programs.',
    commonExamples: ['Ayushman Bharat PM-JAY', 'PM Matru Vandana Yojana', 'IGNOAPS Senior Pension', 'NFSA Ration'],
    primarySources: ['nha.gov.in', 'wcd.nic.in', 'dfpd.gov.in'],
    iconName: 'HeartHandshake',
  },
  {
    id: 'policies-guidelines',
    name: 'Policies & Guidelines',
    description:
      'Regulatory frameworks, taxation rules, telecom circulars, reservation rosters, and central civil service statutory guidelines.',
    commonExamples: ['National Education Policy (NEP)', 'GST Notifications', 'TRAI Regulations', 'DoPT Circulars'],
    primarySources: ['egazette.gov.in', 'dopt.gov.in', 'cbic.gov.in'],
    iconName: 'ScrollText',
  },
  {
    id: 'official-announcements',
    name: 'Official Announcements',
    description:
      'Cabinet decisions, recruitment notices, public holiday declarations, disaster management advisories, and PIB press statements.',
    commonExamples: ['PIB Fact Checks', 'UPSC / SSC Examination Notices', 'Cabinet Committee on Economic Affairs (CCEA)'],
    primarySources: ['pib.gov.in', 'upsc.gov.in', 'ssc.gov.in'],
    iconName: 'Megaphone',
  },
  {
    id: 'government-documents',
    name: 'Government Documents',
    description:
      'Procedures for official citizen identity and documentation including Aadhaar, PAN, voter cards, passports, and land records.',
    commonExamples: ['UIDAI Aadhaar Guidelines', 'PAN-Aadhaar Linking Circulars', 'Passport Seva Directives', 'Digital Land Records'],
    primarySources: ['uidai.gov.in', 'incometax.gov.in', 'passportindia.gov.in'],
    iconName: 'FileCheck2',
  },
];
