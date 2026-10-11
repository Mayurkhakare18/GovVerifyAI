/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Verification Result Detail Report & Status Gate
 * Citizen-friendly verification report with strict status gating:
 * - Only COMPLETED requests with persisted canonical verdicts render a verification report.
 * - INSUFFICIENT_EVIDENCE is preserved as a legitimate completed analytical verdict.
 * - Incomplete, QUEUED, PROCESSING, FAILED, and integrity-error states render distinct,
 *   transparent status views with safe error handling and zero fabricated verdicts.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Copy,
  Check,
  ShieldAlert,
  HelpCircle,
  RotateCcw,
  PlusCircle,
  Search,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, Link } from '../../contexts/RouterContext';
import {
  CanonicalVerdict,
  isCanonicalVerdict,
  getCitizenVerdict,
} from '../../utils/citizenVerdict';
import { VerificationResultView } from './VerificationResultView';
import { safeFetchJson } from '../../utils/safeFetch';

export interface VerificationDetailRecord {
  id: string;
  original_claim: string;
  status: string;
  input_type: string;
  created_at: string;
  updated_at?: string;
  failure_reason?: string | null;
  error_message?: string | null;
  failure_details?: any;
  claims?: Array<{
    id: string;
    claim_text: string;
    claim_type?: string;
  }>;
  evidence?: Array<{
    id: string;
    extracted_text: string;
    clause_reference?: string;
    page_number?: number;
    sources?: {
      id: string;
      title: string;
      url: string;
      domain: string;
      issuing_authority?: string;
      publication_date?: string;
      source_type?: string;
    };
  }>;
  verification_results?: Array<{
    id: string;
    verdict: string;
    confidence: number;
    explanation: string;
    completed_at?: string;
  }>;
}

export type VerificationGateState =
  | 'COMPLETED_REPORT'
  | 'QUEUED'
  | 'PROCESSING'
  | 'FAILED'
  | 'COMPLETED_NO_RESULT'
  | 'COMPLETED_INVALID_VERDICT'
  | 'STATUS_UNAVAILABLE';

/**
 * Pure status gate evaluator enforcing the GovVerify AI civic integrity invariant:
 * A verification report is ONLY rendered when:
 * 1. The request status is strictly COMPLETED.
 * 2. A persisted verification_results record is present.
 * 3. The result verdict is one of the 4 canonical verdicts:
 *    SUPPORTED, PARTIALLY_SUPPORTED, CONTRADICTED, INSUFFICIENT_EVIDENCE.
 */
export function evaluateVerificationGate(
  record: VerificationDetailRecord | null | undefined
): {
  gateState: VerificationGateState;
  canonicalVerdict?: CanonicalVerdict;
} {
  if (!record || typeof record !== 'object') {
    return { gateState: 'STATUS_UNAVAILABLE' };
  }

  const rawStatus = (record.status || '').trim().toUpperCase();

  if (rawStatus === 'COMPLETED') {
    const results = record.verification_results;
    if (!results || results.length === 0 || !results[0]) {
      return { gateState: 'COMPLETED_NO_RESULT' };
    }
    const verdict = results[0].verdict;
    if (!isCanonicalVerdict(verdict)) {
      return { gateState: 'COMPLETED_INVALID_VERDICT' };
    }
    return { gateState: 'COMPLETED_REPORT', canonicalVerdict: verdict };
  }

  if (rawStatus === 'QUEUED') {
    return { gateState: 'QUEUED' };
  }

  if (rawStatus === 'PROCESSING') {
    return { gateState: 'PROCESSING' };
  }

  if (rawStatus === 'FAILED') {
    return { gateState: 'FAILED' };
  }

  return { gateState: 'STATUS_UNAVAILABLE' };
}

export interface SafeFailureInfo {
  headline: string;
  message: string;
  instruction: string;
}

/**
 * Resolves safe, citizen-friendly failure explanations without leaking sensitive metadata
 * (e.g. database error traces, connection strings, auth tokens, or filesystem paths).
 */
export function resolveSafeFailureInfo(record: VerificationDetailRecord): SafeFailureInfo {
  const reason = (record.failure_reason || '').trim().toUpperCase();

  if (reason === 'QUOTA_EXHAUSTED' || reason === 'RATE_LIMIT_EXCEEDED') {
    return {
      headline: 'Search Quota Temporarily Reached',
      message:
        'The sovereign discovery search limit was temporarily reached while contacting official government directories.',
      instruction:
        'You may retry this verification check shortly, or verify another claim in the meantime.',
    };
  }

  if (reason === 'EMPTY_RESULTS' || reason === 'NO_SOURCES_FOUND') {
    return {
      headline: 'No Official Government Records Found',
      message:
        'Automated source discovery searched sovereign domains (.gov.in, .nic.in, PIB) but did not locate matching official records or gazettes.',
      instruction:
        'Try verifying with the specific ministry name, official scheme title, or submitting an uploaded document.',
    };
  }

  if (reason === 'UNREADABLE_DOCUMENT' || reason === 'DOCUMENT_EXTRACTION_FAILED') {
    return {
      headline: 'Document Could Not Be Processed',
      message:
        'The submitted document could not be read clearly or contained no verifiable factual statements.',
      instruction:
        'Please verify using a clear PDF or image scan of the official circular or gazette notification.',
    };
  }

  if (reason === 'TIMEOUT' || reason === 'GATEWAY_TIMEOUT') {
    return {
      headline: 'Verification Request Timed Out',
      message:
        'One or more official government endpoints took too long to respond during evidence discovery.',
      instruction:
        'Please retry your verification check now.',
    };
  }

  // Inspect error_message for safe, sanitized text (strictly preventing leaks)
  if (record.error_message && typeof record.error_message === 'string') {
    const raw = record.error_message.trim();
    const lower = raw.toLowerCase();
    const isSensitive =
      lower.includes('supabase') ||
      lower.includes('postgres') ||
      lower.includes('select ') ||
      lower.includes('from ') ||
      lower.includes('where ') ||
      lower.includes('apikey') ||
      lower.includes('secret') ||
      lower.includes('token') ||
      lower.includes('stack') ||
      lower.includes('at /') ||
      lower.includes('at c:\\') ||
      lower.includes('node_modules') ||
      lower.includes('syntaxerror') ||
      lower.includes('error:');

    if (!isSensitive && raw.length > 0 && raw.length <= 160) {
      return {
        headline: 'Verification Issue Encountered',
        message: raw,
        instruction:
          'Please retry verifying this claim or contact citizen support if the problem persists.',
      };
    }
  }

  // Safe neutral fallback instruction
  return {
    headline: 'Verification Could Not Be Completed',
    message:
      'Verification could not be completed against official sovereign records at this time.',
    instruction:
      'Please retry verifying this claim or contact citizen support if this issue persists.',
  };
}

export interface VerificationResultDetailProps {
  recordId?: string;
  initialRecord?: VerificationDetailRecord | null;
  initialLoading?: boolean;
  initialError?: string | null;
  onNavigate?: (to: string) => void;
}

export const VerificationResultDetail: React.FC<VerificationResultDetailProps> = ({
  recordId: propsRecordId,
  initialRecord = null,
  initialLoading = false,
  initialError = null,
  onNavigate: propsOnNavigate,
}) => {
  // Safe context resolution with graceful test fallback
  let authContext: ReturnType<typeof useAuth> | null = null;
  try {
    authContext = useAuth();
  } catch {
    // Isolated testing environment
  }

  let routerContext: ReturnType<typeof useRouter> | null = null;
  try {
    routerContext = useRouter();
  } catch {
    // Isolated testing environment
  }

  const token = authContext?.token || null;
  const authIsLoading = authContext?.isLoading || false;

  const navigate = useCallback(
    (to: string) => {
      if (propsOnNavigate) {
        propsOnNavigate(to);
        return;
      }
      if (routerContext?.navigate) {
        routerContext.navigate(to);
        return;
      }
      if (typeof window !== 'undefined') {
        window.location.href = to;
      }
    },
    [propsOnNavigate, routerContext]
  );

  const activeRecordId = propsRecordId || routerContext?.params?.id || '';

  const [record, setRecord] = useState<VerificationDetailRecord | null>(initialRecord);
  const [error, setError] = useState<string | null>(initialError);
  const [isLoading, setIsLoading] = useState<boolean>(
    initialError ? false : (initialRecord ? false : (initialLoading || !initialRecord))
  );
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  const fetchRecord = useCallback(async () => {
    if (!activeRecordId) return;

    // If initialRecord is supplied and we are not refreshing, preserve it
    if (initialRecord && !isRefreshing && record === initialRecord) {
      setIsLoading(false);
      return;
    }

    if (!isRefreshing) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Check for guest token in search params if available
      const searchToken = routerContext?.searchParams?.get('token');
      if (searchToken) {
        headers['X-Guest-Token'] = searchToken;
      }

      const res = await safeFetchJson<{ data: any }>(`/api/v1/verify/${activeRecordId}`, {
        headers,
      });

      if (!res.ok) {
        if (res.status === 403) {
          throw new Error('You do not have authorization to view this verification record.');
        }
        if (res.status === 404) {
          throw new Error('Verification record not found or has been deleted.');
        }
        throw new Error(res.error || 'Failed to load verification record.');
      }

      setRecord(res.data?.data);
    } catch (err: any) {
      setError(err.message || 'Error loading report.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeRecordId, token, routerContext?.searchParams, initialRecord, isRefreshing, record]);

  useEffect(() => {
    if (initialRecord) {
      setRecord(initialRecord);
      setIsLoading(false);
      return;
    }
    if (!authIsLoading && activeRecordId) {
      fetchRecord();
    }
  }, [activeRecordId, authIsLoading, initialRecord]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRecord();
  };

  const handleCopyId = async () => {
    if (!record?.id) return;
    try {
      await navigator.clipboard.writeText(record.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleRetryVerification = () => {
    if (!record?.original_claim) {
      navigate('/app/verify');
      return;
    }
    navigate(`/app/verify?claim=${encodeURIComponent(record.original_claim)}`);
  };

  // ============================================================================
  // 1. LOADING SKELETON STATE
  // ============================================================================
  if (isLoading) {
    return (
      <div className="p-8 space-y-4 max-w-4xl mx-auto" data-testid="status-gate-loading">
        <div className="h-6 w-44 bg-[#E1E7EF] rounded-lg animate-pulse" />
        <div className="h-32 bg-white border border-[#E1E7EF] rounded-2xl animate-pulse" />
        <div className="h-64 bg-white border border-[#E1E7EF] rounded-2xl animate-pulse" />
      </div>
    );
  }

  // ============================================================================
  // 2. ERROR OR MISSING RECORD STATE
  // ============================================================================
  if (error || !record) {
    return (
      <div
        className="p-10 text-center max-w-md mx-auto space-y-4 bg-white rounded-2xl border border-[#E1E7EF] shadow-xs my-8"
        data-testid="status-gate-error"
      >
        <div className="w-12 h-12 mx-auto rounded-full bg-[#FEF3F2] text-[#B42318] flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold text-[#172B4D]">Report Unavailable</h2>
        <p className="text-xs text-[#526176] leading-relaxed">
          {error || 'The requested verification record could not be found.'}
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/history')}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-[#E1E7EF] text-[#172B4D] hover:bg-[#F0F4F9] transition-colors"
          >
            Back to History
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Retrying...' : 'Retry'}</span>
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 3. EVALUATE STATUS GATE
  // ============================================================================
  const { gateState, canonicalVerdict } = evaluateVerificationGate(record);
  const result = record.verification_results?.[0];

  // ============================================================================
  // 4. ELIGIBLE COMPLETED REPORT VIEW
  // Only rendered when status === COMPLETED, result exists, and verdict is canonical
  // ============================================================================
  if (gateState === 'COMPLETED_REPORT' && canonicalVerdict && result) {
    const subclaims = (record.claims || []).map((c) => ({
      id: c.id,
      statement: c.claim_text,
      verdict: canonicalVerdict,
    }));

    const evidence = (record.evidence || []).map((ev) => ({
      id: ev.id,
      extractedText: ev.extracted_text,
      sourceTitle: ev.sources?.title || 'Official Government Notification',
      sourceUrl: ev.sources?.url || '',
      domain: ev.sources?.domain || 'gov.in',
      issuingAuthority: ev.sources?.issuing_authority,
      publicationDate: ev.sources?.publication_date,
      sourceType: ev.sources?.source_type,
      relationship: 'SUPPORTS',
    }));

    // Legitimate explanation from persisted record, falling back only to the standard citizen statement
    const citizenVerdict = getCitizenVerdict(canonicalVerdict);
    const validExplanation = result.explanation && result.explanation.trim()
      ? result.explanation.trim()
      : citizenVerdict.statement;

    return (
      <VerificationResultView
        requestId={record.id}
        originalClaim={record.original_claim}
        verdict={canonicalVerdict}
        confidence={result.confidence}
        explanation={validExplanation}
        createdAt={record.created_at}
        completedAt={result.completed_at}
        breadcrumbParent={{ label: 'History', href: '/app/history' }}
        subclaims={subclaims}
        evidence={evidence}
      />
    );
  }

  // ============================================================================
  // 5. DISTINCT STATUS GATED VIEWS (QUEUED, PROCESSING, FAILED, INTEGRITY ERRORS)
  // None of these states fabricate a verdict or display false completion messages.
  // ============================================================================
  const formattedDate = record.created_at
    ? new Date(record.created_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <div
      className="space-y-6 max-w-4xl mx-auto pb-12 print:max-w-none"
      data-testid={`status-gate-${gateState.toLowerCase()}`}
    >
      {/* 5.1. BREADCRUMB & VIEW HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E1E7EF]">
        <div className="space-y-1">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#526176]">
            <Link href="/app" className="hover:text-[#2457C5] transition-colors">
              Dashboard
            </Link>
            <span>/</span>
            <Link href="/app/history" className="hover:text-[#2457C5] transition-colors">
              History
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#172B4D]">
              {gateState === 'QUEUED'
                ? 'Queued'
                : gateState === 'PROCESSING'
                ? 'Processing'
                : gateState === 'FAILED'
                ? 'Failed'
                : 'Status Notice'}
            </span>
          </nav>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#172B4D]">
            Verification Status
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => navigate('/app/history')}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-white border border-[#E1E7EF] text-[#344054] hover:bg-[#F0F4F9] transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#526176]" />
            <span>Back to History</span>
          </button>

          {(gateState === 'QUEUED' || gateState === 'PROCESSING') && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Checking...' : 'Check Status'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 5.2. STATUS HERO CARD */}
      {gateState === 'QUEUED' && (
        <div className="bg-white rounded-2xl border border-[#D1E9FF] shadow-xs p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EAF1FF] text-[#2457C5] border border-[#D1E9FF]">
              <Clock className="w-3.5 h-3.5 text-[#2457C5]" />
              <span>Verification Waiting to Start</span>
            </span>
            <span className="text-xs text-[#526176] font-semibold tracking-wide">
              Status: QUEUED
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[#172B4D]">
            Claim Queued for Sovereign Analysis
          </h2>

          <p className="text-xs sm:text-sm text-[#475467] leading-relaxed">
            Your verification request has been securely recorded and is waiting in the processing queue.
            Once execution starts, official government gazettes, ministry portals (.gov.in, .nic.in), and
            the Press Information Bureau will be searched to retrieve grounded evidence.
          </p>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E1E7EF] text-xs text-[#526176] leading-relaxed">
            <strong className="text-[#172B4D]">Civic Integrity Guarantee:</strong> In accordance with
            GovVerify AI standards, no preliminary or simulated verdict is rendered while a request is queued.
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Checking...' : 'Check Status Now'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/verify')}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white border border-[#E1E7EF] text-[#344054] hover:bg-[#F0F4F9] transition-colors flex items-center gap-1.5"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#526176]" />
              <span>Verify Another Claim</span>
            </button>
          </div>
        </div>
      )}

      {gateState === 'PROCESSING' && (
        <div className="bg-white rounded-2xl border border-[#D1E9FF] shadow-xs p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EAF1FF] text-[#2457C5] border border-[#D1E9FF]">
              <Loader2 className="w-3.5 h-3.5 text-[#2457C5] animate-spin" />
              <span>Verification in Progress</span>
            </span>
            <span className="text-xs text-[#2457C5] font-semibold tracking-wide">
              Status: PROCESSING
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[#172B4D]">
            Verification is Actively in Progress
          </h2>

          <p className="text-xs sm:text-sm text-[#475467] leading-relaxed">
            Our sovereign discovery engine is currently querying authoritative government domains (.gov.in, .nic.in, PIB)
            and cross-referencing published official notices. Once evidence retrieval and analytical comparison
            are completed, your full verification report will be displayed here.
          </p>

          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E1E7EF] text-xs text-[#526176] leading-relaxed">
            <strong className="text-[#172B4D]">Live Processing Notice:</strong> This inquiry has not completed yet.
            No verdict has been issued. Click &ldquo;Refresh Status&rdquo; to query the latest state.
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Checking...' : 'Refresh Status'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/history')}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white border border-[#E1E7EF] text-[#344054] hover:bg-[#F0F4F9] transition-colors"
            >
              Back to History
            </button>
          </div>
        </div>
      )}

      {gateState === 'FAILED' && (() => {
        const failureInfo = resolveSafeFailureInfo(record);
        return (
          <div className="bg-white rounded-2xl border border-[#FECDCA] shadow-xs p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]">
                <AlertTriangle className="w-3.5 h-3.5 text-[#B42318]" />
                <span>Verification Could Not Be Completed</span>
              </span>
              <span className="text-xs text-[#B42318] font-semibold tracking-wide">
                Status: FAILED
              </span>
            </div>

            <h2 className="text-lg sm:text-xl font-bold text-[#172B4D]">
              {failureInfo.headline}
            </h2>

            <p className="text-xs sm:text-sm text-[#475467] leading-relaxed">
              {failureInfo.message}
            </p>

            <div className="p-3.5 rounded-xl bg-[#FEF3F2]/60 border border-[#FECDCA] text-xs text-[#B42318] leading-relaxed">
              <strong>Next Steps:</strong> {failureInfo.instruction}
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleRetryVerification}
                className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white transition-colors flex items-center gap-1.5 shadow-2xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retry Verification</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/app/history')}
                className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white border border-[#E1E7EF] text-[#344054] hover:bg-[#F0F4F9] transition-colors"
              >
                Back to History
              </button>
            </div>
          </div>
        );
      })()}

      {gateState === 'COMPLETED_NO_RESULT' && (
        <div className="bg-white rounded-2xl border border-[#FEDF89] shadow-xs p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF7C3] text-[#B54708] border border-[#FEDF89]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#B54708]" />
              <span>Result Unavailable (Integrity Notice)</span>
            </span>
            <span className="text-xs text-[#B54708] font-semibold tracking-wide">
              Status: COMPLETED (Missing Result)
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[#172B4D]">
            Verification Result Unavailable
          </h2>

          <p className="text-xs sm:text-sm text-[#475467] leading-relaxed">
            This verification request is recorded as completed in the database, but no verified analytical
            verdict record is attached. To preserve strict civic audit standards, unverified claims are never fabricated or simulated.
          </p>

          <div className="p-3.5 rounded-xl bg-[#FFFAEB] border border-[#FEDF89] text-xs text-[#B54708] leading-relaxed">
            <strong>Civic Integrity Safeguard:</strong> Unverified claims are never substituted with default
            verdicts. You may re-run verification for this statement to generate a complete, grounded report.
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRetryVerification}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Verify Statement Again</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/history')}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white border border-[#E1E7EF] text-[#344054] hover:bg-[#F0F4F9] transition-colors"
            >
              Back to History
            </button>
          </div>
        </div>
      )}

      {gateState === 'COMPLETED_INVALID_VERDICT' && (
        <div className="bg-white rounded-2xl border border-[#FEDF89] shadow-xs p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF7C3] text-[#B54708] border border-[#FEDF89]">
              <ShieldAlert className="w-3.5 h-3.5 text-[#B54708]" />
              <span>Integrity Error (Invalid Verdict)</span>
            </span>
            <span className="text-xs text-[#B54708] font-semibold tracking-wide">
              Status: COMPLETED (Invalid Format)
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[#172B4D]">
            Unrecognized Verdict Format
          </h2>

          <p className="text-xs sm:text-sm text-[#475467] leading-relaxed">
            The attached verification result does not match an approved canonical verdict. GovVerify AI reports
            strictly require one of the four sovereign standards:
            <strong className="text-[#172B4D]"> Supported, Partly True / Conditional, Contradicted,</strong> or
            <strong className="text-[#172B4D]"> Insufficient Evidence</strong>.
          </p>

          <div className="p-3.5 rounded-xl bg-[#FFFAEB] border border-[#FEDF89] text-xs text-[#B54708] leading-relaxed">
            <strong>Audit Protection:</strong> Non-canonical verdict entries cannot be displayed to citizens.
            Please submit this claim again to obtain an audited evaluation.
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRetryVerification}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-verify Claim</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/history')}
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-white border border-[#E1E7EF] text-[#344054] hover:bg-[#F0F4F9] transition-colors"
            >
              Back to History
            </button>
          </div>
        </div>
      )}

      {gateState === 'STATUS_UNAVAILABLE' && (
        <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 sm:p-8 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#F2F4F7] text-[#475467] border border-[#EAECF0]">
              <HelpCircle className="w-3.5 h-3.5 text-[#475467]" />
              <span>Status Unavailable</span>
            </span>
            <span className="text-xs text-[#667085] font-semibold tracking-wide">
              Status: {record.status || 'UNKNOWN'}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-[#172B4D]">
            Verification Status Unavailable
          </h2>

          <p className="text-xs sm:text-sm text-[#475467] leading-relaxed">
            This verification record is currently in an unconfirmed status ({record.status || 'Unknown'}).
            A verified citizen report cannot be presented until the request reaches a validated completion state.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/app/history')}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-white border border-[#E1E7EF] text-[#344054] hover:bg-[#F0F4F9] transition-colors"
            >
              Back to History
            </button>
            <button
              type="button"
              onClick={() => navigate('/app/verify')}
              className="px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white transition-colors"
            >
              Verify New Claim
            </button>
          </div>
        </div>
      )}

      {/* 5.3. SUBMITTED STATEMENT CARD */}
      <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 space-y-4">
        <div className="flex items-center justify-between gap-2 border-b border-[#E1E7EF] pb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#526176]">
            Submitted Statement
          </span>
          <span className="text-xs font-medium text-[#667085]">
            Input Type: {record.input_type || 'CLAIM'}
          </span>
        </div>

        <blockquote className="text-base sm:text-lg font-semibold text-[#172B4D] leading-relaxed italic border-l-4 border-[#2457C5] pl-4 py-1">
          &ldquo;{record.original_claim}&rdquo;
        </blockquote>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#667085] border-t border-[#F0F4F9]">
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#526176]">Request ID:</span>
            <code className="font-mono text-[11px] bg-[#F0F4F9] text-[#172B4D] px-2 py-0.5 rounded border border-[#E1E7EF]">
              {record.id}
            </code>
            <button
              type="button"
              onClick={handleCopyId}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#2457C5] hover:text-[#1D46A6]"
              title="Copy Request ID"
            >
              {copiedId ? (
                <>
                  <Check className="w-3 h-3 text-[#027A48]" />
                  <span className="text-[#027A48]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          {formattedDate && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-[#667085]" />
              <span>Submitted on {formattedDate}</span>
            </div>
          )}
        </div>
      </div>

      {/* 5.4. METHODOLOGY & CIVIC AUDIT REASSURANCE */}
      <div className="bg-[#F8FAFC] rounded-2xl border border-[#E1E7EF] p-6 flex flex-col sm:flex-row items-start gap-4 text-xs text-[#526176] leading-relaxed">
        <div className="w-9 h-9 rounded-xl bg-[#EAF1FF] text-[#2457C5] flex items-center justify-center shrink-0">
          <ShieldAlert className="w-5 h-5 text-[#2457C5]" />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-[#172B4D] text-sm">
            Civic Verification Integrity Standards
          </h4>
          <p>
            GovVerify AI strictly gates report access to requests with verified sovereign citations.
            Incomplete, queued, processing, or failed submissions are never decorated with fabricated verdicts.
            Every completed check reflects real gazette and portal findings.
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerificationResultDetail;
