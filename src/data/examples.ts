import { ExampleClaim } from '../types';

export const EXAMPLE_CLAIMS: ExampleClaim[] = [
  {
    id: 'pm-kisan-amount',
    category: 'Government Scheme Payments',
    title: 'PM-KISAN Installment Amount Revision',
    claimText:
      'PM-KISAN annual financial support has been revised from ₹6,000 to ₹12,000 per year, with each four-month installment now increased to ₹4,000 for small and marginal farmers starting this financial year.',
    targetMinistry: 'Ministry of Agriculture & Farmers Welfare',
    whyPeopleAsk: 'Frequently forwarded on messaging groups regarding supposed installment hikes.',
    iconName: 'Coins',
  },
  {
    id: 'nmmss-scholarship',
    category: 'Scholarship Eligibility',
    title: 'NMMSS National Scholarship Income Ceiling',
    claimText:
      'Under the National Means-cum-Merit Scholarship Scheme (NMMSS), students studying in class 9 in government schools are eligible only if parental annual income does not exceed ₹3,50,000 from all sources.',
    targetMinistry: 'Ministry of Education (Department of School Education & Literacy)',
    whyPeopleAsk: 'Parents and students seek clarity on parental income threshold criteria.',
    iconName: 'GraduationCap',
  },
  {
    id: 'pmay-g-housing',
    category: 'Housing Benefits',
    title: 'PMAY-G Financial Assistance for Plain Areas',
    claimText:
      'Pradhan Mantri Awas Yojana - Gramin (PMAY-G) provides ₹2,50,000 as direct non-repayable cash assistance to eligible rural households in plain areas for the construction of pucca houses.',
    targetMinistry: 'Ministry of Rural Development',
    whyPeopleAsk: 'Circulating claims often confuse state subsidies with central base unit assistance.',
    iconName: 'Home',
  },
  {
    id: 'ayushman-bharat-senior',
    category: 'Health Benefit Coverage',
    title: 'Ayushman Bharat Senior Citizen (70+) Coverage',
    claimText:
      'All senior citizens aged 70 years and above are now eligible for health cover up to ₹5 lakh per year under Ayushman Bharat PM-JAY, regardless of their family socioeconomic or income status.',
    targetMinistry: 'Ministry of Health & Family Welfare / NHA',
    whyPeopleAsk: 'Widespread public interest in recent policy announcements regarding universal senior health coverage.',
    iconName: 'HeartPulse',
  },
];
