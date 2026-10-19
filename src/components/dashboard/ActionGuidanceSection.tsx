/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Verify & Take Action Component (Phase 6: Personalized Government Scheme Guidance)
 * Renders verified official next steps, validated sovereign portal links,
 * contextual scheme guidance prompt, source-grounded scheme guide,
 * non-invasive preliminary eligibility questionnaire, and application checklist.
 */

import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  ShieldCheck,
  CheckSquare,
  Square,
  HelpCircle,
  AlertTriangle,
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Phone,
  Mail,
  Globe,
  Info,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
  BookOpen,
  MapPin,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import {
  ActionGuidance,
  EligibilityEvaluationResult,
  EligibilityVerdictCategory,
} from '../../server/services/actionGuidance';
import { fetchJsonOrThrow } from '../../utils/safeFetch';

interface ActionGuidanceSectionProps {
  requestId: string;
  originalClaim: string;
  verdict: string;
  guestToken?: string;
}

export const ActionGuidanceSection: React.FC<ActionGuidanceSectionProps> = ({
  requestId,
  originalClaim,
  verdict,
  guestToken,
}) => {
  const [guidance, setGuidance] = useState<ActionGuidance | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Phase 6: Scheme Exploration Prompt States
  const [isSchemeExplored, setIsSchemeExplored] = useState(false);
  const [isSchemeDismissed, setIsSchemeDismissed] = useState(false);
  const [applicationModeTab, setApplicationModeTab] = useState<'online' | 'offline'>('online');

  // Questionnaire state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [evaluationResult, setEvaluationResult] = useState<EligibilityEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Checklist local persistence
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});

  // Active follow-up tab
  const [activeFollowUpKey, setActiveFollowUpKey] = useState<string>('check_eligibility');

  // Load checklist state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`govverify_checklist_${requestId}`);
      if (stored) {
        setCompletedTasks(JSON.parse(stored));
      }
    } catch {
      // Ignore storage errors
    }
  }, [requestId]);

  // Toggle checklist item
  const toggleTask = (taskId: string) => {
    setCompletedTasks((prev) => {
      const updated = { ...prev, [taskId]: !prev[taskId] };
      try {
        localStorage.setItem(`govverify_checklist_${requestId}`, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  // Fetch Action Guidance from API
  useEffect(() => {
    let isMounted = true;

    async function fetchGuidance() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const headers: Record<string, string> = {};
        const authToken = localStorage.getItem('govverify_auth_token');
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }
        if (guestToken) {
          headers['X-Guest-Token'] = guestToken;
        }

        const json = await fetchJsonOrThrow<{ data?: any }>(
          `/api/v1/verify/${requestId}/action-guidance`,
          { headers }
        );

        if (isMounted && json.data) {
          setGuidance(json.data);
          if (json.data.followUpActions && json.data.followUpActions.length > 0) {
            setActiveFollowUpKey(json.data.followUpActions[0].key);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setLoadError(err.message || 'Could not load action guidance.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (requestId) {
      fetchGuidance();
    }

    return () => {
      isMounted = false;
    };
  }, [requestId, guestToken]);

  // Evaluate Questionnaire answers
  const handleEvaluateQuestionnaire = async () => {
    if (!guidance || guidance.eligibilityCriteria.length === 0) return;

    setIsEvaluating(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const authToken = localStorage.getItem('govverify_auth_token');
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }
      if (guestToken) {
        headers['X-Guest-Token'] = guestToken;
      }

      const json = await fetchJsonOrThrow<{ success?: boolean; evaluation?: any }>(
        `/api/v1/verify/${requestId}/action-guidance/evaluate-eligibility`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ answers: selectedAnswers }),
        }
      );
      if (json.success && json.evaluation) {
        setEvaluationResult(json.evaluation);
      }
    } catch {
      // Fallback: evaluate client-side deterministically if API call fails
      const matching: any[] = [];
      const unmatching: any[] = [];
      const unknown: any[] = [];

      for (const crit of guidance.eligibilityCriteria) {
        const answer = selectedAnswers[crit.id];
        if (!answer) {
          unknown.push({ id: crit.id, title: crit.title, note: 'Not answered yet' });
        } else {
          const opt = crit.options.find((o) => o.value === answer);
          if (opt?.isEligibleMatch) {
            matching.push({ id: crit.id, title: crit.title, note: opt.explanation });
          } else {
            unmatching.push({ id: crit.id, title: crit.title, note: opt?.explanation || 'Unmet condition' });
          }
        }
      }

      let cat: EligibilityVerdictCategory;
      let label = '';
      if (unmatching.length > 0) {
        cat = 'MAY_NOT_MEET_CONDITION';
        label = 'May not meet a listed condition';
      } else if (matching.length === guidance.eligibilityCriteria.length && guidance.eligibilityCriteria.length > 0) {
        cat = 'LIKELY_ELIGIBLE';
        label = 'Likely eligible based on your answers';
      } else {
        cat = 'CANNOT_DETERMINE';
        label = 'Cannot determine from the available information';
      }

      setEvaluationResult({
        category: cat,
        categoryLabel: label,
        matchingCriteria: matching,
        unmatchingCriteria: unmatching,
        unknownCriteria: unknown,
        overallGuidance: unmatching.length > 0
          ? 'Some documented criteria may not match your responses. Review official exceptions.'
          : 'Your preliminary responses match the core criteria.',
        disclaimer: 'Preliminary civic guidance, not an official determination.',
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 sm:p-8 bg-white rounded-2xl border border-[#E1E7EF] shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded-full border-2 border-[#2457C5] border-t-transparent animate-spin" />
          <h2 className="text-sm font-bold text-[#172B4D]">
            Checking official government services & scheme guidance...
          </h2>
        </div>
        <p className="text-xs text-[#526176]">
          Validating sovereign application portals, eligibility criteria, and required documents against primary gazettes.
        </p>
      </div>
    );
  }

  if (loadError || !guidance) {
    return (
      <div className="p-6 bg-white rounded-2xl border border-[#E1E7EF] text-xs text-[#526176] space-y-2">
        <div className="flex items-center gap-2 text-[#B54708] font-bold">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Action Guidance Notice</span>
        </div>
        <p>
          Action guidance is currently being formulated from verified gazettes. Always cross-check scheme requirements directly on sovereign government portals (.gov.in / .nic.in).
        </p>
      </div>
    );
  }

  const { service, checklist, eligibilityCriteria, followUpActions, detectedScheme, schemeGuide } = guidance;
  const isSupported = verdict === 'SUPPORTED';
  const isPartiallySupported = verdict === 'PARTIALLY_SUPPORTED';
  const isContradicted = verdict === 'CONTRADICTED';
  const isInsufficient = verdict === 'INSUFFICIENT_EVIDENCE';

  const completedCount = checklist.filter((item) => completedTasks[item.id]).length;

  // Meaningful scheme identified
  const hasMeaningfulScheme = Boolean(
    detectedScheme && detectedScheme.isMeaningfulConnection && schemeGuide
  );

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. CONTEXTUAL GUIDANCE PROMPT (Phase 6 Step 3) */}
      {/* ==================================================================== */}
      {hasMeaningfulScheme && detectedScheme && !isSchemeDismissed && (
        <div
          id="contextual-scheme-prompt"
          className="bg-gradient-to-r from-[#EBF1FF] to-[#F5F7FA] rounded-2xl border-2 border-[#2457C5]/30 p-6 sm:p-7 shadow-xs space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2457C5] text-white">
                  {detectedScheme.jurisdiction} JURISDICTION
                </span>
                <span className="text-xs font-semibold text-[#526176]">
                  {detectedScheme.administeringMinistryOrDepartment}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#172B4D]">
                Interested in {detectedScheme.officialSchemeName}?
              </h3>
              <p className="text-xs text-[#526176] leading-relaxed">
                We can explain eligibility, required documents, and how to apply based on verified official guidelines.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                id="explore-scheme-btn"
                onClick={() => setIsSchemeExplored((prev) => !prev)}
                className="py-2.5 px-5 bg-[#2457C5] hover:bg-[#1D46A6] active:bg-[#193B8C] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isSchemeExplored ? 'Hide Scheme Guide' : 'Explore Scheme'}</span>
                {isSchemeExplored ? <ChevronUp className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
              <button
                type="button"
                id="dismiss-scheme-btn"
                onClick={() => setIsSchemeDismissed(true)}
                className="py-2.5 px-4 bg-white hover:bg-[#F0F4F9] border border-[#D0D5DD] text-[#526176] hover:text-[#172B4D] text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dismissed indicator with option to re-open */}
      {hasMeaningfulScheme && detectedScheme && isSchemeDismissed && (
        <div className="px-4 py-2.5 bg-[#F0F4F9] rounded-xl border border-[#E1E7EF] flex items-center justify-between text-xs text-[#526176]">
          <span>Scheme guidance dismissed ({detectedScheme.officialSchemeName}).</span>
          <button
            type="button"
            onClick={() => setIsSchemeDismissed(false)}
            className="font-bold text-[#2457C5] hover:underline"
          >
            Re-open Scheme Guide
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. SOURCE-GROUNDED SCHEME GUIDE (Phase 6 Step 4) */}
      {/* ==================================================================== */}
      {hasMeaningfulScheme && detectedScheme && schemeGuide && isSchemeExplored && (
        <div
          id="structured-scheme-guide-card"
          className="bg-white rounded-2xl border-2 border-[#2457C5]/40 shadow-sm overflow-hidden space-y-6"
        >
          {/* Header */}
          <div className="p-6 sm:p-7 border-b border-[#E1E7EF] bg-gradient-to-r from-[#F0F4F9] to-white space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#2457C5] text-white">
                  {detectedScheme.jurisdiction} GOVERNMENT SCHEME
                </span>
                {detectedScheme.alternativeNamesOrAbbreviations.length > 0 && (
                  <span className="text-xs text-[#526176]">
                    Also known as: <strong>{detectedScheme.alternativeNamesOrAbbreviations.join(', ')}</strong>
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#526176] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#2457C5]" />
                <span>Verified: {detectedScheme.lastSourceVerificationTimestamp.split('T')[0]}</span>
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-[#172B4D]">
              {detectedScheme.officialSchemeName}
            </h3>
            <p className="text-xs text-[#526176]">
              Administered by: <strong>{detectedScheme.administeringMinistryOrDepartment}</strong>
            </p>
          </div>

          <div className="px-6 sm:px-7 space-y-6">
            {/* Scheme Overview & Benefits Box */}
            <div className="p-5 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-3.5">
              <div>
                <span className="text-[10px] font-bold text-[#526176] uppercase tracking-wider block">
                  1. Scheme Overview
                </span>
                <p className="text-xs sm:text-sm text-[#172B4D] leading-relaxed mt-1">
                  {schemeGuide.schemeOverview}
                </p>
              </div>

              <div className="pt-2 border-t border-[#E1E7EF]">
                <span className="text-[10px] font-bold text-[#526176] uppercase tracking-wider block">
                  2. Benefits Provided & Verified Limits
                </span>
                <p className="text-xs text-[#172B4D] mt-1 leading-relaxed">
                  {schemeGuide.benefitsProvided.description}
                </p>
                {schemeGuide.benefitsProvided.verifiedLimits && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EBF1FF] border border-[#2457C5]/30 text-xs font-bold text-[#2457C5]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Verified Benefit Limit: {schemeGuide.benefitsProvided.verifiedLimits}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#E1E7EF] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#526176] uppercase block">
                    Official Fee
                  </span>
                  <p className="font-semibold text-[#172B4D] mt-0.5">
                    {schemeGuide.deadlinesFeesRenewal.fees || 'Free of cost on official portal'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#526176] uppercase block">
                    Enrollment Deadline
                  </span>
                  <p className="font-semibold text-[#172B4D] mt-0.5">
                    {schemeGuide.deadlinesFeesRenewal.deadline || 'Rolling enrollment throughout the year'}
                  </p>
                </div>
              </div>
            </div>

            {/* Application Instructions: Online vs Offline Tabs */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E7EF] pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#172B4D] flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#2457C5]" />
                  <span>Step-by-Step Application Instructions</span>
                </span>
                <div className="flex items-center gap-1 bg-[#F0F4F9] p-1 rounded-lg self-start sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setApplicationModeTab('online')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      applicationModeTab === 'online'
                        ? 'bg-[#2457C5] text-white shadow-xs'
                        : 'text-[#526176] hover:text-[#172B4D]'
                    }`}
                  >
                    Online Portal Steps
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplicationModeTab('offline')}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      applicationModeTab === 'offline'
                        ? 'bg-[#2457C5] text-white shadow-xs'
                        : 'text-[#526176] hover:text-[#172B4D]'
                    }`}
                  >
                    Offline / CSC Office Steps
                  </button>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-2.5">
                {applicationModeTab === 'online' ? (
                  <ol className="space-y-2 text-xs text-[#172B4D]">
                    {schemeGuide.applicationInstructions.onlineSteps?.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#2457C5] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <ol className="space-y-2 text-xs text-[#172B4D]">
                    {schemeGuide.applicationInstructions.offlineOfficeSteps?.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-[#526176] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            {/* Required Documents (Mandatory vs Conditional) */}
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[#172B4D] flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#2457C5]" />
                <span>Required Documents Checklist (Mandatory vs. Conditional)</span>
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {schemeGuide.requiredDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-xl border border-[#E1E7EF] bg-white shadow-2xs space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-[#172B4D] leading-tight">
                        {doc.name}
                      </span>
                      {doc.isMandatory ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA] shrink-0">
                          Mandatory
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EBF1FF] text-[#2457C5] border border-[#2457C5]/30 shrink-0">
                          Conditional
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#526176] leading-relaxed">
                      {doc.description}
                    </p>
                    {doc.conditionDescription && (
                      <p className="text-[10px] font-semibold text-[#2457C5] bg-[#F0F4F9] p-1.5 rounded">
                        Condition: {doc.conditionDescription}
                      </p>
                    )}
                    <span className="text-[10px] text-[#526176] block pt-0.5">
                      Issuing Authority: {doc.issuingAuthorityOrType}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Verified Official Links (Separate Information vs Application Portals) */}
            <div className="p-5 rounded-xl border border-[#2457C5]/30 bg-[#EBF1FF]/40 space-y-3.5">
              <span className="text-xs font-bold uppercase tracking-wider text-[#172B4D] flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-[#2457C5]" />
                <span>Official Source Portals & Validated Links</span>
              </span>

              <div className="flex flex-col sm:flex-row gap-3">
                {/* Information Portal */}
                <a
                  href={schemeGuide.verifiedInformationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 p-3.5 rounded-xl bg-white border border-[#2457C5]/30 hover:border-[#2457C5] transition-colors shadow-2xs flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-0.5 truncate">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#2457C5] block">
                      Verified Information Portal
                    </span>
                    <span className="text-xs font-bold text-[#172B4D] group-hover:text-[#2457C5] truncate block">
                      Official Scheme Guidelines & Overview
                    </span>
                  </div>
                  <ExternalLink className="w-4 h-4 text-[#2457C5] shrink-0" />
                </a>

                {/* Application Portal */}
                {schemeGuide.isApplicationUrlConfirmed && schemeGuide.verifiedApplicationUrl ? (
                  <a
                    href={schemeGuide.verifiedApplicationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 p-3.5 rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white transition-colors shadow-xs flex items-center justify-between gap-3 group"
                  >
                    <div className="space-y-0.5 truncate">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 block">
                        Verified Application Portal
                      </span>
                      <span className="text-xs font-bold truncate block">
                        Apply on Sovereign Portal
                      </span>
                    </div>
                    <ExternalLink className="w-4 h-4 shrink-0 text-white" />
                  </a>
                ) : (
                  <div className="flex-1 p-3 rounded-xl bg-[#FEF7C3] border border-[#FEDF89] text-[#B54708] text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Direct Application URL Not Confirmed</span>
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-95">
                      {schemeGuide.unverifiedApplicationNotice ||
                        'A direct online application link could not be independently confirmed. Consult the verified information portal for instructions.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Uncertainties, Missing Information, and Technical Limitations */}
            {schemeGuide.uncertaintiesAndLimitations.length > 0 && (
              <div className="p-4 rounded-xl border border-[#FEDF89] bg-[#FEF7C3]/60 space-y-1.5 text-xs text-[#B54708]">
                <div className="flex items-center gap-2 font-bold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Uncertainties & Operational Limitations</span>
                </div>
                <ul className="space-y-1 text-[11px] list-disc list-inside opacity-95">
                  {schemeGuide.uncertaintiesAndLimitations.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="p-4 bg-[#F5F7FA] border-t border-[#E1E7EF] text-[11px] text-[#526176] flex items-center justify-between">
            <span>GovVerify AI is an independent civic research platform and never charges fees or collects applications.</span>
            <button
              type="button"
              onClick={() => setIsSchemeExplored(false)}
              className="text-xs font-bold text-[#2457C5] hover:underline"
            >
              Minimize Guide
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. MAIN ACTION GUIDANCE HEADER & VERDICT-ALIGNED ADVISORY */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs overflow-hidden">
        {/* Section Heading Banner */}
        <div className="p-6 sm:p-7 border-b border-[#E1E7EF] bg-[#F5F7FA] space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2457C5]">
            <Layers className="w-4 h-4" />
            <span>Verify & Take Action</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#172B4D] tracking-tight">
            What Can You Do Next?
          </h2>
          <p className="text-xs text-[#526176]">
            Evidence-backed official guidance to help you navigate relevant government services safely.
          </p>
        </div>

        {/* Verdict-Aligned Advisory Box */}
        <div className="p-6 sm:p-7 space-y-5">
          <div
            className={`p-4 sm:p-5 rounded-xl border flex flex-col sm:flex-row sm:items-start gap-3.5 ${
              isSupported
                ? 'bg-[#EBFDF2] border-[#C6F5D5] text-[#0B7A48]'
                : isPartiallySupported
                ? 'bg-[#FEF7C3] border-[#FEDF89] text-[#B54708]'
                : isContradicted
                ? 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                : 'bg-[#F2F4F7] border-[#D0D5DD] text-[#344054]'
            }`}
          >
            <div className="p-2 rounded-lg bg-white/90 shrink-0 shadow-2xs">
              {isSupported && <CheckCircle2 className="w-5 h-5 text-[#0B7A48]" />}
              {isPartiallySupported && <AlertTriangle className="w-5 h-5 text-[#B54708]" />}
              {isContradicted && <XCircle className="w-5 h-5 text-[#B42318]" />}
              {isInsufficient && <HelpCircle className="w-5 h-5 text-[#344054]" />}
            </div>

            <div className="space-y-1.5 flex-1">
              <h3 className="text-sm font-bold tracking-tight">
                {guidance.verdictActionHeading}
              </h3>
              <p className="text-xs leading-relaxed opacity-95">
                {guidance.verdictActionSummary}
              </p>
            </div>
          </div>

          {/* Service Card */}
          {service && (
            <div className="p-5 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E7EF] pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-[#526176] uppercase tracking-wider block">
                    Public Service / Initiative
                  </span>
                  <h4 className="text-base font-bold text-[#172B4D]">
                    {service.schemeOrServiceName}
                  </h4>
                </div>
                {service.lastCheckedDate && (
                  <span className="text-[11px] text-[#526176] flex items-center gap-1 self-start sm:self-auto">
                    <Calendar className="w-3 h-3" />
                    <span>Last checked: {service.lastCheckedDate}</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-[#526176] uppercase block">
                    Nodal Ministry / Department
                  </span>
                  <p className="font-semibold text-[#172B4D] mt-0.5">
                    {service.departmentOrMinistry}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-[#526176] uppercase block">
                    Official Fee & Deadline
                  </span>
                  <p className="font-semibold text-[#172B4D] mt-0.5">
                    {service.applicationFees || 'Free on official portal'} • {service.applicationDeadline || 'Rolling enrollment'}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-[#526176] uppercase block">
                  Service Objective
                </span>
                <p className="text-xs text-[#172B4D] mt-0.5 leading-relaxed">
                  {service.shortDescription}
                </p>
              </div>

              {service.whoMayQualify.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold text-[#526176] uppercase block">
                    Target Beneficiaries / Who May Qualify
                  </span>
                  <ul className="space-y-1 text-xs text-[#172B4D]">
                    {service.whoMayQualify.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#2457C5] font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 4. OPTIONAL PERSONALIZED ELIGIBILITY QUESTIONNAIRE (Phase 6 Step 5) */}
      {/* ==================================================================== */}
      {eligibilityCriteria && eligibilityCriteria.length > 0 && !isContradicted && (
        <div
          id="eligibility-questionnaire-card"
          className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 sm:p-7 space-y-5"
        >
          <div className="border-b border-[#E1E7EF] pb-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2457C5]" />
              <h3 className="text-base font-bold text-[#172B4D]">
                Personalized Preliminary Eligibility Questionnaire
              </h3>
            </div>
            <p className="text-xs text-[#526176]">
              Answer the questions below based solely on published criteria to assess your match.
              GovVerify AI strictly rejects the collection of Aadhaar numbers, bank accounts, passwords, or OTPs.
            </p>
          </div>

          {/* Questionnaire Items */}
          <div className="space-y-4">
            {eligibilityCriteria.map((crit, idx) => (
              <div
                key={crit.id}
                className="p-4 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-[#2457C5] uppercase">
                      Criterion #{idx + 1}: {crit.title}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-[#172B4D]">
                      {crit.question}
                    </h4>
                  </div>
                </div>

                {crit.whyWeAsk && (
                  <p className="text-[11px] text-[#2457C5] bg-[#EBF1FF] p-2 rounded-lg font-medium">
                    <strong>Why we ask:</strong> {crit.whyWeAsk}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {crit.options.map((opt) => {
                    const isSelected = selectedAnswers[crit.id] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setSelectedAnswers((prev) => ({ ...prev, [crit.id]: opt.value }))
                        }
                        className={`text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                          isSelected
                            ? 'bg-[#EBF1FF] border-[#2457C5] text-[#2457C5] font-bold shadow-2xs'
                            : 'bg-white border-[#E1E7EF] text-[#172B4D] hover:bg-[#F0F4F9]'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {isSelected ? (
                          <CheckCircle2 className="w-4 h-4 text-[#2457C5] shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-[#D0D5DD] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <p className="text-[11px] text-[#526176] italic pt-1">
                  Official rule: {crit.officialRequirementDescription}
                </p>
              </div>
            ))}
          </div>

          {/* Evaluate Action */}
          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              id="evaluate-eligibility-btn"
              onClick={handleEvaluateQuestionnaire}
              disabled={isEvaluating || Object.keys(selectedAnswers).length === 0}
              className="py-2.5 px-5 bg-[#2457C5] hover:bg-[#1D46A6] active:bg-[#193B8C] disabled:bg-[#D0D5DD] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isEvaluating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating answers...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Check My Answers Against Documented Criteria</span>
                </>
              )}
            </button>

            <span className="text-[11px] text-[#526176]">
              Deterministic rule evaluation. Zero sensitive PII is collected or stored.
            </span>
          </div>

          {/* Evaluation Results Card (3-Category Classification) */}
          {evaluationResult && (
            <div
              id="questionnaire-evaluation-result"
              className="p-4 sm:p-5 rounded-xl border border-[#E1E7EF] bg-white space-y-3.5 shadow-2xs"
            >
              {/* Category Result Banner */}
              <div
                className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                  evaluationResult.category === 'LIKELY_ELIGIBLE'
                    ? 'bg-[#EBFDF2] border-[#C6F5D5] text-[#0B7A48]'
                    : evaluationResult.category === 'MAY_NOT_MEET_CONDITION'
                    ? 'bg-[#FEF7C3] border-[#FEDF89] text-[#B54708]'
                    : 'bg-[#F0F4F9] border-[#D0D5DD] text-[#344054]'
                }`}
              >
                {evaluationResult.category === 'LIKELY_ELIGIBLE' && (
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-[#0B7A48]" />
                )}
                {evaluationResult.category === 'MAY_NOT_MEET_CONDITION' && (
                  <AlertTriangle className="w-5 h-5 shrink-0 text-[#B54708]" />
                )}
                {evaluationResult.category === 'CANNOT_DETERMINE' && (
                  <HelpCircle className="w-5 h-5 shrink-0 text-[#344054]" />
                )}
                <div>
                  <h4 className="text-xs sm:text-sm font-bold">
                    {evaluationResult.categoryLabel}
                  </h4>
                  <p className="text-[11px] leading-relaxed opacity-95">
                    {evaluationResult.overallGuidance}
                  </p>
                </div>
              </div>

              {/* PII Warning if detected */}
              {evaluationResult.piiWarning && (
                <div className="p-3 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{evaluationResult.piiWarning}</span>
                </div>
              )}

              {/* Matching & Unmatching criteria */}
              <div className="space-y-2 text-xs pt-1">
                {evaluationResult.matchingCriteria.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 text-[#0B7A48]">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">{item.title}:</span> {item.note}
                    </div>
                  </div>
                ))}

                {evaluationResult.unmatchingCriteria.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 text-[#B42318]">
                    <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">{item.title}:</span> {item.note}
                    </div>
                  </div>
                ))}

                {evaluationResult.unknownCriteria.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 text-[#526176]">
                    <HelpCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">{item.title}:</span> {item.note}
                    </div>
                  </div>
                ))}
              </div>

              {/* Civic Notice */}
              <div className="p-2.5 rounded-lg bg-[#F0F4F9] text-[11px] text-[#526176] flex items-start gap-2">
                <Info className="w-3.5 h-3.5 shrink-0 text-[#2457C5] mt-0.5" />
                <span>
                  <strong>Civic Notice:</strong> {evaluationResult.disclaimer}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 5. APPLICATION CHECKLIST & REQUIRED DOCUMENTS */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E1E7EF] pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2457C5]" />
              <h3 className="text-base font-bold text-[#172B4D]">
                Application Checklist & Required Documents
              </h3>
            </div>
            <p className="text-xs text-[#526176]">
              Track your readiness locally before navigating to the official government portal.
            </p>
          </div>

          <div className="px-3 py-1 bg-[#F0F4F9] rounded-lg text-xs font-bold text-[#172B4D] self-start sm:self-auto">
            {completedCount} of {checklist.length} steps completed
          </div>
        </div>

        {/* Interactive Checklist */}
        <div className="space-y-2.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#526176] block">
            Step-by-Step Citizen Checklist
          </span>
          {checklist.map((item) => {
            const isDone = Boolean(completedTasks[item.id]);
            return (
              <div
                key={item.id}
                onClick={() => toggleTask(item.id)}
                className={`p-3.5 rounded-xl border transition-colors cursor-pointer flex items-start gap-3 ${
                  isDone
                    ? 'bg-[#EBFDF2] border-[#C6F5D5] text-[#0B7A48]'
                    : 'bg-[#F5F7FA] border-[#E1E7EF] hover:bg-white text-[#172B4D]'
                }`}
              >
                <div className="pt-0.5 shrink-0">
                  {isDone ? (
                    <CheckSquare className="w-4 h-4 text-[#0B7A48]" />
                  ) : (
                    <Square className="w-4 h-4 text-[#98A2B3]" />
                  )}
                </div>
                <div className="space-y-0.5 flex-1">
                  <div className={`text-xs font-bold ${isDone ? 'line-through opacity-80' : ''}`}>
                    {item.task}
                  </div>
                  {item.detail && (
                    <p className={`text-[11px] leading-relaxed ${isDone ? 'opacity-80' : 'text-[#526176]'}`}>
                      {item.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Required Documents Table */}
        {service?.requiredDocuments && service.requiredDocuments.length > 0 && (
          <div className="space-y-3 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#526176] block">
              Officially Documented Required Papers
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {service.requiredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3.5 rounded-xl border border-[#E1E7EF] bg-white shadow-2xs space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#172B4D] flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[#2457C5]" />
                      <span>{doc.name}</span>
                    </span>
                    {doc.isMandatory ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]">
                        Mandatory
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#F0F4F9] text-[#526176]">
                        If applicable
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#526176] leading-relaxed">
                    {doc.description}
                  </p>
                  <span className="text-[10px] text-[#526176] block pt-0.5">
                    Issuing Authority: {doc.issuingAuthorityOrType}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 6. OFFICIAL PORTAL, "CONTINUE" BUTTON & CONTACTS */}
      {/* ==================================================================== */}
      <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 sm:p-7 space-y-6">
        <div className="border-b border-[#E1E7EF] pb-3 space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2457C5]" />
            <h3 className="text-base font-bold text-[#172B4D]">
              Official Service Portal & Department Contacts
            </h3>
          </div>
          <p className="text-xs text-[#526176]">
            Access verified sovereign destination endpoints with explicit domain confirmation.
          </p>
        </div>

        {/* Portal Access Card */}
        {service?.isPortalVerified && service.officialPortalUrl ? (
          <div className="p-5 rounded-2xl border-2 border-[#2457C5]/30 bg-[#EBF1FF]/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2457C5] bg-white px-2 py-0.5 rounded border border-[#2457C5]/20 inline-block">
                  Verified Sovereign Endpoint
                </span>
                <h4 className="text-base font-bold text-[#172B4D]">
                  {service.portalTitle || 'Official Government Application Portal'}
                </h4>
                <p className="text-xs font-mono text-[#526176]">
                  Destination: {service.portalDomain || service.officialPortalUrl}
                </p>
              </div>

              {/* Continue to Official Website Button */}
              <a
                href={service.officialPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-6 bg-[#2457C5] hover:bg-[#1D46A6] active:bg-[#193B8C] text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 shrink-0 group"
              >
                <span>Continue to Official Website</span>
                <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </a>
            </div>

            <div className="pt-2 border-t border-[#2457C5]/15 text-[11px] text-[#526176] leading-relaxed space-y-1">
              <p>
                <strong>Security Notice:</strong> {service.destinationNotice}
              </p>
              <p className="text-[10px] text-[#526176]">
                GovVerify AI is an independent civic research platform. Applications, fees, and biometrics are never collected by GovVerify AI.
              </p>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-2">
            <div className="flex items-center gap-2 text-[#B54708] font-bold text-xs">
              <AlertTriangle className="w-4 h-4" />
              <span>Official application link not verified</span>
            </div>
            <p className="text-xs text-[#526176] leading-relaxed">
              No authenticated direct application URL on sovereign .gov.in or .nic.in infrastructure was confirmed for this specific claim. To prevent phishing or fraudulent intake forms, GovVerify AI does not present unverified links.
            </p>
          </div>
        )}

        {/* Department Grievance & Helpline Channels */}
        {service?.grievanceOrContact && (
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {service.grievanceOrContact.helplinePhone && (
              <div className="p-3.5 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-1">
                <span className="text-[10px] font-bold text-[#526176] uppercase flex items-center gap-1">
                  <Phone className="w-3 h-3 text-[#2457C5]" />
                  <span>Toll-Free Helpline</span>
                </span>
                <p className="font-semibold text-[#172B4D]">
                  {service.grievanceOrContact.helplinePhone}
                </p>
              </div>
            )}

            {service.grievanceOrContact.helplineEmail && (
              <div className="p-3.5 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-1">
                <span className="text-[10px] font-bold text-[#526176] uppercase flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#2457C5]" />
                  <span>Official Support Email</span>
                </span>
                <p className="font-semibold text-[#172B4D] truncate">
                  {service.grievanceOrContact.helplineEmail}
                </p>
              </div>
            )}

            {service.grievanceOrContact.grievancePortalUrl && (
              <div className="p-3.5 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-1">
                <span className="text-[10px] font-bold text-[#526176] uppercase flex items-center gap-1">
                  <Globe className="w-3 h-3 text-[#2457C5]" />
                  <span>Grievance Redressal</span>
                </span>
                <a
                  href={service.grievanceOrContact.grievancePortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#2457C5] hover:underline flex items-center gap-1"
                >
                  <span>{service.grievanceOrContact.grievancePortalName || 'Lodge Grievance'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 7. INTERACTIVE FOLLOW-UP ACTIONS */}
      {/* ==================================================================== */}
      {followUpActions && followUpActions.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 sm:p-7 space-y-5">
          <div className="border-b border-[#E1E7EF] pb-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2457C5]" />
              <h3 className="text-base font-bold text-[#172B4D]">
                Common Follow-Up Citizen Inquiries
              </h3>
            </div>
            <p className="text-xs text-[#526176]">
              Select a question below for specific answers derived from verified scheme rules.
            </p>
          </div>

          {/* Action Tabs */}
          <div className="flex flex-wrap gap-2">
            {followUpActions.map((action) => {
              const isActive = activeFollowUpKey === action.key;
              return (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => setActiveFollowUpKey(action.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#2457C5] text-white shadow-xs'
                      : 'bg-[#F0F4F9] text-[#526176] hover:bg-[#E1E7EF]'
                  }`}
                >
                  {action.label}
                </button>
              );
            })}
          </div>

          {/* Active Follow-up Content Card */}
          {(() => {
            const current = followUpActions.find((a) => a.key === activeFollowUpKey);
            if (!current) return null;

            return (
              <div className="p-5 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-3">
                <h4 className="text-xs sm:text-sm font-bold text-[#172B4D]">
                  {current.title}
                </h4>
                <p className="text-xs text-[#526176] leading-relaxed">
                  {current.summary}
                </p>

                <ul className="space-y-1.5 pt-1 text-xs text-[#172B4D]">
                  {current.detailedPoints.map((point, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#2457C5] font-bold">•</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                {current.officialSourceUrl && (
                  <div className="pt-2 flex items-center justify-between border-t border-[#E1E7EF] text-[11px]">
                    <span className="text-[#526176]">Verified Official Source:</span>
                    <a
                      href={current.officialSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#2457C5] hover:underline flex items-center gap-1"
                    >
                      <span>Open supporting portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Disclaimers Footer */}
      <div className="p-4 rounded-xl bg-white border border-[#E1E7EF] text-[11px] text-[#526176] space-y-1">
        {guidance.officialDisclaimers.map((disc, idx) => (
          <p key={idx} className="flex items-start gap-1.5">
            <span className="text-[#98A2B3]">•</span>
            <span>{disc}</span>
          </p>
        ))}
      </div>
    </div>
  );
};
