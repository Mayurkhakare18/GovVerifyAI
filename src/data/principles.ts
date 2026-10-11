import { VerificationPrinciple } from '../types';

export const VERIFICATION_PRINCIPLES: VerificationPrinciple[] = [
  {
    id: 'authoritative-sources',
    title: 'Prioritize Authoritative Government Sources',
    description:
      'Information is cross-referenced strictly against primary government gazettes (egazette.gov.in), ministry notifications (.gov.in / .nic.in), statutory guidelines, and official Press Information Bureau (PIB) releases — never third-party opinion blogs or unverified social media handles.',
    impact: 'Ensures verification is anchored in sovereign, legally enacted public records.',
    iconName: 'Building2',
  },
  {
    id: 'evidence-vs-relevance',
    title: 'Distinguish Evidence Relevance from Actual Claim Support',
    description:
      'A government document mentioning a scheme does not automatically prove a specific viral claim true. The system rigorously differentiates between topical relevance (a circular discussing PM-KISAN) and actual evidentiary support (a clause corroborating the exact numerical assertion).',
    impact: 'Prevents misleading "partially matching" citations from creating false credibility.',
    iconName: 'FileCheck',
  },
  {
    id: 'source-citations',
    title: 'Provide Source References, Pages, and Clause Details',
    description:
      'Every verification result must be accompanied by the exact official URL, circular reference number, notification date, and paragraph or clause where the fact is established, allowing citizens and journalists to audit the source directly.',
    impact: 'Empowers citizens to inspect primary documents independently.',
    iconName: 'BookmarkCheck',
  },
  {
    id: 'granular-breakdown',
    title: 'Explain Which Specific Parts Are Supported or Contradicted',
    description:
      'Viral misinformation often combines true facts with misleading numbers. The platform decomposes claims into atomic propositions (eligibility, amount, application deadline) and evaluates each sub-clause individually.',
    impact: 'Eliminates confusion when a circular has a grain of truth wrapped in exaggeration.',
    iconName: 'SplitSquareVertical',
  },
  {
    id: 'insufficient-evidence-honesty',
    title: 'State When Evidence Is Insufficient',
    description:
      'If official records have not yet published a notification or if gazettes do not corroborate an unverified rumor, the platform returns an explicit INSUFFICIENT_EVIDENCE verdict rather than guessing or fabricating conclusions.',
    impact: 'Avoids hallucination and upholds institutional integrity.',
    iconName: 'AlertCircle',
  },
  {
    id: 'no-fabrication-policy',
    title: 'Never Fabricate Citations or Present AI as Official Findings',
    description:
      'GovVerify AI does not generate synthetic quotes or claim sovereign authority. AI models serve solely as analytical comparison engines over real, retrieved government documents. The platform is transparent about its civic advisory role.',
    impact: 'Prevents synthetic hallucinations from masquerading as government decisions.',
    iconName: 'ShieldAlert',
  },
];
