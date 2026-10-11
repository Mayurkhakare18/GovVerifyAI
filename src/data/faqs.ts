import { FaqItem } from '../types';

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-what-is',
    category: 'general',
    question: 'What is GovVerify AI?',
    answer:
      'GovVerify AI is an independent civic technology platform engineered to help Indian citizens cross-reference claims about government welfare schemes, scholarships, direct benefit transfers, and public policies against authoritative sovereign records. It operates as an analytical research instrument, decomposing complex claims into verifiable clauses and transparently citing official gazettes and notifications.',
  },
  {
    id: 'faq-how-it-works',
    category: 'general',
    question: 'How does claim verification work?',
    answer:
      'The planned verification pipeline deconstructs a submitted claim into atomic factual assertions (such as benefit amounts, eligibility thresholds, or effective dates). It then searches sovereign government repositories (.gov.in / .nic.in and egazette.gov.in), matches assertions against statutory text, and produces an explainable finding (Supported, Partially Supported, Contradicted, or Insufficient Evidence) with explicit clause references.',
  },
  {
    id: 'faq-sources',
    category: 'sources',
    question: 'Which sources will the platform use?',
    answer:
      'GovVerify AI restricts its evidentiary retrieval exclusively to authoritative sovereign channels: The Gazette of India (egazette.gov.in), the Press Information Bureau (pib.gov.in), central and state ministry portals ending in .gov.in and .nic.in, statutory bodies (e.g., UIDAI, UGC, NHA, RBI), and official repositories like myscheme.gov.in. Third-party blogs, unverified social media handles, and speculative forums are strictly excluded.',
  },
  {
    id: 'faq-document-upload',
    category: 'technical',
    question: 'Can I upload a government document?',
    answer:
      'Yes. In the verification console, you can select official circulars, Office Memorandums (OM), or gazette notifications in PDF format (up to 10 MB). In this Phase 1 foundation, the console performs client-side format and size checks. In Phase 2, a server-side extraction and OCR pipeline will parse bilingual text to match against official archives without uploading personal or private identification records.',
  },
  {
    id: 'faq-insufficient-evidence',
    category: 'general',
    question: 'What does insufficient evidence mean?',
    answer:
      'An INSUFFICIENT_EVIDENCE finding occurs when no authoritative gazette, ministry circular, or official government repository addresses the assertion. Unlike generative chat systems that attempt to guess or hallucinate an answer, GovVerify AI practices epistemic transparency: if official records do not confirm or refute a statement, the system explicitly states that evidence is insufficient.',
  },
  {
    id: 'faq-guarantee',
    category: 'general',
    question: 'Does a verification result guarantee that a claim is true?',
    answer:
      'No verification system can provide an absolute guarantee of real-world administrative eligibility. Verification results reflect the state of available official evidence at the time of retrieval. Final administrative decisions, beneficiary enrollments, and legal disbursements rest exclusively with the respective sovereign ministries and state departments. Citizens are always directed to verify personal matters with official .gov.in portals.',
  },
];
