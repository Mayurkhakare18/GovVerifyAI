import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  FileText,
  Upload,
  AlertCircle,
  CheckCircle,
  FileCheck2,
  Trash2,
  Info,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Database,
  Clock,
  ExternalLink,
  Globe,
  Download,
  ShieldAlert,
} from 'lucide-react';
import { APP_CONFIG } from '../../config';
import { documentApi } from '../../services/api/documents';
import { verificationApi } from '../../services/api/verification';
import { EXAMPLE_CLAIMS } from '../../data/examples';
import { useAuth } from '../../contexts/AuthContext';
import { DocumentUploadReview } from '../common/DocumentUploadReview';
import { safeFetchJson, fetchJsonOrThrow } from '../../utils/safeFetch';
import { ActionGuidanceSection } from '../dashboard/ActionGuidanceSection';
import { ClaimReasonExplanationSection } from '../dashboard/ClaimReasonExplanationSection';
import { ClaimReasonExplanation, UrlInspectionResult } from '../../services/api/types';
import { useLanguage } from '../../contexts/LanguageContext';

interface VerificationConsoleProps {
  externalClaimText?: string;
  onClaimPopulated?: () => void;
  className?: string;
}

export interface SubclaimView {
  statement: string;
  verdict: string;
  explanation: string;
  relevance: string;
}

export interface CitationView {
  id: string;
  sourceTitle: string;
  sourceUrl: string;
  officialPublisher: string;
  relevantExcerpt: string;
  relationship: string;
  isOutdated?: boolean;
}

export interface VerificationConsoleResult {
  id: string;
  guestToken?: string;
  status: string;
  inputType: string;
  originalClaim: string;
  createdAt: string;
  message: string;
  isPersisted?: boolean;
  verdict?: 'SUPPORTED' | 'PARTIALLY_SUPPORTED' | 'CONTRADICTED' | 'INSUFFICIENT_EVIDENCE';
  confidence?: number;
  summaryExplanation?: string;
  reasonExplanation?: ClaimReasonExplanation;
  subclaims?: SubclaimView[];
  citations?: CitationView[];
  limitation?: string;
}

export const VerificationConsole: React.FC<VerificationConsoleProps> = ({
  externalClaimText,
  onClaimPopulated,
  className = '',
}) => {
  const { token, isAuthenticated } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'claim' | 'document' | 'url'>('claim');

  // Tab A State
  const [claimText, setClaimText] = useState('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<VerificationConsoleResult | null>(null);
  const [isAnalyzingVerdict, setIsAnalyzingVerdict] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  // Tab C (URL Verification) State
  const [urlInput, setUrlInput] = useState('');
  const [isInspectingUrl, setIsInspectingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlInspectionResult, setUrlInspectionResult] = useState<UrlInspectionResult | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external claim text (when user clicks an example card)
  useEffect(() => {
    if (externalClaimText !== undefined && externalClaimText !== '') {
      setActiveTab('claim');
      setClaimText(externalClaimText);
      setClaimError(null);
      setSubmissionError(null);
      setSubmissionResult(null);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
      if (onClaimPopulated) {
        onClaimPopulated();
      }
    }
  }, [externalClaimText, onClaimPopulated]);

  // Handle Quick Example Click
  const handleQuickExampleClick = (claim: string) => {
    setClaimText(claim);
    setClaimError(null);
    setSubmissionError(null);
    setSubmissionResult(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Handle Real Claim Submission via POST /api/v1/verify
  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingClaim) return; // Prevent duplicate submissions

    const trimmed = claimText.trim();

    if (!trimmed) {
      setClaimError('Please enter a claim to verify. Field cannot be empty.');
      return;
    }

    if (trimmed.length < APP_CONFIG.limits.minClaimChars) {
      setClaimError(
        `Claim is too short for verification. Please provide at least ${APP_CONFIG.limits.minClaimChars} characters with specific details.`
      );
      return;
    }

    if (trimmed.length > APP_CONFIG.limits.maxClaimChars) {
      setClaimError(
        `Claim exceeds maximum limit of ${APP_CONFIG.limits.maxClaimChars} characters.`
      );
      return;
    }

    setClaimError(null);
    setSubmissionError(null);
    setIsSubmittingClaim(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const data = await fetchJsonOrThrow('/api/v1/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          claim: trimmed,
          inputType: 'CLAIM',
        }),
      });

      setSubmissionResult(data);
      setIsSubmittingClaim(false);
    } catch (err: any) {
      setSubmissionError(
        err.message || 'Network error communicating with the verification server. Please retry.'
      );
      setIsSubmittingClaim(false);
    }
  };

  const handleClearClaim = () => {
    setClaimText('');
    setClaimError(null);
    setSubmissionError(null);
    setSubmissionResult(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleCopyId = () => {
    if (submissionResult?.id) {
      navigator.clipboard.writeText(submissionResult.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleGenerateVerdict = async () => {
    if (!submissionResult?.id || isAnalyzingVerdict) return;
    setIsAnalyzingVerdict(true);
    setAnalysisError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (submissionResult.guestToken) {
        headers['X-Guest-Token'] = submissionResult.guestToken;
      }

      const data = await fetchJsonOrThrow<any>(`/api/v1/verify/${submissionResult.id}/verdict`, {
        method: 'POST',
        headers,
      });

      setSubmissionResult((prev) =>
        prev
          ? {
              ...prev,
              status: data.status || 'COMPLETED',
              verdict: data.verdict,
              confidence: data.confidence,
              summaryExplanation: data.summaryExplanation,
              reasonExplanation: data.reasonExplanation,
              subclaims: data.subclaims,
              citations: data.citations,
              limitation: data.limitation,
            }
          : null
      );
      setIsAnalyzingVerdict(false);
    } catch (err: any) {
      setAnalysisError(err.message || 'Failed to connect to verification analysis service.');
      setIsAnalyzingVerdict(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!submissionResult?.id || isCheckingStatus) return;
    setIsCheckingStatus(true);
    setAnalysisError(null);

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (submissionResult.guestToken) {
        headers['X-Guest-Token'] = submissionResult.guestToken;
      }

      const data = await fetchJsonOrThrow<{ data?: any }>(
        `/api/v1/verify/${submissionResult.id}${
          submissionResult.guestToken ? `?token=${submissionResult.guestToken}` : ''
        }`,
        { headers }
      );

      if (data.data) {
        const reqData = data.data;
        const vResult = Array.isArray(reqData.verification_results)
          ? reqData.verification_results[0]
          : reqData.verification_results;

        setSubmissionResult((prev) =>
          prev
            ? {
                ...prev,
                status: reqData.status,
                verdict: vResult?.verdict || prev.verdict,
                confidence: vResult ? Number(vResult.confidence) : prev.confidence,
                summaryExplanation: vResult?.explanation || prev.summaryExplanation,
                reasonExplanation: reqData.reasonExplanation || prev.reasonExplanation,
              }
            : null
        );
      }
      setIsCheckingStatus(false);
    } catch (err: any) {
      setAnalysisError(err.message || 'Error checking verification status.');
      setIsCheckingStatus(false);
    }
  };

  // Handle Document Verification Submission via POST /api/v1/verify
  const handleConfirmDocumentClaim = async (
    confirmedClaimText: string,
    documentId: string,
    guestToken?: string
  ) => {
    setIsSubmittingClaim(true);
    setSubmissionError(null);
    setAnalysisError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      if (guestToken) {
        headers['X-Guest-Token'] = guestToken;
      }

      const data = await fetchJsonOrThrow<any>('/api/v1/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          claim: confirmedClaimText,
          inputType: 'DOCUMENT',
          documentId,
        }),
      });

      const activeToken = data.guestToken || guestToken;
      const initialResult: VerificationConsoleResult = {
        ...data,
        guestToken: activeToken,
      };
      setSubmissionResult(initialResult);

      // Immediately run discovery and verdict flow
      setIsAnalyzingVerdict(true);
      const authHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        authHeaders['Authorization'] = `Bearer ${token}`;
      }
      if (activeToken) {
        authHeaders['X-Guest-Token'] = activeToken;
      }

      const verdictData = await fetchJsonOrThrow<any>(`/api/v1/verify/${data.id}/verdict`, {
        method: 'POST',
        headers: authHeaders,
      });

      setSubmissionResult((prev) =>
        prev
          ? {
              ...prev,
              status: verdictData.status || 'COMPLETED',
              verdict: verdictData.verdict,
              confidence: verdictData.confidence,
              summaryExplanation: verdictData.summaryExplanation,
              reasonExplanation: verdictData.reasonExplanation,
              subclaims: verdictData.subclaims,
              citations: verdictData.citations,
              limitation: verdictData.limitation,
            }
          : null
      );
    } catch (err: any) {
      throw err;
    } finally {
      setIsSubmittingClaim(false);
      setIsAnalyzingVerdict(false);
    }
  };

  // Phase 4: URL Inspection Handler
  const handleInspectUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      setUrlError('Please enter a valid website URL to inspect.');
      return;
    }
    setUrlError(null);
    setIsInspectingUrl(true);
    setUrlInspectionResult(null);

    try {
      const res = await verificationApi.inspectUrl(urlInput.trim(), token || undefined);
      setUrlInspectionResult(res);
    } catch (err: any) {
      setUrlError(err.message || 'Failed to inspect website. Please check the URL and try again.');
    } finally {
      setIsInspectingUrl(false);
    }
  };

  // Phase 4: Submit Extracted Claim from URL
  const handleConfirmUrlClaim = async (claimText: string, sourceUrl: string) => {
    setIsSubmittingClaim(true);
    setSubmissionError(null);
    setAnalysisError(null);

    try {
      const res = await verificationApi.submitUrlClaim(claimText, sourceUrl, token || undefined);
      const initialResult: VerificationConsoleResult = {
        ...res,
        inputType: 'URL',
        message: 'Claim recorded from inspected website.',
      };
      setSubmissionResult(initialResult);

      setIsAnalyzingVerdict(true);
      const verdictData = await fetchJsonOrThrow<any>(`/api/v1/verify/${res.id}/verdict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(res.guestToken ? { 'X-Guest-Token': res.guestToken } : {}),
        },
      });

      setSubmissionResult((prev) =>
        prev
          ? {
              ...prev,
              status: verdictData.status || 'COMPLETED',
              verdict: verdictData.verdict,
              confidence: verdictData.confidence,
              summaryExplanation: verdictData.summaryExplanation,
              reasonExplanation: verdictData.reasonExplanation,
              subclaims: verdictData.subclaims,
              citations: verdictData.citations,
              limitation: verdictData.limitation,
            }
          : null
      );
    } catch (err: any) {
      setSubmissionError(err.message || 'Failed to verify URL claim.');
    } finally {
      setIsSubmittingClaim(false);
      setIsAnalyzingVerdict(false);
    }
  };

  // Phase 4: Download Verification Audit Report
  const handleDownloadReport = () => {
    if (!submissionResult) return;
    const v = submissionResult;
    const lines = [
      '========================================================================',
      'GOVVERIFY AI — SOVEREIGN GOVERNMENT CLAIM VERIFICATION AUDIT REPORT',
      '========================================================================',
      `Audit Date: ${new Date().toISOString()}`,
      `Verification Request ID: ${v.id}`,
      `Input Mode: ${v.inputType || 'CLAIM'}`,
      `Database Status: ${v.status}`,
      '',
      '--- VERIFICATION VERDICT ---',
      `Canonical Verdict: ${v.verdict || 'PENDING'}`,
      `Confidence Score: ${v.confidence ? Math.round(v.confidence * 100) + '%' : 'N/A'}`,
      '',
      '--- ORIGINAL CITIZEN CLAIM ---',
      v.originalClaim,
      '',
      '--- SUMMARY EXPLANATION ---',
      v.summaryExplanation || 'Verification pending or completed.',
      '',
    ];

    if (v.reasonExplanation) {
      lines.push('--- PLAIN-LANGUAGE AUDIT REASONS ---');
      lines.push(`Verdict Heading: ${v.reasonExplanation.verdictHeading}`);
      lines.push(`Direct Answer: ${v.reasonExplanation.directAnswer}`);
      if (Array.isArray(v.reasonExplanation.assertions)) {
        v.reasonExplanation.assertions.forEach((a, i) => {
          lines.push(`  [${i + 1}] Assertion: ${a.assertion} (${a.status})`);
          lines.push(`      Finding: ${a.explanation}`);
          if (a.officialFactInstead) {
            lines.push(`      Statutory Fact: ${a.officialFactInstead}`);
          }
        });
      }
      lines.push('');
    }

    if (v.citations && v.citations.length > 0) {
      lines.push('--- VERIFIED SOVEREIGN CITATIONS ---');
      v.citations.forEach((c, idx) => {
        lines.push(`[${idx + 1}] ${c.sourceTitle}`);
        lines.push(`    Authority: ${c.officialPublisher}`);
        lines.push(`    Official URL: ${c.sourceUrl}`);
        lines.push(`    Statutory Excerpt: ${c.relevantExcerpt}`);
      });
      lines.push('');
    }

    lines.push('--- STATUTORY DISCLAIMERS & SAFEGUARDS ---');
    lines.push('1. Presence of official government logos, emblems, or circular formats is NOT proof of authenticity.');
    lines.push('2. A .gov.in or .nic.in domain suffix alone is not proof that a specific claim is accurate without corroboration.');
    lines.push('3. GovVerify AI is an independent civic intelligence utility. We never charge application fees or guarantee disbursements.');
    lines.push('========================================================================');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GovVerify_Audit_Report_${v.id.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      id="verification-console"
      className={`bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl shadow-brand-navy/15 border border-white/80 overflow-hidden ${className}`}
    >
      {/* Console Top Header & Tabs */}
      <div className="border-b border-brand-border/80 bg-brand-bg-subtle/90 px-4 sm:px-6 pt-4 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-brand-blue" aria-hidden="true" />
            <h2 className="text-base font-extrabold tracking-tight text-brand-navy flex items-center gap-2">
              <span>{t('console.title') || 'Verify the Claim'}</span>
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-brand-slate">
            <span className="w-2 h-2 rounded-full bg-brand-green" />
            <span>{t('console.authoritativeBadge') || 'Authoritative Source Verification'}</span>
            <span>·</span>
            <span className="font-semibold text-brand-navy">
              {isAuthenticated
                ? t('console.authenticatedCitizen') || 'Authenticated Citizen'
                : t('console.publicAccess') || 'Public Access'}
            </span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          role="tablist"
          aria-label="Verification Input Methods"
          className="flex space-x-2 border-b border-transparent"
        >
          <button
            type="button"
            role="tab"
            id="tab-claim"
            aria-controls="panel-claim"
            aria-selected={activeTab === 'claim'}
            onClick={() => {
              setActiveTab('claim');
              setSubmissionResult(null);
            }}
            className={`flex items-center gap-2 px-4.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'claim'
                ? 'border-brand-blue text-brand-blue bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-brand-slate hover:text-brand-navy hover:bg-white/60 rounded-t-xl'
            }`}
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('console.tabClaim') || 'Verify a Claim'}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-document"
            aria-controls="panel-document"
            aria-selected={activeTab === 'document'}
            onClick={() => {
              setActiveTab('document');
              setSubmissionResult(null);
            }}
            className={`flex items-center gap-2 px-4.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'document'
                ? 'border-brand-blue text-brand-blue bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-brand-slate hover:text-brand-navy hover:bg-white/60 rounded-t-xl'
            }`}
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('console.tabDocument') || 'Upload a Document'}</span>
          </button>

          <button
            type="button"
            role="tab"
            id="tab-url"
            aria-controls="panel-url"
            aria-selected={activeTab === 'url'}
            onClick={() => {
              setActiveTab('url');
              setSubmissionResult(null);
            }}
            className={`flex items-center gap-2 px-4.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'url'
                ? 'border-brand-blue text-brand-blue bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-brand-slate hover:text-brand-navy hover:bg-white/60 rounded-t-xl'
            }`}
          >
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('console.tabUrl') || 'Verify Website / URL'}</span>
          </button>
        </div>
      </div>

      {/* Console Body */}
      <div className="p-4 sm:p-6">
        {submissionResult ? (
          /* REAL PERSISTED RESULT: QUEUED IN DATABASE */
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-4.5 rounded-xl border border-brand-softblue-border bg-brand-softblue/80">
                  <div className="flex items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-brand-blue text-white shrink-0 mt-0.5 shadow-2xs">
                      <Database className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-brand-blue flex items-center gap-1.5">
                          <span>{t('console.queuedBadge') || 'Request Recorded in Database'}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-brand-blue text-white shadow-2xs">
                          Status: {submissionResult.status}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-brand-navy">
                        {t('console.queuedTitle') || 'Claim Queued for Official Verification'}
                      </h3>

                      <p className="text-xs sm:text-sm text-brand-slate leading-relaxed">
                        {t('console.queuedDesc') ||
                          'Your statement has been validated and persisted in PostgreSQL. In accordance with sovereign design principles, no fabricated or simulated verdict is displayed.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Persisted Record Meta */}
                <div className="p-4 rounded-xl border border-brand-border bg-brand-bg-subtle space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-brand-slate uppercase tracking-wider">
                        {t('console.requestId') || 'Request ID:'}
                      </span>
                      <code className="text-xs font-mono font-bold text-brand-navy bg-white px-2 py-0.5 rounded border border-brand-border">
                        {submissionResult.id}
                      </code>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:text-brand-blue-hover self-start sm:self-auto cursor-pointer"
                      aria-label="Copy request ID"
                    >
                      {copiedId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">{t('console.copiedId') || 'Copied!'}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>{t('console.copyId') || 'Copy ID'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div>
                    <div className="text-[11px] font-bold text-brand-slate uppercase tracking-wider mb-1">
                      Submitted Statement:
                    </div>
                    <blockquote className="text-xs sm:text-sm text-brand-navy italic border-l-3 border-brand-blue pl-3 py-1 bg-white rounded-r-md border border-brand-border">
                      "{submissionResult.originalClaim || claimText}"
                    </blockquote>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-brand-slate-light pt-1">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Queued at:{' '}
                      {submissionResult.createdAt
                        ? new Date(submissionResult.createdAt).toLocaleTimeString()
                        : 'Just now'}
                    </span>
                    <span>·</span>
                    <span>Type: Plaintext Claim</span>
                  </div>
                </div>

                {/* Phase 3 Step 2: Analytical Verdict View or Queued State */}
                {submissionResult.verdict ? (
                  <div className="space-y-3.5">
                    {/* Verdict Banner */}
                    <div
                      className={`p-4 rounded-xl border ${
                        submissionResult.verdict === 'SUPPORTED'
                          ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                          : submissionResult.verdict === 'CONTRADICTED'
                          ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                          : submissionResult.verdict === 'PARTIALLY_SUPPORTED'
                          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                          : 'bg-slate-50/90 border-slate-300 text-slate-900'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg text-white shrink-0 mt-0.5 shadow-2xs ${
                            submissionResult.verdict === 'SUPPORTED'
                              ? 'bg-emerald-600'
                              : submissionResult.verdict === 'CONTRADICTED'
                              ? 'bg-rose-600'
                              : submissionResult.verdict === 'PARTIALLY_SUPPORTED'
                              ? 'bg-amber-600'
                              : 'bg-slate-600'
                          }`}
                        >
                          {submissionResult.verdict === 'SUPPORTED' && <CheckCircle className="w-5 h-5" />}
                          {submissionResult.verdict === 'CONTRADICTED' && <ShieldCheck className="w-5 h-5" />}
                          {submissionResult.verdict === 'PARTIALLY_SUPPORTED' && <AlertCircle className="w-5 h-5" />}
                          {submissionResult.verdict === 'INSUFFICIENT_EVIDENCE' && <Info className="w-5 h-5" />}
                        </div>

                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider opacity-80">
                              Verification Result
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wide bg-white/95 shadow-2xs border border-current">
                                {submissionResult.verdict.replace('_', ' ')}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-white/90 shadow-2xs text-brand-navy">
                                {submissionResult.confidence}% Confidence
                              </span>
                            </div>
                          </div>

                          <h3 className="text-base font-extrabold tracking-tight">
                            {submissionResult.verdict === 'SUPPORTED' && 'Claim Supported by Official Government Sources'}
                            {submissionResult.verdict === 'CONTRADICTED' && 'Claim Contradicted by Official Government Records'}
                            {submissionResult.verdict === 'PARTIALLY_SUPPORTED' && 'Claim Partially Supported / Qualified Finding'}
                            {submissionResult.verdict === 'INSUFFICIENT_EVIDENCE' && 'Insufficient Official Evidence Available'}
                          </h3>

                          <p className="text-xs sm:text-sm leading-relaxed opacity-95">
                            {submissionResult.summaryExplanation}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Limitation notice if applicable */}
                    {submissionResult.limitation && (
                      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900 flex items-start gap-2">
                        <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold">Retrieval Limitation:</strong>{' '}
                          {submissionResult.limitation}
                        </div>
                      </div>
                    )}

                    {/* Factual Audit Breakdown: Why Is This Claim Correct or Wrong? */}
                    <ClaimReasonExplanationSection
                      verdict={submissionResult.verdict}
                      originalClaim={submissionResult.originalClaim || claimText}
                      explanation={submissionResult.reasonExplanation}
                      subclaims={submissionResult.subclaims}
                      citations={submissionResult.citations}
                      limitation={submissionResult.limitation}
                    />

                    {/* Decomposed Subclaims Breakdown */}
                    {submissionResult.subclaims && submissionResult.subclaims.length > 0 && (
                      <div className="p-4 rounded-xl border border-brand-border bg-white space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-navy flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
                            <span>Decomposed Subclaims ({submissionResult.subclaims.length})</span>
                          </h4>
                          <span className="text-[10px] text-brand-slate uppercase font-semibold">Atomic Propositions</span>
                        </div>

                        <div className="space-y-2">
                          {submissionResult.subclaims.map((sub, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-lg border border-brand-border/70 bg-brand-bg-subtle/60 text-xs space-y-1"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <span className="font-bold text-brand-navy">"{sub.statement}"</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                    sub.verdict === 'SUPPORTED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : sub.verdict === 'CONTRADICTED'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-800'
                                  }`}
                                >
                                  {sub.verdict.replace('_', ' ')}
                                </span>
                              </div>
                              <p className="text-brand-slate text-[11px] leading-relaxed">{sub.explanation}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Traceable Citations */}
                    {submissionResult.citations && submissionResult.citations.length > 0 && (
                      <div className="p-4 rounded-xl border border-brand-border bg-white space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-navy flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-brand-blue" />
                            <span>Authoritative Citations ({submissionResult.citations.length})</span>
                          </h4>
                          <span className="text-[10px] text-brand-slate uppercase font-semibold">Sovereign Evidence</span>
                        </div>

                        <div className="space-y-2">
                          {submissionResult.citations.map((cite, idx) => (
                            <div
                              key={cite.id || idx}
                              className="p-3 rounded-lg border border-brand-border/70 bg-brand-bg-subtle/40 text-xs space-y-1.5"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-1.5">
                                <div className="font-bold text-brand-navy flex items-center gap-1.5">
                                  <span className="px-1.5 py-0.2 rounded bg-brand-blue/10 text-brand-blue text-[10px] font-mono">
                                    [{idx + 1}]
                                  </span>
                                  <span>{cite.sourceTitle || cite.officialPublisher}</span>
                                  {cite.isOutdated && (
                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-100 text-amber-800">
                                      Archival
                                    </span>
                                  )}
                                </div>
                                <a
                                  href={cite.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-brand-blue hover:text-brand-blue-hover text-[11px] flex items-center gap-1 font-semibold"
                                >
                                  <span>{cite.officialPublisher}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                              <blockquote className="text-[11px] text-brand-slate italic border-l-2 border-brand-blue/60 pl-2 bg-white/80 py-1 rounded-r">
                                "{cite.relevantExcerpt}"
                              </blockquote>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Phase 6-8: Verify & Take Action Guidance & Scheme Application Roadmap */}
                    <div className="pt-2">
                      <ActionGuidanceSection
                        requestId={submissionResult.id}
                        originalClaim={submissionResult.originalClaim || claimText}
                        verdict={submissionResult.verdict}
                        guestToken={submissionResult.guestToken}
                      />
                    </div>
                  </div>
                ) : (
                  /* QUEUED STATE: RUN ANALYSIS ACTION */
                  <div className="space-y-3">
                    <div className="p-3.5 rounded-xl border border-brand-border bg-white space-y-1.5 text-xs text-brand-slate">
                      <div className="font-bold text-brand-navy flex items-center gap-1.5">
                        <Info className="w-3.5 h-3.5 text-brand-blue" aria-hidden="true" />
                        Verification Pipeline Ready:
                      </div>
                      <p className="text-[11px] text-brand-slate leading-relaxed">
                        The claim is saved and queryable via{' '}
                        <code className="text-brand-navy font-mono">GET /api/v1/verify/{submissionResult.id}</code>.
                        Click below to run multi-source evidence decomposition and analytical verdict generation.
                      </p>
                    </div>

                    {analysisError && (
                      <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-xs text-rose-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>{analysisError}</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleGenerateVerdict}
                        disabled={isAnalyzingVerdict || isCheckingStatus}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isAnalyzingVerdict ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Evaluating Official Sovereign Records...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4" />
                            <span>Analyze Sovereign Evidence & Generate Verdict</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handleCheckStatus}
                        disabled={isCheckingStatus || isAnalyzingVerdict}
                        className="py-2.5 px-4 rounded-xl border border-brand-border bg-white hover:bg-brand-softblue text-brand-navy text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                        title="Check latest status from database"
                      >
                        {isCheckingStatus ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-blue" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5 text-brand-slate" />
                        )}
                        <span>Check Status</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmissionResult(null);
                      setSubmissionError(null);
                      setAnalysisError(null);
                    }}
                    className="px-4 py-2 text-xs sm:text-sm font-semibold text-brand-navy hover:bg-brand-softblue rounded-lg border border-brand-border transition-colors flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-brand-slate" />
                    <span>Edit Input</span>
                  </button>

                  {submissionResult.verdict && (
                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      className="px-4 py-2 text-xs sm:text-sm font-bold text-brand-navy hover:text-brand-blue bg-white hover:bg-brand-softblue rounded-lg border border-brand-border transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                      title="Download structured sovereign verification audit report"
                    >
                      <Download className="w-3.5 h-3.5 text-brand-blue" />
                      <span>{t('console.downloadReport') || 'Download Audit Report'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleClearClaim}
                    className="px-4 py-2 text-xs sm:text-sm font-semibold text-brand-blue hover:text-brand-blue-hover bg-brand-softblue hover:bg-brand-softblue-border rounded-lg transition-colors cursor-pointer"
                  >
                    {t('workspace.clearButton') || 'Verify Another Claim'}
                  </button>
                </div>
              </div>
        ) : (
          <>
            {/* TAB A: VERIFY A CLAIM */}
            {activeTab === 'claim' && (
              <div role="tabpanel" id="panel-claim" aria-labelledby="tab-claim">
                <form onSubmit={handleClaimSubmit} className="space-y-3.5">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="claim-input"
                      className="block text-xs sm:text-sm font-bold text-brand-navy"
                    >
                      {t('workspace.intakePlaceholder') || 'Enter a government-related claim or policy assertion...'}
                    </label>
                    <span
                      id="char-counter"
                      className={`text-xs font-mono font-medium ${
                        claimText.length > APP_CONFIG.limits.maxClaimChars
                          ? 'text-rose-600 font-bold'
                          : claimText.length > APP_CONFIG.limits.maxClaimChars * 0.9
                          ? 'text-amber-600'
                          : 'text-brand-slate'
                      }`}
                    >
                      {claimText.length} / {APP_CONFIG.limits.maxClaimChars}
                    </span>
                  </div>

                  <div className="relative">
                    <textarea
                      id="claim-input"
                      ref={textareaRef}
                      rows={3}
                      value={claimText}
                      disabled={isSubmittingClaim}
                      onChange={(e) => {
                        setClaimText(e.target.value);
                        if (claimError) setClaimError(null);
                        if (submissionError) setSubmissionError(null);
                      }}
                      placeholder={
                        t('console.claimPlaceholder') ||
                        'e.g. Has the PM-KISAN installment been revised from ₹2,000 to ₹4,000 per installment for 2026? Paste text from a WhatsApp circular or news item...'
                      }
                      aria-describedby={
                        claimError ? 'claim-error char-counter' : 'claim-hint char-counter'
                      }
                      aria-invalid={claimError !== null}
                      className={`w-full p-3.5 text-xs sm:text-sm text-brand-navy placeholder:text-slate-400 bg-white rounded-xl border focus-visible:outline-2 transition-colors resize-y min-h-[90px] sm:min-h-[105px] disabled:opacity-60 ${
                        claimError
                          ? 'border-rose-400 focus-visible:outline-rose-500 bg-rose-50/20'
                          : 'border-brand-border focus-visible:outline-brand-blue hover:border-slate-400'
                      }`}
                    />
                  </div>

                  {claimError && (
                    <div
                      id="claim-error"
                      role="alert"
                      className="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
                      <span>{claimError}</span>
                    </div>
                  )}

                  {/* Submission API Error Banner with Retry */}
                  {submissionError && (
                    <div
                      role="alert"
                      className="mt-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2 animate-in fade-in"
                    >
                      <div className="flex items-start gap-2 font-medium">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
                        <div className="flex-1 leading-relaxed">{submissionError}</div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-200/60">
                        <button
                          type="button"
                          onClick={() => setSubmissionError(null)}
                          className="px-2.5 py-1 text-[11px] text-rose-700 hover:text-rose-900 cursor-pointer"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={handleClaimSubmit}
                          disabled={isSubmittingClaim}
                          className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded text-[11px] font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Retry Submission</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Example Claim Selection Quick-Pills */}
                <div>
                  <div className="text-[11px] font-semibold text-brand-slate mb-1.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-brand-blue" />
                    <span>{t('console.examplesLabel') || 'Try example claims:'}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLE_CLAIMS.slice(0, 4).map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => handleQuickExampleClick(ex.claimText)}
                        disabled={isSubmittingClaim}
                        className="text-[11px] font-medium text-brand-navy bg-brand-softblue hover:bg-brand-softblue-border hover:text-brand-blue px-2.5 py-1 rounded-md border border-brand-softblue-border transition-colors truncate max-w-[240px] text-left disabled:opacity-40 cursor-pointer"
                        title={ex.claimText}
                      >
                        {ex.category}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleClearClaim}
                    disabled={!claimText || isSubmittingClaim}
                    className="px-3 py-2 text-xs font-semibold text-brand-slate hover:text-brand-navy hover:bg-brand-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-brand-border transition-colors text-center cursor-pointer"
                  >
                    {t('console.clearButton') || 'Clear Input'}
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingClaim}
                    className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-hover active:bg-brand-navy-light disabled:opacity-60 rounded-xl shadow-xs transition-all hover:shadow-md focus-visible:outline-brand-blue text-center flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isSubmittingClaim ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t('console.verifying') || 'Cross-Referencing Sovereign Gazettes...'}</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>{t('console.verifyButton') || 'Run Sovereign Verification'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

            {/* TAB B: UPLOAD A DOCUMENT */}
            {activeTab === 'document' && (
              <div role="tabpanel" id="panel-document" aria-labelledby="tab-document">
                <DocumentUploadReview
                  onConfirmClaim={handleConfirmDocumentClaim}
                  isVerifying={isSubmittingClaim || isAnalyzingVerdict}
                  onManualEntryRequested={(suggestedText) => {
                    setActiveTab('claim');
                    if (suggestedText) {
                      setClaimText(suggestedText);
                    }
                  }}
                />
              </div>
            )}

            {/* TAB C: SUSPICIOUS WEBSITE / URL VERIFICATION */}
            {activeTab === 'url' && (
              <div role="tabpanel" id="panel-url" aria-labelledby="tab-url" className="space-y-5">
                <form onSubmit={handleInspectUrl} className="space-y-4">
                  <div>
                    <label htmlFor="url-input" className="block text-xs font-bold uppercase tracking-wider text-brand-navy mb-1.5">
                      Suspicious Website or Scheme Announcement URL
                    </label>
                    <p className="text-xs text-brand-slate mb-2.5">
                      Submit a link claiming to offer government grants, schemes, cash transfers, or subsidies. GovVerify AI will inspect domain legitimacy, lookalike spoofing, unauthorized application fees, and extract verifiable claims.
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Globe className="w-4 h-4 text-brand-slate absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="url-input"
                          type="url"
                          value={urlInput}
                          onChange={(e) => {
                            setUrlInput(e.target.value);
                            setUrlError(null);
                          }}
                          placeholder={t('console.urlPlaceholder') || 'https://pmkisan-registration.org/apply'}
                          disabled={isInspectingUrl || isSubmittingClaim}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-border bg-white text-xs sm:text-sm font-medium text-brand-navy placeholder:text-brand-slate/60 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15 outline-none transition-all disabled:opacity-60"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isInspectingUrl || !urlInput.trim() || isSubmittingClaim}
                        className="px-5 py-2.5 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white text-xs sm:text-sm font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {isInspectingUrl ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{t('console.inspectingUrl') || 'Inspecting Domain...'}</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-4 h-4" />
                            <span>{t('console.inspectUrlButton') || 'Inspect URL'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {urlError && (
                      <div className="mt-2.5 p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                        <span>{urlError}</span>
                      </div>
                    )}
                  </div>
                </form>

                {/* Inspection Result Preview */}
                {urlInspectionResult && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Domain Authenticity Banner */}
                    <div
                      className={`p-4 rounded-xl border ${
                        urlInspectionResult.impersonationRisk === 'HIGH'
                          ? 'border-red-300 bg-red-50/80'
                          : urlInspectionResult.isOfficialDomain
                          ? 'border-emerald-300 bg-emerald-50/80'
                          : 'border-amber-300 bg-amber-50/80'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {urlInspectionResult.impersonationRisk === 'HIGH' ? (
                          <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        ) : urlInspectionResult.isOfficialDomain ? (
                          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-xs sm:text-sm text-brand-navy">
                              {urlInspectionResult.domain}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                urlInspectionResult.impersonationRisk === 'HIGH'
                                  ? 'bg-red-600 text-white'
                                  : urlInspectionResult.isOfficialDomain
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-600 text-white'
                              }`}
                            >
                              {urlInspectionResult.impersonationRisk === 'HIGH'
                                ? 'Impersonation Risk'
                                : urlInspectionResult.isOfficialDomain
                                ? 'Official Sovereign Domain'
                                : 'Third-Party Domain'}
                            </span>
                          </div>
                          <p className="text-xs text-brand-slate">
                            {urlInspectionResult.impersonationIndicators[0] ||
                              'Domain analyzed against sovereign Indian government registries.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Suspicious Fee Alert if Present */}
                    {urlInspectionResult.suspiciousFeeNotice && (
                      <div className="p-3.5 rounded-xl border border-red-300 bg-red-50 text-xs text-red-800 flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-bold">Unauthorized Fee Alert:</strong>
                          <span>{urlInspectionResult.suspiciousFeeNotice}</span>
                        </div>
                      </div>
                    )}

                    {/* Extracted Claims */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-brand-navy flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-brand-blue" />
                          <span>Identified Policy & Scheme Claims ({urlInspectionResult.extractedClaims.length})</span>
                        </h3>
                        <span className="text-[11px] text-brand-slate">Click to verify via Phase 3 engine</span>
                      </div>

                      {urlInspectionResult.extractedClaims.length === 0 ? (
                        <div className="p-4 rounded-xl border border-brand-border bg-brand-bg-subtle text-center text-xs text-brand-slate">
                          No distinct government scheme claims or financial benefit assertions were identified on this page.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {urlInspectionResult.extractedClaims.map((c, i) => (
                            <div
                              key={c.id || i}
                              className="p-3.5 rounded-xl border border-brand-border bg-white hover:border-brand-blue/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1 flex-1">
                                <p className="text-xs sm:text-sm font-semibold text-brand-navy">
                                  {c.claimText}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-brand-slate">
                                  {c.schemeName && (
                                    <span className="px-2 py-0.5 rounded bg-brand-softblue text-brand-blue font-bold">
                                      {c.schemeName}
                                    </span>
                                  )}
                                  {c.benefitAmount && (
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold">
                                      {c.benefitAmount}
                                    </span>
                                  )}
                                  {c.targetBeneficiaries && (
                                    <span>Target: {c.targetBeneficiaries}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleConfirmUrlClaim(c.claimText, urlInspectionResult.canonicalUrl)}
                                disabled={isSubmittingClaim || isAnalyzingVerdict}
                                className="px-4 py-2 rounded-lg bg-brand-navy hover:bg-brand-navy-light text-white text-xs font-bold transition-colors shrink-0 disabled:opacity-50"
                              >
                                Verify This Claim
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sovereign Domain Suffix Caveat */}
                    <div className="p-3 rounded-lg border border-brand-border/60 bg-brand-bg-subtle/50 text-[11px] text-brand-slate flex items-start gap-2">
                      <Info className="w-3.5 h-3.5 text-brand-blue shrink-0 mt-0.5" />
                      <span>{urlInspectionResult.suffixCaveatNotice}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
