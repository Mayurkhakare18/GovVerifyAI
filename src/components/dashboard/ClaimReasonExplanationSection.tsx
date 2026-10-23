/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Claim Reason Explanation Component
 * Answers the user's central question: "Why is this claim correct or wrong?"
 * 
 * Verdict-specific headings:
 * - SUPPORTED: "Why this claim is correct"
 * - CONTRADICTED: "Why this claim is wrong"
 * - PARTIALLY_SUPPORTED: "What is correct and what is wrong"
 * - INSUFFICIENT_EVIDENCE: "Why we cannot verify this claim yet"
 * 
 * Features:
 * - Direct plain-language answer addressing the core claim.
 * - Factual assertion-by-assertion audit breakdown.
 * - Visual distinction between direct official source quotes and AI analysis.
 * - Clickable links to sovereign .gov.in sources with publishing authority.
 * - Honest non-falsity integrity notice for missing/insufficient evidence.
 */

import React from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ExternalLink,
  Quote,
  ShieldCheck,
  AlertCircle,
  Info,
  Building2,
  FileText,
  Sparkles,
} from 'lucide-react';
import { ClaimReasonExplanation, ReasonAssertionDetail, ReasonAssertionStatus } from '../../services/api/types';

export interface ClaimReasonExplanationSectionProps {
  verdict: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'CONTRADICTED' | 'INSUFFICIENT_EVIDENCE' | string;
  originalClaim: string;
  explanation?: ClaimReasonExplanation;
  subclaims?: Array<{
    statement: string;
    verdict?: string;
    explanation?: string;
    supportingEvidenceIds?: string[];
    contradictingEvidenceIds?: string[];
  }>;
  evidence?: Array<{
    id: string;
    extractedText: string;
    sourceTitle: string;
    sourceUrl: string;
    domain: string;
    issuingAuthority?: string;
    publicationDate?: string;
    relationship?: string;
    sourceType?: string;
  }>;
  citations?: Array<{
    id: string;
    sourceTitle: string;
    sourceUrl: string;
    officialPublisher: string;
    relevantExcerpt: string;
    relationship?: string;
  }>;
  limitation?: string;
}

/**
 * Fallback synthesizer in case the parent doesn't supply a precomputed ClaimReasonExplanation
 */
function deriveFallbackExplanation(props: ClaimReasonExplanationSectionProps): ClaimReasonExplanation {
  const { verdict, originalClaim, subclaims = [], evidence = [], citations = [], limitation } = props;

  // Determine Heading
  let verdictHeading = 'Why we cannot verify this claim yet';
  if (verdict === 'SUPPORTED') {
    verdictHeading = 'Why this claim is correct';
  } else if (verdict === 'CONTRADICTED') {
    verdictHeading = 'Why this claim is wrong';
  } else if (verdict === 'PARTIALLY_SUPPORTED') {
    verdictHeading = 'What is correct and what is wrong';
  }

  // Direct Answer
  let directAnswer = '';
  if (verdict === 'SUPPORTED') {
    directAnswer =
      'This claim is correct. Official government documentation confirms every tested factual statement in this claim. Sovereign records verify the described benefits, amounts, and program provisions.';
  } else if (verdict === 'CONTRADICTED') {
    directAnswer =
      'This claim is wrong. Official government records, ministry notifications, or official fact checks directly refute key statements in this claim. Verified sovereign sources establish facts that conflict with what is claimed.';
  } else if (verdict === 'PARTIALLY_SUPPORTED') {
    directAnswer =
      'This claim is partially correct and partially incorrect or unverified. Official government records confirm certain elements of the statement, while other key propositions are contradicted by official notices or lack official documentation.';
  } else {
    directAnswer =
      'We cannot verify or disprove this claim because no authoritative government circulars, gazettes, or official notices confirming or refuting these specific assertions were retrieved from sovereign repositories.';
  }

  // Build Assertions
  const assertions: ReasonAssertionDetail[] = [];
  const items = subclaims.length > 0 ? subclaims : [{ statement: originalClaim, verdict, explanation: '' }];

  for (const item of items) {
    const itemVerdict = item.verdict || verdict;
    let status: ReasonAssertionStatus = 'NOT_ESTABLISHED';
    let explanationText = item.explanation || '';
    let officialFactInstead: string | undefined = undefined;
    let sourceQuote: string | undefined = undefined;
    let sourceCitationId: string | undefined = undefined;
    let sourceTitle: string | undefined = undefined;
    let sourceUrl: string | undefined = undefined;
    let officialPublisher: string | undefined = undefined;

    if (itemVerdict === 'SUPPORTED') {
      status = 'SUPPORTED';
      const ev = evidence.find((e) => e.relationship === 'SUPPORTS') || evidence[0];
      const cite = citations.find((c) => c.relationship === 'SUPPORTS') || citations[0];
      sourceQuote = ev?.extractedText || cite?.relevantExcerpt;
      sourceCitationId = cite?.id || ev?.id;
      sourceTitle = cite?.sourceTitle || ev?.sourceTitle || 'Official Government Notification';
      sourceUrl = cite?.sourceUrl || ev?.sourceUrl || '';
      officialPublisher = cite?.officialPublisher || ev?.issuingAuthority || ev?.domain || 'Government Authority';

      if (!explanationText) {
        explanationText = 'Confirmed by official records. Published notifications and administrative rules establish that this statement is accurate and documented on official sovereign portals.';
      }
    } else if (itemVerdict === 'CONTRADICTED') {
      status = 'CONTRADICTED';
      const ev = evidence.find((e) => e.relationship === 'CONTRADICTS' || e.relationship === 'REFUTES') || evidence[0];
      const cite = citations.find((c) => c.relationship === 'CONTRADICTS') || citations[0];
      sourceQuote = ev?.extractedText || cite?.relevantExcerpt;
      sourceCitationId = cite?.id || ev?.id;
      sourceTitle = cite?.sourceTitle || ev?.sourceTitle || 'Official Government Clarification';
      sourceUrl = cite?.sourceUrl || ev?.sourceUrl || '';
      officialPublisher = cite?.officialPublisher || ev?.issuingAuthority || ev?.domain || 'Official Authority';

      const quoteLower = (sourceQuote || '').toLowerCase();
      if (
        quoteLower.includes('fact check') ||
        quoteLower.includes('fake') ||
        quoteLower.includes('no such') ||
        quoteLower.includes('fraudulent') ||
        quoteLower.includes('misleading')
      ) {
        officialFactInstead = 'Official government clarification confirms that no such decision, notification, or scheme has been approved or announced.';
      } else if (sourceQuote) {
        officialFactInstead = `Official records establish: "${sourceQuote.slice(0, 160).trim()}..."`;
      } else {
        officialFactInstead = 'Official government records establish rules that conflict with this statement.';
      }

      if (!explanationText) {
        explanationText = 'Directly contradicted by official records. While the claim asserts this statement, verified sovereign sources document conflicting provisions.';
      }
    } else {
      status = 'NOT_ESTABLISHED';
      if (!explanationText) {
        explanationText = 'No authoritative government circular or notification was retrieved that confirms or refutes this proposition. Under GovVerify AI verification integrity safeguards, the absence of retrieved official documentation is never treated as proof that a statement is false.';
      }
    }

    assertions.push({
      assertion: item.statement,
      status,
      explanation: explanationText,
      officialFactInstead,
      sourceQuote,
      sourceCitationId,
      sourceTitle,
      sourceUrl,
      officialPublisher,
    });
  }

  // Conditions or limitations
  let conditionsOrLimitations: string[] | undefined = undefined;
  if (verdict === 'SUPPORTED' || verdict === 'PARTIALLY_SUPPORTED') {
    conditionsOrLimitations = [
      'Entitlement is subject to statutory eligibility criteria (such as valid landholding records, mandatory e-KYC verification, and Aadhaar-seeded active bank accounts).',
      'Applications and benefit disbursements are processed exclusively through authorized government portals.',
    ];
  }

  // Missing evidence reason
  let missingEvidenceReason: string | undefined = undefined;
  if (verdict === 'INSUFFICIENT_EVIDENCE' || assertions.some((a) => a.status === 'NOT_ESTABLISHED')) {
    missingEvidenceReason =
      limitation ||
      'No primary government circulars (.gov.in, .nic.in, or PIB notifications) addressing this specific claim were found in sovereign repositories. Retrieved candidate sources either discuss general policy topics or do not provide authoritative confirmation.';
  }

  // Insufficient evidence notice
  let insufficientEvidenceNotice: string | undefined = undefined;
  if (verdict === 'INSUFFICIENT_EVIDENCE' || assertions.some((a) => a.status === 'NOT_ESTABLISHED')) {
    insufficientEvidenceNotice =
      'Important Integrity Notice: Insufficient official evidence does not prove that this claim is false. It means GovVerify AI could not find verified government records to validate or disprove it.';
  }

  return {
    verdictHeading,
    directAnswer,
    assertions,
    conditionsOrLimitations,
    missingEvidenceReason,
    insufficientEvidenceNotice,
  };
}

export const ClaimReasonExplanationSection: React.FC<ClaimReasonExplanationSectionProps> = (props) => {
  const { verdict, explanation } = props;

  // Use provided explanation or derive fallback
  const data = explanation && explanation.directAnswer ? explanation : deriveFallbackExplanation(props);

  const isSupported = verdict === 'SUPPORTED';
  const isContradicted = verdict === 'CONTRADICTED';
  const isPartiallySupported = verdict === 'PARTIALLY_SUPPORTED';
  const isInsufficient = verdict === 'INSUFFICIENT_EVIDENCE';

  // Badge styling matching verdict
  const verdictTheme = isSupported
    ? {
        badgeBg: 'bg-[#EBFDF2]',
        badgeBorder: 'border-[#ABEFC6]',
        badgeText: 'text-[#0B7A48]',
        accentBorder: 'border-[#0B7A48]',
        bannerBg: 'bg-gradient-to-r from-[#EBFDF2] to-white',
        Icon: CheckCircle2,
      }
    : isContradicted
    ? {
        badgeBg: 'bg-[#FEF3F2]',
        badgeBorder: 'border-[#FECDCA]',
        badgeText: 'text-[#B42318]',
        accentBorder: 'border-[#B42318]',
        bannerBg: 'bg-gradient-to-r from-[#FEF3F2] to-white',
        Icon: XCircle,
      }
    : isPartiallySupported
    ? {
        badgeBg: 'bg-[#FEF7C3]',
        badgeBorder: 'border-[#FEDF89]',
        badgeText: 'text-[#B54708]',
        accentBorder: 'border-[#B54708]',
        bannerBg: 'bg-gradient-to-r from-[#FEF7C3] to-white',
        Icon: AlertTriangle,
      }
    : {
        badgeBg: 'bg-[#F2F4F7]',
        badgeBorder: 'border-[#D0D5DD]',
        badgeText: 'text-[#344054]',
        accentBorder: 'border-[#344054]',
        bannerBg: 'bg-gradient-to-r from-[#F2F4F7] to-white',
        Icon: HelpCircle,
      };

  return (
    <section
      aria-labelledby="claim-reason-section-title"
      data-testid="claim-reason-explanation-section"
      className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs overflow-hidden space-y-0"
    >
      {/* ==================================================================== */}
      {/* 1. SECTION HEADER: "Why Is This Claim Correct or Wrong?"            */}
      {/* ==================================================================== */}
      <div className={`p-5 sm:p-6 border-b border-[#E1E7EF] ${verdictTheme.bannerBg} space-y-2.5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#2457C5] shrink-0" />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#526176]">
              Citizen Verification Audit
            </span>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs ${verdictTheme.badgeBg} ${verdictTheme.badgeBorder} ${verdictTheme.badgeText}`}
            data-testid="verdict-heading-badge"
          >
            <verdictTheme.Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{data.verdictHeading}</span>
          </span>
        </div>

        <h3
          id="claim-reason-section-title"
          className="text-lg sm:text-xl font-black text-[#172B4D] tracking-tight flex items-center gap-2"
        >
          <span>Why Is This Claim Correct or Wrong?</span>
        </h3>

        {/* Direct Plain-Language Answer */}
        <div
          data-testid="claim-reason-direct-answer"
          className="p-4 rounded-xl bg-white/90 border border-[#E1E7EF] shadow-2xs text-sm font-medium text-[#172B4D] leading-relaxed"
        >
          <strong className="font-bold text-[#172B4D] block text-xs uppercase tracking-wide text-[#526176] mb-1">
            Direct Answer
          </strong>
          <p>{data.directAnswer}</p>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* ==================================================================== */}
        {/* 2. FACTUAL ASSERTIONS BREAKDOWN                                     */}
        {/* ==================================================================== */}
        <div className="space-y-3.5">
          <div className="flex items-center justify-between border-b border-[#E1E7EF] pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#526176] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#2457C5]" />
              <span>
                Factual Assertions Breakdown ({data.assertions.length})
              </span>
            </h4>
            <span className="text-[11px] text-[#526176]">
              Audited against sovereign records
            </span>
          </div>

          <div className="space-y-4">
            {data.assertions.map((assertion, idx) => {
              const isAssertionSupported = assertion.status === 'SUPPORTED';
              const isAssertionContradicted = assertion.status === 'CONTRADICTED';
              const isAssertionNotEstablished = assertion.status === 'NOT_ESTABLISHED';

              const statusBadge = isAssertionSupported
                ? {
                    label: 'Confirmed by Official Record',
                    bg: 'bg-[#EBFDF2]',
                    border: 'border-[#ABEFC6]',
                    text: 'text-[#0B7A48]',
                    Icon: CheckCircle2,
                  }
                : isAssertionContradicted
                ? {
                    label: 'Contradicted by Official Record',
                    bg: 'bg-[#FEF3F2]',
                    border: 'border-[#FECDCA]',
                    text: 'text-[#B42318]',
                    Icon: XCircle,
                  }
                : {
                    label: 'Not Established in Official Evidence',
                    bg: 'bg-[#F2F4F7]',
                    border: 'border-[#D0D5DD]',
                    text: 'text-[#475467]',
                    Icon: AlertCircle,
                  };

              return (
                <div
                  key={idx}
                  data-testid={`factual-assertion-${idx}`}
                  className="p-4 sm:p-5 rounded-xl border border-[#E1E7EF] bg-[#F8FAFC]/50 hover:bg-white hover:border-[#CBD5E1] transition-all shadow-2xs space-y-3.5"
                >
                  {/* Assertion Statement & Status Pill */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="space-y-1 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#526176]">
                        Assertion {idx + 1}
                      </span>
                      <p className="text-sm sm:text-base font-bold text-[#172B4D] leading-snug">
                        "{assertion.assertion}"
                      </p>
                    </div>

                    <span
                      data-testid={`assertion-status-${assertion.status}`}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border self-start shrink-0 ${statusBadge.bg} ${statusBadge.border} ${statusBadge.text}`}
                    >
                      <statusBadge.Icon className="w-3.5 h-3.5" />
                      <span>{statusBadge.label}</span>
                    </span>
                  </div>

                  {/* For Contradicted: What the official evidence says instead */}
                  {isAssertionContradicted && assertion.officialFactInstead && (
                    <div
                      data-testid="official-fact-instead-callout"
                      className="p-3.5 rounded-lg bg-[#FEF3F2] border border-[#FECDCA] text-xs space-y-1"
                    >
                      <div className="flex items-center gap-1.5 font-bold text-[#B42318]">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>What the official evidence says instead:</span>
                      </div>
                      <p className="text-[#172B4D] font-medium leading-relaxed pl-5">
                        {assertion.officialFactInstead}
                      </p>
                    </div>
                  )}

                  {/* AI Explanation of the Finding */}
                  <div className="text-xs text-[#172B4D] leading-relaxed space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#526176] block">
                      Analysis & Reason:
                    </span>
                    <p className="font-normal text-[#334155]">{assertion.explanation}</p>
                  </div>

                  {/* Visually Distinguished Direct Source Quotation */}
                  {assertion.sourceQuote && (
                    <div
                      data-testid="direct-source-quotation-block"
                      className="p-3.5 rounded-lg bg-[#F1F5F9] border-l-4 border-[#2457C5] border-y border-r border-[#E2E8F0] space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#2457C5]">
                          <Quote className="w-3 h-3" />
                          <span>Direct Sovereign Source Quotation</span>
                        </span>

                        {assertion.officialPublisher && (
                          <span className="text-[10px] font-medium text-[#526176] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                            {assertion.officialPublisher}
                          </span>
                        )}
                      </div>

                      <blockquote className="text-xs italic text-[#0F172A] leading-relaxed font-serif pl-1">
                        "{assertion.sourceQuote}"
                      </blockquote>

                      {/* Authoritative Source Link */}
                      {assertion.sourceUrl && (
                        <div className="pt-1 flex items-center justify-between gap-2 border-t border-[#E2E8F0]/80">
                          <span className="text-[11px] font-medium text-[#475467] truncate">
                            {assertion.sourceTitle || 'Sovereign Portal Record'}
                          </span>
                          <a
                            href={assertion.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2457C5] hover:text-[#1D46A6] hover:underline shrink-0"
                            title={`Open official source at ${assertion.sourceUrl}`}
                          >
                            <span>Verify Source</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* 3. RELEVANT CONDITIONS OR LIMITATIONS                               */}
        {/* ==================================================================== */}
        {data.conditionsOrLimitations && data.conditionsOrLimitations.length > 0 && (
          <div
            data-testid="claim-conditions-limitations"
            className="p-4 rounded-xl bg-[#F0F4F9] border border-[#E1E7EF] space-y-2"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-[#2457C5]">
              <Info className="w-4 h-4 shrink-0" />
              <span>Important Prerequisites, Conditions & Limitations</span>
            </div>
            <ul className="text-xs text-[#172B4D] space-y-1.5 pl-6 list-disc">
              {data.conditionsOrLimitations.map((cond, i) => (
                <li key={i} className="leading-relaxed">
                  {cond}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ==================================================================== */}
        {/* 4. NON-FALSITY INTEGRITY NOTICE (FOR INSUFFICIENT EVIDENCE)         */}
        {/* ==================================================================== */}
        {(isInsufficient || data.insufficientEvidenceNotice) && (
          <div
            data-testid="insufficient-evidence-safeguard-notice"
            className="p-4 rounded-xl bg-[#FEF7C3]/70 border border-[#FEDF89] text-xs text-[#713F12] space-y-1.5"
          >
            <div className="flex items-center gap-2 font-bold text-[#854D0E]">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Mandatory Integrity Safeguard: Absence of Proof ≠ Falsehood</span>
            </div>
            <p className="leading-relaxed text-[#78350F] pl-6">
              {data.insufficientEvidenceNotice ||
                'Insufficient official evidence does not prove that this claim is false. It means GovVerify AI could not locate verified government records to validate or disprove it.'}
            </p>
            {data.missingEvidenceReason && (
              <p className="text-[11px] text-[#92400E] pl-6 pt-0.5">
                <strong>Missing Evidence Detail:</strong> {data.missingEvidenceReason}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
