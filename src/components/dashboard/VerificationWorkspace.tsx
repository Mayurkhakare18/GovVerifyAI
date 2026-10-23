/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Citizen-Friendly Verification Workspace
 * Implements a civic-technology verification console with progressive reassurance,
 * plain-language verdicts, grounded evidence cards, and action guidance.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  Info,
  Loader2,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, Link } from '../../contexts/RouterContext';
import { VerificationResultView } from './VerificationResultView';
import { DocumentUploadReview } from '../common/DocumentUploadReview';
import { fetchJsonOrThrow, safeFetchJson } from '../../utils/safeFetch';

const EXAMPLE_SUGGESTIONS = [
  {
    category: 'Government Scheme',
    claim: 'Under PM-KISAN, eligible farmers receive direct income support of Rs 6,000 per year in three installments.',
  },
  {
    category: 'Public Announcement',
    claim: 'Ministry of Power announced that residential rooftop solar is completely free without registration or state portal approval.',
  },
  {
    category: 'Eligibility & Benefit',
    claim: 'Under PM-KUSUM 2025, individual farmers receive substantial subsidies for installing solar agriculture pumps.',
  },
  {
    category: 'Policy & Gazette',
    claim: 'Viral notice claims government has made Aadhaar biometric updates mandatory every six months for all citizens.',
  },
];

const CLAIM_CATEGORIES = [
  'All Categories',
  'Government Scheme & Subsidy',
  'Public Announcement & Circular',
  'Eligibility & Direct Benefit',
  'Policy, Gazette & Regulation',
  'Other Citizen Inquiry',
];

export const VerificationWorkspace: React.FC = () => {
  const { token } = useAuth();
  const { searchParams } = useRouter();

  // Mode Switcher State: 'text' vs 'document'
  const [activeMode, setActiveMode] = useState<'text' | 'document'>('text');

  // Input Form State
  const [claimText, setClaimText] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All Categories');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Workflow Progress States
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [stepMessage, setStepMessage] = useState<string>('');

  // Result & Error States
  const [verificationResult, setVerificationResult] = useState<any | null>(null);
  const [activeGuestToken, setActiveGuestToken] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Read URL query parameter for prefilling
  useEffect(() => {
    const claimParam = searchParams.get('claim');
    if (claimParam) {
      setClaimText(claimParam);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [searchParams]);

  // Primary Submission Workflow
  const handleVerifyClaim = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = claimText.trim();
    if (!trimmed) {
      setValidationError('Please enter a claim or question to verify.');
      return;
    }

    if (trimmed.length < 10) {
      setValidationError('Please enter a statement of at least 10 characters with specific details.');
      return;
    }

    if (trimmed.length > 2500) {
      setValidationError('Claim exceeds maximum allowable length of 2,500 characters.');
      return;
    }

    setValidationError(null);
    setServerError(null);
    setVerificationResult(null);
    setIsProcessing(true);

    try {
      // Step 1: Reviewing your claim
      setCurrentStep(1);
      setStepMessage('Reviewing your claim statement facts...');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // Submit intake request
      const intakeData = await fetchJsonOrThrow<{ id: string; guestToken?: string }>(
        '/api/v1/verify',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            claim: trimmed,
            inputType: 'CLAIM',
            skipDiscovery: true, // Orchestrate explicitly for transparent citizen progress
          }),
        }
      );

      const requestId = intakeData.id;
      const guestToken = intakeData.guestToken;
      setActiveGuestToken(guestToken || null);

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        requestHeaders['Authorization'] = `Bearer ${token}`;
      }
      if (guestToken) {
        requestHeaders['X-Guest-Token'] = guestToken;
      }

      // Step 2: Looking for reliable sources
      setCurrentStep(2);
      setStepMessage('Looking for reliable sources across official government domains and PIB...');

      const discoverData = await fetchJsonOrThrow<{ provider?: string }>(
        `/api/v1/verify/${requestId}/discover`,
        {
          method: 'POST',
          headers: requestHeaders,
        }
      );

      // Step 3: Comparing the available evidence
      setCurrentStep(3);
      setStepMessage('Comparing the available evidence against official gazettes and portals...');

      const verdictData = await fetchJsonOrThrow<{
        verdict: string;
        confidence: number;
        summaryExplanation: string;
        reasonExplanation?: any;
        subclaims: any[];
        citations: any[];
        limitation?: string;
      }>(`/api/v1/verify/${requestId}/verdict`, {
        method: 'POST',
        headers: requestHeaders,
      });

      // Step 4: Preparing your result
      setCurrentStep(4);
      setStepMessage('Preparing your citizen verification result...');

      // Fetch complete joined audit record
      const detailRes = await safeFetchJson<{ data: any }>(`/api/v1/verify/${requestId}`, {
        headers: requestHeaders,
      });

      if (detailRes.ok && detailRes.data) {
        setVerificationResult({
          ...detailRes.data.data,
          analysisVerdict: verdictData.verdict,
          analysisConfidence: verdictData.confidence,
          analysisSummary: verdictData.summaryExplanation,
          analysisReasonExplanation: verdictData.reasonExplanation,
          analysisSubclaims: verdictData.subclaims,
          analysisCitations: verdictData.citations,
          analysisLimitation: verdictData.limitation,
          provider: discoverData.provider || 'tavily',
        });
      } else {
        // Fallback with verdict data
        setVerificationResult({
          id: requestId,
          original_claim: trimmed,
          status: 'COMPLETED',
          analysisVerdict: verdictData.verdict,
          analysisConfidence: verdictData.confidence,
          analysisSummary: verdictData.summaryExplanation,
          analysisReasonExplanation: verdictData.reasonExplanation,
          analysisSubclaims: verdictData.subclaims,
          analysisCitations: verdictData.citations,
          analysisLimitation: verdictData.limitation,
          provider: discoverData.provider || 'tavily',
        });
      }
    } catch (err: any) {
      setServerError(
        err.message || 'We could not complete the verification check at this time. Please try again in a moment.'
      );
    } finally {
      setIsProcessing(false);
      setCurrentStep(0);
      setStepMessage('');
    }
  };

  const handleClear = () => {
    setClaimText('');
    setValidationError(null);
    setServerError(null);
    setVerificationResult(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Document Verification Workflow
  const handleConfirmDocumentClaim = async (
    confirmedClaim: string,
    documentId: string,
    guestToken?: string
  ) => {
    setValidationError(null);
    setServerError(null);
    setVerificationResult(null);
    setIsProcessing(true);

    try {
      setCurrentStep(1);
      setStepMessage('Registering verified claim from uploaded document...');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (guestToken) headers['X-Guest-Token'] = guestToken;

      const intakeData = await fetchJsonOrThrow<{ id: string; guestToken?: string }>(
        '/api/v1/verify',
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            claim: confirmedClaim,
            inputType: 'DOCUMENT',
            documentId,
            skipDiscovery: true, // Orchestrate explicitly for transparent citizen progress
          }),
        }
      );

      const requestId = intakeData.id;
      const finalGuestToken = intakeData.guestToken || guestToken;
      setActiveGuestToken(finalGuestToken || null);

      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) requestHeaders['Authorization'] = `Bearer ${token}`;
      if (finalGuestToken) requestHeaders['X-Guest-Token'] = finalGuestToken;

      // Step 2: Looking for reliable sources
      setCurrentStep(2);
      setStepMessage('Looking for reliable sources across official government domains and PIB...');

      const discoverData = await fetchJsonOrThrow<{ provider?: string }>(
        `/api/v1/verify/${requestId}/discover`,
        {
          method: 'POST',
          headers: requestHeaders,
        }
      );

      // Step 3: Comparing the available evidence
      setCurrentStep(3);
      setStepMessage('Comparing the available evidence against official gazettes and portals...');

      const verdictData = await fetchJsonOrThrow<{
        verdict: string;
        confidence: number;
        summaryExplanation: string;
        reasonExplanation?: any;
        subclaims: any[];
        citations: any[];
        limitation?: string;
      }>(`/api/v1/verify/${requestId}/verdict`, {
        method: 'POST',
        headers: requestHeaders,
      });

      // Step 4: Preparing your result
      setCurrentStep(4);
      setStepMessage('Preparing your citizen verification result...');

      const detailRes = await safeFetchJson<{ data: any }>(`/api/v1/verify/${requestId}`, {
        headers: requestHeaders,
      });

      if (detailRes.ok && detailRes.data) {
        const detailData = detailRes.data;
        setVerificationResult({
          ...detailData.data,
          analysisVerdict: verdictData.verdict,
          analysisConfidence: verdictData.confidence,
          analysisSummary: verdictData.summaryExplanation,
          analysisReasonExplanation: verdictData.reasonExplanation,
          analysisSubclaims: verdictData.subclaims,
          analysisCitations: verdictData.citations,
          analysisLimitation: verdictData.limitation,
          provider: discoverData.provider || 'tavily',
        });
      } else {
        setVerificationResult({
          id: requestId,
          original_claim: confirmedClaim,
          status: 'COMPLETED',
          analysisVerdict: verdictData.verdict,
          analysisConfidence: verdictData.confidence,
          analysisSummary: verdictData.summaryExplanation,
          analysisReasonExplanation: verdictData.reasonExplanation,
          analysisSubclaims: verdictData.subclaims,
          analysisCitations: verdictData.citations,
          analysisLimitation: verdictData.limitation,
          provider: discoverData.provider || 'tavily',
        });
      }
    } catch (err: any) {
      setServerError(
        err.message || 'We could not complete the verification check at this time. Please try again in a moment.'
      );
    } finally {
      setIsProcessing(false);
      setCurrentStep(0);
      setStepMessage('');
    }
  };

  // If a verification result is ready, display the redesigned result view
  if (verificationResult) {
    const subclaims = (verificationResult.analysisSubclaims || verificationResult.claims || []).map((sub: any) => ({
      id: sub.id,
      statement: sub.statement || sub.claim_text || String(sub),
      verdict: sub.verdict,
      explanation: sub.explanation,
    }));

    const evidence = (verificationResult.evidence || verificationResult.analysisCitations || []).map((e: any, idx: number) => {
      const src = e.sources || e;
      return {
        id: e.id || String(idx),
        extractedText: e.extracted_text || e.extractedText || e.excerpt || '',
        sourceTitle: src.title || src.sourceTitle || 'Official Sovereign Notification',
        sourceUrl: src.url || src.sourceUrl || '',
        domain: src.domain || (src.url ? new URL(src.url).hostname : 'gov.in'),
        issuingAuthority: src.issuing_authority || src.issuingAuthority,
        publicationDate: src.publication_date || src.publicationDate,
        relationship: e.relationship || 'SUPPORTS',
        sourceType: src.source_type || src.sourceType,
      };
    });

    return (
      <VerificationResultView
        requestId={verificationResult.id}
        originalClaim={verificationResult.original_claim || claimText}
        verdict={verificationResult.analysisVerdict || verificationResult.verification_results?.[0]?.verdict || 'INSUFFICIENT_EVIDENCE'}
        confidence={verificationResult.analysisConfidence ?? verificationResult.verification_results?.[0]?.confidence}
        explanation={verificationResult.analysisSummary || verificationResult.verification_results?.[0]?.explanation || ''}
        createdAt={verificationResult.created_at}
        completedAt={verificationResult.verification_results?.[0]?.completed_at}
        breadcrumbParent={{ label: 'Verify', href: '/app/verify' }}
        subclaims={subclaims}
        evidence={evidence}
        reasonExplanation={verificationResult.analysisReasonExplanation || verificationResult.reasonExplanation}
        limitation={verificationResult.analysisLimitation}
        guestToken={activeGuestToken || undefined}
        onNewVerification={handleClear}
        onRetry={() => handleVerifyClaim()}
        isRetrying={isProcessing}
      />
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 max-w-4xl mx-auto">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E1E7EF]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EBF1FF] border border-[#D0E1FD] text-[#2457C5] text-xs font-bold mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-[#2457C5]" />
            <span>Sovereign Fact Verification Console</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#172B4D] tracking-tight">
            Verify a Claim or Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#526176] mt-1 max-w-2xl">
            Check announcements, viral messages, or scheme rules against primary Indian government gazettes, nodal ministries, and PIB fact checks.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <Link
            href="/app/history"
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-[#E1E7EF] hover:bg-[#F0F4F9] text-[#172B4D] transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Clock className="w-3.5 h-3.5 text-[#526176]" />
            <span>Past Verifications</span>
          </Link>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex space-x-2 border-b border-[#E1E7EF] pb-1">
        <button
          type="button"
          onClick={() => setActiveMode('text')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
            activeMode === 'text'
              ? 'border-[#2457C5] text-[#2457C5] bg-white rounded-t-xl shadow-2xs'
              : 'border-transparent text-[#526176] hover:text-[#172B4D] hover:bg-white/60 rounded-t-xl'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Verify Claim Statement</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveMode('document')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 transition-colors ${
            activeMode === 'document'
              ? 'border-[#2457C5] text-[#2457C5] bg-white rounded-t-xl shadow-2xs'
              : 'border-transparent text-[#526176] hover:text-[#172B4D] hover:bg-white/60 rounded-t-xl'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload Document or Screenshot</span>
        </button>
      </div>

      {activeMode === 'text' ? (
        /* Main Verification Input Card */
        <div className="bg-white rounded-2xl border border-[#E1E7EF] p-6 sm:p-8 shadow-xs space-y-6">
          <form onSubmit={handleVerifyClaim} className="space-y-5">
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label htmlFor="claim-input" className="text-sm font-bold text-[#172B4D] flex items-center gap-2">
                  <span>What would you like to verify?</span>
                </label>

                {/* Optional Category Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#526176]">Category:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-2.5 py-1 text-xs bg-[#F5F7FA] border border-[#E1E7EF] rounded-lg text-[#172B4D] focus:outline-none focus:ring-1 focus:ring-[#2457C5]"
                  >
                    {CLAIM_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Large Accessible Textarea */}
              <div className="relative">
                <textarea
                  id="claim-input"
                  ref={textareaRef}
                  rows={4}
                  value={claimText}
                  onChange={(e) => {
                    setClaimText(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  disabled={isProcessing}
                  placeholder="Paste a viral message, enter a news headline, or ask about government eligibility rules..."
                  className="w-full p-4 text-sm text-[#172B4D] bg-[#F5F7FA] border border-[#E1E7EF] rounded-xl placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#2457C5] focus:bg-white transition-all disabled:opacity-60 resize-y"
                />
                <div className="flex items-center justify-between mt-1 text-[11px] text-[#526176]">
                  <span>Be as specific as possible regarding scheme names or dates.</span>
                  <span className={claimText.length > 2500 ? 'text-[#B42318] font-bold' : ''}>
                    {claimText.length} / 2,500
                  </span>
                </div>
              </div>

              {/* Validation Message */}
              {validationError && (
                <div className="p-3 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-xs font-semibold text-[#B42318] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}
            </div>

            {/* Privacy Notice */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-[#F5F7FA] border border-[#E1E7EF] text-xs text-[#526176]">
              <Info className="w-4 h-4 text-[#2457C5] shrink-0" />
              <span>
                <strong>Privacy Protection:</strong> Please avoid submitting Aadhaar numbers, passwords, bank account numbers, or personal identifying data.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleClear}
                disabled={isProcessing || !claimText}
                className="px-4 py-2.5 text-xs font-semibold text-[#526176] hover:text-[#172B4D] hover:bg-[#F0F4F9] rounded-xl transition-colors disabled:opacity-40"
              >
                Clear Text
              </button>

              <button
                type="submit"
                disabled={isProcessing || !claimText.trim()}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white text-sm font-bold shadow-xs hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2457C5] focus:ring-offset-2 disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Checking Sovereign Records...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-white" />
                    <span>Verify with GovVerify AI</span>
                    <ArrowRight className="w-4 h-4 text-white/80" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Helpful Examples Section */}
          <div className="pt-4 border-t border-[#E1E7EF] space-y-2.5">
            <span className="text-xs font-bold text-[#526176] uppercase tracking-wider block">
              Common Inquiries to Try:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAMPLE_SUGGESTIONS.map((ex, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setClaimText(ex.claim);
                    setValidationError(null);
                    if (textareaRef.current) {
                      textareaRef.current.focus();
                    }
                  }}
                  disabled={isProcessing}
                  className="p-3 text-left rounded-xl bg-[#F5F7FA] hover:bg-[#EBF1FF] border border-[#E1E7EF] hover:border-[#D0E1FD] text-xs text-[#172B4D] hover:text-[#2457C5] transition-all group disabled:opacity-50"
                >
                  <div className="font-bold text-[10px] text-[#2457C5] uppercase mb-1">
                    {ex.category}
                  </div>
                  <div className="line-clamp-2 leading-relaxed">"{ex.claim}"</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Document Upload & Claim Review Card */
        <div className="bg-white rounded-2xl border border-[#E1E7EF] p-6 sm:p-8 shadow-xs">
          <DocumentUploadReview
            onConfirmClaim={handleConfirmDocumentClaim}
            isVerifying={isProcessing}
            onManualEntryRequested={(suggestedText) => {
              setActiveMode('text');
              if (suggestedText) {
                setClaimText(suggestedText);
              }
            }}
          />
        </div>
      )}

      {/* Progress States (When checking) */}
      {isProcessing && (
        <div className="bg-white rounded-2xl border border-[#E1E7EF] p-6 sm:p-8 shadow-xs space-y-5 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#EBF1FF] text-[#2457C5] flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#172B4D]">Verifying Claim with Sovereign Evidence</h3>
              <p className="text-xs text-[#526176]">{stepMessage}</p>
            </div>
          </div>

          {/* 4 Citizen Steps */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2">
            {[
              { step: 1, title: 'Reviewing your claim', desc: 'Analyzing statement facts' },
              { step: 2, title: 'Looking for reliable sources', desc: 'Searching .gov.in & PIB' },
              { step: 3, title: 'Comparing the available evidence', desc: 'Checking retrieved records' },
              { step: 4, title: 'Preparing your result', desc: 'Synthesizing plain guidance' },
            ].map((st) => {
              const isPast = currentStep > st.step;
              const isCurrent = currentStep === st.step;

              return (
                <div
                  key={st.step}
                  className={`p-3 rounded-xl border text-xs transition-colors ${
                    isPast
                      ? 'bg-[#EBFDF2] border-[#C6F5D5] text-[#0B7A48]'
                      : isCurrent
                      ? 'bg-[#EBF1FF] border-[#D0E1FD] text-[#2457C5] font-bold ring-1 ring-[#2457C5]'
                      : 'bg-[#F5F7FA] border-[#E1E7EF] text-[#98A2B3]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    {isPast ? (
                      <CheckCircle className="w-3.5 h-3.5 text-[#0B7A48]" />
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">
                        {st.step}
                      </span>
                    )}
                    <span className="font-bold">{st.title}</span>
                  </div>
                  <p className="text-[10px] opacity-80">{st.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Server / Quota Error Banner */}
      {serverError && (
        <div className="bg-[#FEF3F2] border border-[#FECDCA] rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-3 text-[#B42318]">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <h3 className="text-sm font-bold">Verification Notice</h3>
          </div>
          <p className="text-xs text-[#B42318] leading-relaxed">{serverError}</p>
          <div className="pt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleVerifyClaim()}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-[#B42318] text-white hover:bg-[#912018] transition-colors"
            >
              Retry Check
            </button>
            <span className="text-xs text-[#526176]">
              No duplicate records are created when retrying.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
