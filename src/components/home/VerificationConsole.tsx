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
} from 'lucide-react';
import { APP_CONFIG } from '../../config';
import { documentApi } from '../../services/api/documents';
import { EXAMPLE_CLAIMS } from '../../data/examples';
import { useAuth } from '../../contexts/AuthContext';
import { DocumentUploadReview } from '../common/DocumentUploadReview';

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
  const [activeTab, setActiveTab] = useState<'claim' | 'document'>('claim');

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

      const res = await fetch('/api/v1/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          claim: trimmed,
          inputType: 'CLAIM',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmissionError(
          data.message || 'Verification submission could not be completed at this time.'
        );
        setIsSubmittingClaim(false);
        return;
      }

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

      const res = await fetch(`/api/v1/verify/${submissionResult.id}/verdict`, {
        method: 'POST',
        headers,
      });

      const data = await res.json();
      if (!res.ok) {
        setAnalysisError(data.message || 'Verdict generation could not be completed at this time.');
        setIsAnalyzingVerdict(false);
        return;
      }

      setSubmissionResult((prev) =>
        prev
          ? {
              ...prev,
              status: data.status || 'COMPLETED',
              verdict: data.verdict,
              confidence: data.confidence,
              summaryExplanation: data.summaryExplanation,
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

      const res = await fetch(
        `/api/v1/verify/${submissionResult.id}${
          submissionResult.guestToken ? `?token=${submissionResult.guestToken}` : ''
        }`,
        { headers }
      );
      const data = await res.json();
      if (!res.ok) {
        setAnalysisError(data.message || 'Could not fetch latest status.');
        setIsCheckingStatus(false);
        return;
      }

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

      const res = await fetch('/api/v1/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          claim: confirmedClaimText,
          inputType: 'DOCUMENT',
          documentId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Verification submission could not be completed at this time.');
      }

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

      const verdictRes = await fetch(`/api/v1/verify/${data.id}/verdict`, {
        method: 'POST',
        headers: authHeaders,
      });

      const verdictData = await verdictRes.json();
      if (verdictRes.ok) {
        setSubmissionResult((prev) =>
          prev
            ? {
                ...prev,
                status: verdictData.status || 'COMPLETED',
                verdict: verdictData.verdict,
                confidence: verdictData.confidence,
                summaryExplanation: verdictData.summaryExplanation,
                subclaims: verdictData.subclaims,
                citations: verdictData.citations,
                limitation: verdictData.limitation,
              }
            : null
        );
      } else {
        setAnalysisError(
          verdictData.message || 'Verdict generation could not be completed at this time.'
        );
      }
    } catch (err: any) {
      throw err;
    } finally {
      setIsSubmittingClaim(false);
      setIsAnalyzingVerdict(false);
    }
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
              <span>Verify the Claim</span>
            </h2>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-brand-slate">
            <span className="w-2 h-2 rounded-full bg-brand-green" />
            <span>Authoritative Source Verification</span>
            <span>·</span>
            <span className="font-semibold text-brand-navy">
              {isAuthenticated ? 'Authenticated Citizen' : 'Public Access'}
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
            className={`flex items-center gap-2 px-4.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'claim'
                ? 'border-brand-blue text-brand-blue bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-brand-slate hover:text-brand-navy hover:bg-white/60 rounded-t-xl'
            }`}
          >
            <Search className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Verify a Claim</span>
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
            className={`flex items-center gap-2 px-4.5 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
              activeTab === 'document'
                ? 'border-brand-blue text-brand-blue bg-white rounded-t-xl shadow-2xs'
                : 'border-transparent text-brand-slate hover:text-brand-navy hover:bg-white/60 rounded-t-xl'
            }`}
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Upload a Document</span>
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
                          <span>Request Recorded in Database</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-pulse" />
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide bg-brand-blue text-white shadow-2xs">
                          Status: {submissionResult.status}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-brand-navy">
                        Claim Queued for Official Verification
                      </h3>

                      <p className="text-xs sm:text-sm text-brand-slate leading-relaxed">
                        Your statement has been validated and persisted in PostgreSQL. In accordance with
                        Phase 2 design principles,{' '}
                        <strong className="text-brand-navy">no fabricated or simulated verdict is displayed</strong>.
                        Official crawlers and analytical cross-checks will execute in Phase 3.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Persisted Record Meta */}
                <div className="p-4 rounded-xl border border-brand-border bg-brand-bg-subtle space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border/60 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-brand-slate uppercase tracking-wider">
                        Request ID:
                      </span>
                      <code className="text-xs font-mono font-bold text-brand-navy bg-white px-2 py-0.5 rounded border border-brand-border">
                        {submissionResult.id}
                      </code>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-blue hover:text-brand-blue-hover self-start sm:self-auto"
                      aria-label="Copy request ID"
                    >
                      {copiedId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Copied ID</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy ID</span>
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

                  <button
                    type="button"
                    onClick={handleClearClaim}
                    className="px-4 py-2 text-xs sm:text-sm font-semibold text-brand-blue hover:text-brand-blue-hover bg-brand-softblue hover:bg-brand-softblue-border rounded-lg transition-colors"
                  >
                    Verify Another Claim
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
                      Enter a government-related claim or policy assertion...
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
                      placeholder="e.g. Has the PM-KISAN installment been revised from ₹2,000 to ₹4,000 per installment for 2026? Paste text from a WhatsApp circular or news item..."
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
                          className="px-2.5 py-1 text-[11px] text-rose-700 hover:text-rose-900"
                        >
                          Dismiss
                        </button>
                        <button
                          type="button"
                          onClick={handleClaimSubmit}
                          disabled={isSubmittingClaim}
                          className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white rounded text-[11px] font-bold shadow-2xs transition-colors flex items-center gap-1"
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
                    <span>Try example claims:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {EXAMPLE_CLAIMS.slice(0, 4).map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => handleQuickExampleClick(ex.claimText)}
                        disabled={isSubmittingClaim}
                        className="text-[11px] font-medium text-brand-navy bg-brand-softblue hover:bg-brand-softblue-border hover:text-brand-blue px-2.5 py-1 rounded-md border border-brand-softblue-border transition-colors truncate max-w-[240px] text-left disabled:opacity-40"
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
                    className="px-3 py-2 text-xs font-semibold text-brand-slate hover:text-brand-navy hover:bg-brand-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed rounded-lg border border-brand-border transition-colors text-center"
                  >
                    Clear Input
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingClaim}
                    className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-hover active:bg-brand-navy-light disabled:opacity-60 rounded-xl shadow-xs transition-all hover:shadow-md focus-visible:outline-brand-blue text-center flex items-center justify-center gap-2"
                  >
                    {isSubmittingClaim ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Submitting to Database...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>Verify with GovVerify AI</span>
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
          </>
        )}
      </div>
    </div>
  );
};
