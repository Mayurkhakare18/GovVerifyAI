/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Premium Verification Results View
 * Unified, citizen-friendly, and accessible presentation of claim audits,
 * structured findings, verified evidence cards, and action guidance.
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Copy,
  Check,
  FileText,
  Share2,
  Printer,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Building2,
  Calendar,
  AlertCircle,
  Info,
  Layers,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { Link, useRouter } from '../../contexts/RouterContext';
import {
  getCitizenVerdict,
  cleanCitizenExplanation,
  getCitizenSourceTrustBadge,
  CanonicalVerdict,
} from '../../utils/citizenVerdict';
import { ActionGuidanceSection } from './ActionGuidanceSection';

export interface VerificationResultViewProps {
  requestId: string;
  originalClaim: string;
  verdict: CanonicalVerdict | string;
  confidence?: number;
  explanation: string;
  createdAt?: string;
  completedAt?: string;
  breadcrumbParent?: { label: string; href: string };
  subclaims?: Array<{
    id?: string;
    statement: string;
    verdict?: string;
    explanation?: string;
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
  limitation?: string;
  guestToken?: string;
  onNewVerification?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const VerificationResultView: React.FC<VerificationResultViewProps> = ({
  requestId,
  originalClaim,
  verdict,
  confidence,
  explanation,
  createdAt,
  completedAt,
  breadcrumbParent,
  subclaims = [],
  evidence = [],
  limitation,
  guestToken,
  onNewVerification,
  onRetry,
  isRetrying = false,
}) => {
  const { navigate } = useRouter();
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [copiedClaim, setCopiedClaim] = useState<boolean>(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [showWhyResult, setShowWhyResult] = useState<boolean>(false);
  const [expandedExcerpts, setExpandedExcerpts] = useState<Record<string, boolean>>({});
  const [showAllEvidence, setShowAllEvidence] = useState<boolean>(false);

  const citizenVerdict = getCitizenVerdict(verdict);
  const formattedExplanation = cleanCitizenExplanation(explanation);

  // Format date only when supplied by real data
  const dateToFormat = completedAt || createdAt;
  const formattedDate = dateToFormat
    ? new Date(dateToFormat).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  // Copy report summary
  const handleCopyShare = async () => {
    const textToCopy = `[GovVerify AI Fact Check]\nClaim: "${originalClaim}"\nVerdict: ${citizenVerdict.label} (${citizenVerdict.statement})\nSummary: ${formattedExplanation}\nAudit ID: ${requestId}\nVerify online: https://govverify.internal/app/history/${requestId}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Copy claim text
  const handleCopyClaim = async () => {
    try {
      await navigator.clipboard.writeText(originalClaim);
      setCopiedClaim(true);
      setTimeout(() => setCopiedClaim(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleExcerpt = (id: string) => {
    setExpandedExcerpts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Verdict-specific styling
  const isSupported = verdict === 'SUPPORTED';
  const isPartiallySupported = verdict === 'PARTIALLY_SUPPORTED';
  const isContradicted = verdict === 'CONTRADICTED';
  const isInsufficient = verdict === 'INSUFFICIENT_EVIDENCE';

  // Section 5: Derive "What we found" structure from real subclaims and evidence
  const checksOutPoints = subclaims
    .filter((s) => s.verdict === 'SUPPORTED' || isSupported)
    .map((s) => s.explanation || s.statement)
    .filter(Boolean);

  const needsClarificationPoints = subclaims
    .filter((s) => s.verdict === 'PARTIALLY_SUPPORTED' || isPartiallySupported)
    .map((s) => s.explanation || s.statement)
    .filter(Boolean);

  const contradictedPoints = subclaims
    .filter((s) => s.verdict === 'CONTRADICTED' || isContradicted)
    .map((s) => s.explanation || s.statement)
    .filter(Boolean);

  // Evidence pagination: show 3 initially unless expanded
  const visibleEvidence = showAllEvidence ? evidence : evidence.slice(0, 3);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 print:max-w-none print:pb-0">
      {/* ==================================================================== */}
      {/* 1. BREADCRUMB & RESULT HEADER */}
      {/* ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E1E7EF]">
        <div className="space-y-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#526176]">
            <Link href="/app" className="hover:text-[#2457C5] transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href={breadcrumbParent?.href || "/app/verify"} className="hover:text-[#2457C5] transition-colors">
              {breadcrumbParent?.label || "Verify"}
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#172B4D]">Result</span>
          </nav>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#172B4D]">
            Verification Result
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto print:hidden">
          <button
            type="button"
            onClick={handleCopyShare}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F0F4F9] text-[#172B4D] border border-[#E1E7EF] shadow-2xs flex items-center gap-1.5 transition-colors"
            title="Copy fact-check summary"
          >
            {copiedShare ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#0B7A48]" />
                <span className="text-[#0B7A48]">Copied</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-[#526176]" />
                <span>Share</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white hover:bg-[#F0F4F9] text-[#172B4D] border border-[#E1E7EF] shadow-2xs flex items-center gap-1.5 transition-colors"
            title="Print or export report"
          >
            <Printer className="w-3.5 h-3.5 text-[#526176]" />
            <span>Print</span>
          </button>

          {onNewVerification && (
            <button
              type="button"
              onClick={onNewVerification}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#2457C5] hover:bg-[#1D46A6] text-white shadow-xs transition-colors flex items-center gap-1.5"
            >
              <span>New Check</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 2. ORIGINAL CLAIM PROMINENT CARD */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-[#526176] uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-[#2457C5]" />
            <span>Statement Evaluated</span>
          </span>

          <div className="flex items-center gap-3">
            {formattedDate && (
              <span className="text-[11px] text-[#526176] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>{formattedDate}</span>
              </span>
            )}
            <button
              type="button"
              onClick={handleCopyClaim}
              className="text-[11px] font-semibold text-[#2457C5] hover:underline flex items-center gap-1"
              title="Copy statement text"
            >
              {copiedClaim ? <Check className="w-3 h-3 text-[#0B7A48]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedClaim ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <p className="text-base sm:text-lg font-bold text-[#172B4D] leading-snug">
          "{originalClaim}"
        </p>
      </div>

      {/* ==================================================================== */}
      {/* 3. VERDICT CARD AND PLAIN-LANGUAGE SUMMARY */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs overflow-hidden">
        {/* Verdict Badge Banner */}
        <div className={`p-6 sm:p-7 border-b ${citizenVerdict.borderClass} ${citizenVerdict.pillClass} space-y-3`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.85)' }}
              >
                {isSupported && <CheckCircle2 className="w-6 h-6 text-[#0B7A48]" />}
                {isPartiallySupported && <AlertTriangle className="w-6 h-6 text-[#B54708]" />}
                {isContradicted && <XCircle className="w-6 h-6 text-[#B42318]" />}
                {isInsufficient && <HelpCircle className="w-6 h-6 text-[#344054]" />}
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-75 block">
                  Audited Citizen Verdict
                </span>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  {citizenVerdict.label}
                </h2>
              </div>
            </div>

            {/* Secondary Confidence Note */}
            {confidence !== undefined && confidence > 0 && (
              <div className="p-2.5 rounded-xl bg-white/80 border border-current/15 text-right self-start sm:self-auto">
                <span className="text-[10px] font-bold block uppercase opacity-70">
                  Model Evidence Agreement
                </span>
                <span className="text-xs font-bold">
                  {confidence}% confidence
                </span>
              </div>
            )}
          </div>

          {/* Primary Citizen Statement */}
          <div className="pt-1">
            <p className="text-sm sm:text-base font-bold text-[#172B4D] leading-snug">
              {citizenVerdict.statement}
            </p>
          </div>
        </div>

        {/* Plain Language Summary Box */}
        <div className="p-6 sm:p-7 space-y-4">
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#526176]">
              Plain-Language Summary
            </h3>
            <p className="text-sm text-[#172B4D] leading-relaxed font-medium bg-[#F5F7FA] p-4 rounded-xl border border-[#E1E7EF]">
              {formattedExplanation}
            </p>
          </div>

          {/* "Why this result?" Expandable Link */}
          <div>
            <button
              type="button"
              onClick={() => setShowWhyResult(!showWhyResult)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2457C5] hover:text-[#1D46A6] transition-colors"
            >
              <span>Why this result?</span>
              {showWhyResult ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showWhyResult && (
              <div className="mt-2.5 p-4 rounded-xl bg-[#F0F4F9] border border-[#E1E7EF] text-xs text-[#172B4D] leading-relaxed space-y-2 animate-in fade-in duration-150">
                <p>
                  <strong>How GovVerify AI verified this:</strong> Our pipeline analyzed primary sovereign notifications, press advisories, and gazettes published by responsible ministries. The verdict reflects verifiable facts documented on official government infrastructure.
                </p>
                <p className="text-[11px] text-[#526176]">
                  <strong>Notice on Confidence:</strong> The agreement percentage measures how consistently retrieved government sources support or refute the proposition. It does not replace statutory determination by a government officer.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. WHAT WE FOUND (Section 5) */}
      {/* ==================================================================== */}
      {(checksOutPoints.length > 0 || needsClarificationPoints.length > 0 || isContradicted || isInsufficient) && (
        <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 sm:p-7 space-y-4">
          <div className="flex items-center gap-2 border-b border-[#E1E7EF] pb-3">
            <span className="w-2 h-2 rounded-full bg-[#2457C5]" />
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">
              What We Found
            </h3>
          </div>

          <div className="space-y-3.5">
            {/* What Checks Out */}
            {checksOutPoints.length > 0 && !isContradicted && (
              <div className="p-4 rounded-xl bg-[#EBFDF2]/60 border border-[#C6F5D5] space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0B7A48]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>What checks out</span>
                </div>
                <ul className="text-xs text-[#172B4D] space-y-1 pl-6 list-disc">
                  {checksOutPoints.map((pt, i) => (
                    <li key={i} className="leading-relaxed">{pt}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* What Needs Clarification */}
            {(needsClarificationPoints.length > 0 || isPartiallySupported) && (
              <div className="p-4 rounded-xl bg-[#FEF7C3]/60 border border-[#FEDF89] space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#B54708]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>What needs clarification</span>
                </div>
                <ul className="text-xs text-[#172B4D] space-y-1 pl-6 list-disc">
                  {needsClarificationPoints.length > 0 ? (
                    needsClarificationPoints.map((pt, i) => (
                      <li key={i} className="leading-relaxed">{pt}</li>
                    ))
                  ) : (
                    <li className="leading-relaxed">
                      Statutory prerequisites, income limits, or mandatory registration rules apply before benefits are disbursed.
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* What Contradicts (if contradicted) */}
            {isContradicted && (
              <div className="p-4 rounded-xl bg-[#FEF3F2]/60 border border-[#FECDCA] space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#B42318]">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>What the evidence disproves</span>
                </div>
                <p className="text-xs text-[#172B4D] leading-relaxed pl-6">
                  Official fact checks and ministry clarifications refute this statement. No official circular mandates or provides what this claim describes.
                </p>
              </div>
            )}

            {/* What you should know */}
            <div className="p-4 rounded-xl bg-[#F0F4F9] border border-[#E1E7EF] space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#2457C5]">
                <Info className="w-4 h-4 shrink-0" />
                <span>What you should know</span>
              </div>
              <p className="text-xs text-[#526176] leading-relaxed pl-6">
                {isSupported
                  ? 'A verified scheme establishes that the program exists, but your individual benefit depends on applying through official portals with verified documents.'
                  : isPartiallySupported
                  ? 'Do not assume automatic entitlement. Review the specific mandatory conditions detailed below.'
                  : isContradicted
                  ? 'Do not pay unauthorized registration fees or share OTPs/Aadhaar credentials based on this claim.'
                  : 'Because reliable proof is unavailable, verify directly on official directories (myscheme.gov.in) before acting.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. KEY EVIDENCE CARDS (Section 6) */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E7EF] pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2457C5]" />
            <h3 className="text-sm sm:text-base font-bold text-[#172B4D]">
              Key Evidence & Sovereign Sources
            </h3>
          </div>
          <span className="text-xs text-[#526176]">
            {evidence.length} verified government citation{evidence.length === 1 ? '' : 's'}
          </span>
        </div>

        {evidence.length === 0 ? (
          /* Honest Empty State for Evidence */
          <div className="p-6 rounded-xl bg-[#F5F7FA] border border-[#E1E7EF] text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-white border border-[#E1E7EF] flex items-center justify-center text-[#526176]">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[#172B4D]">
                No reliable evidence was available for this check
              </h4>
              <p className="text-xs text-[#526176] max-w-md mx-auto leading-relaxed">
                Try again later or consult an official source. Under GovVerify AI integrity standards, we won't present unverified search results as proof.
              </p>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                disabled={isRetrying}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-[#F0F4F9] border border-[#E1E7EF] text-xs font-bold text-[#172B4D] rounded-lg transition-colors shadow-2xs"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Retrying check...' : 'Retry Verification'}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {visibleEvidence.map((ev, idx) => {
              const domain = ev.domain || 'gov.in';
              const trustBadge = getCitizenSourceTrustBadge(domain, ev.sourceType);
              const isExcerptExpanded = Boolean(expandedExcerpts[ev.id || String(idx)]);
              const isLongExcerpt = (ev.extractedText || '').length > 220;

              return (
                <div
                  key={ev.id || idx}
                  className="p-5 rounded-xl border border-[#E1E7EF] bg-white shadow-2xs space-y-3.5 hover:border-[#CBD5E1] transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold border ${trustBadge.pillClass}`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: trustBadge.dotColor }}
                        />
                        <span>{trustBadge.label}</span>
                      </span>

                      <span className="text-[10px] font-mono text-[#526176] px-2 py-0.5 rounded bg-[#F0F4F9]">
                        {domain}
                      </span>
                    </div>

                    {ev.publicationDate && (
                      <span className="text-[11px] text-[#526176] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>Published: {ev.publicationDate}</span>
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs sm:text-sm font-bold text-[#172B4D]">
                      {ev.sourceTitle || 'Official Government Notification'}
                    </h4>
                    {ev.issuingAuthority && (
                      <p className="text-[11px] text-[#526176] flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-[#526176]" />
                        <span>{ev.issuingAuthority}</span>
                      </p>
                    )}
                  </div>

                  {/* Genuine Retrieved Excerpt */}
                  {ev.extractedText && (
                    <div className="space-y-1">
                      <blockquote className="p-3.5 rounded-lg bg-[#F5F7FA] border-l-2 border-[#2457C5] text-xs text-[#172B4D] italic leading-relaxed">
                        "{isLongExcerpt && !isExcerptExpanded
                          ? `${ev.extractedText.slice(0, 220)}...`
                          : ev.extractedText}"
                      </blockquote>

                      {isLongExcerpt && (
                        <button
                          type="button"
                          onClick={() => toggleExcerpt(ev.id || String(idx))}
                          className="text-[11px] font-bold text-[#2457C5] hover:underline"
                        >
                          {isExcerptExpanded ? 'Show less' : 'Read full quote'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Relationship and Source Link */}
                  <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-[#F0F4F9]">
                    <span className="text-[11px] text-[#526176]">
                      {ev.relationship === 'CONTRADICTS' ? (
                        <strong className="text-[#B42318]">Directly refutes claim</strong>
                      ) : (
                        <strong className="text-[#0B7A48]">Supports factual premise</strong>
                      )}
                    </span>

                    {ev.sourceUrl && (
                      <a
                        href={ev.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2457C5] hover:text-[#1D46A6] hover:underline"
                      >
                        <span>Read original source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Expand / Collapse More Evidence */}
            {evidence.length > 3 && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowAllEvidence(!showAllEvidence)}
                  className="px-4 py-2 text-xs font-bold text-[#2457C5] hover:bg-[#F0F4F9] border border-[#E1E7EF] rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  {showAllEvidence ? (
                    <>
                      <span>Show fewer sources</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <span>View all {evidence.length} evidence sources</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 6. WHAT CAN YOU DO NEXT? (Verify & Take Action Hub) */}
      {/* ==================================================================== */}
      <ActionGuidanceSection
        requestId={requestId}
        originalClaim={originalClaim}
        verdict={verdict}
        guestToken={guestToken}
      />

      {/* ==================================================================== */}
      {/* 7. IMPORTANT LIMITATIONS & SOURCE GAPS */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#B54708]" />
          <h3 className="text-xs sm:text-sm font-bold text-[#172B4D]">
            Important Limitations & Regional Scope
          </h3>
        </div>
        <p className="text-xs text-[#526176] leading-relaxed">
          {limitation ||
            'This verification is grounded in published Central and State Gazette notifications accessible at the time of the check. Government schemes may have regional variations, budget limits, or pending implementation rules not reflected in initial circulars.'}
        </p>
      </div>

      {/* ==================================================================== */}
      {/* 8. EXPANDABLE TECHNICAL DETAILS SECTION */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 space-y-3">
        <button
          type="button"
          onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
          className="flex items-center justify-between w-full text-xs font-bold text-[#526176] hover:text-[#172B4D] transition-colors"
        >
          <span className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#526176]" />
            <span>Technical Details & Audit Provenance</span>
          </span>
          {showTechnicalDetails ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showTechnicalDetails && (
          <div className="pt-2 text-xs font-mono space-y-2 text-[#526176] border-t border-[#E1E7EF] animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-[#F0F4F9]">
              <span className="font-semibold text-[#172B4D]">Audit Request ID:</span>
              <span className="select-all">{requestId}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-[#F0F4F9]">
              <span className="font-semibold text-[#172B4D]">Engine Verdict:</span>
              <span>{verdict}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-[#F0F4F9]">
              <span className="font-semibold text-[#172B4D]">Agreement Score:</span>
              <span>{confidence !== undefined ? `${confidence}%` : 'N/A'}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 py-1 border-b border-[#F0F4F9]">
              <span className="font-semibold text-[#172B4D]">Verified Citations Count:</span>
              <span>{evidence.length} records</span>
            </div>
            {subclaims.length > 0 && (
              <div className="pt-2 space-y-2">
                <span className="font-semibold text-[#172B4D] block font-sans text-xs">
                  Decomposed Claim Statements:
                </span>
                <div className="space-y-1.5 font-sans">
                  {subclaims.map((sub, i) => (
                    <div key={sub.id || i} className="p-2.5 rounded-lg bg-[#F5F7FA] border border-[#E1E7EF] text-xs">
                      <div className="font-bold text-[#172B4D]">Point #{i + 1}: {sub.statement}</div>
                      {sub.explanation && (
                        <div className="text-[#526176] text-[11px] mt-0.5">{sub.explanation}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
