/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Verify & Take Action Component (Phase 6: Personalized Government Scheme Guidance)
 * Renders verified official next steps, validated sovereign portal links,
 * contextual scheme guidance prompt, source-grounded scheme guide,
 * non-invasive preliminary eligibility questionnaire, and application checklist.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowLeft,
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
  Compass,
  FileCheck,
  Building,
} from 'lucide-react';
import {
  ActionGuidance,
  EligibilityEvaluationResult,
  EligibilityVerdictCategory,
  RoadmapStepId,
} from '../../server/services/actionGuidance';
import { fetchJsonOrThrow } from '../../utils/safeFetch';
import { useAuth } from '../../contexts/AuthContext';

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

  // Phase 6 & 7: Scheme Exploration Prompt & Stepper States
  const [isSchemeExplored, setIsSchemeExplored] = useState(false);
  const [isSchemeDismissed, setIsSchemeDismissed] = useState(false);
  const [applicationModeTab, setApplicationModeTab] = useState<'online' | 'offline'>('online');
  const [activeRoadmapStep, setActiveRoadmapStep] = useState<RoadmapStepId>('understand_scheme');
  const [completedRoadmapTasks, setCompletedRoadmapTasks] = useState<Record<string, boolean>>({});
  const [expandedWhereToObtain, setExpandedWhereToObtain] = useState<Record<string, boolean>>({});

  // Questionnaire state
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [evaluationResult, setEvaluationResult] = useState<EligibilityEvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Checklist local persistence
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});

  // Active follow-up tab
  const [activeFollowUpKey, setActiveFollowUpKey] = useState<string>('check_eligibility');

  // Load checklist & roadmap state from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`govverify_checklist_${requestId}`);
      if (stored) {
        setCompletedTasks(JSON.parse(stored));
      }
      const storedRoadmapTasks = localStorage.getItem(`govverify_roadmap_${requestId}_tasks`);
      if (storedRoadmapTasks) {
        setCompletedRoadmapTasks(JSON.parse(storedRoadmapTasks));
      }
      const storedStep = localStorage.getItem(`govverify_roadmap_${requestId}_step`);
      if (storedStep) {
        setActiveRoadmapStep(storedStep as RoadmapStepId);
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

  // Toggle roadmap task
  const toggleRoadmapTask = (taskId: string) => {
    setCompletedRoadmapTasks((prev) => {
      const updated = { ...prev, [taskId]: !prev[taskId] };
      try {
        localStorage.setItem(`govverify_roadmap_${requestId}_tasks`, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return updated;
    });
  };

  const handleStepChange = (newStep: RoadmapStepId) => {
    setActiveRoadmapStep(newStep);
    try {
      localStorage.setItem(`govverify_roadmap_${requestId}_step`, newStep);
    } catch {
      // Ignore
    }
  };

  const toggleWhereToObtain = (docId: string) => {
    setExpandedWhereToObtain((prev) => ({ ...prev, [docId]: !prev[docId] }));
  };

  // Safe context resolution with graceful test fallback
  let authContext: any = null;
  try {
    authContext = useAuth();
  } catch {
    // Isolated testing environment without AuthProvider
  }

  // Fetch Action Guidance from API (callable on mount or on retry)
  const fetchGuidance = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const headers: Record<string, string> = {};
      const authToken = authContext?.token || localStorage.getItem('govverify_auth_token') || null;
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

      if (json && json.data) {
        setGuidance(json.data);
        if (json.data.followUpActions && json.data.followUpActions.length > 0) {
          setActiveFollowUpKey(json.data.followUpActions[0].key);
        }
      } else {
        throw new Error('Action guidance data is currently unavailable.');
      }
    } catch (err: any) {
      setLoadError(err.message || 'Could not load action guidance.');
    } finally {
      setIsLoading(false);
    }
  }, [requestId, guestToken, authContext?.token]);

  useEffect(() => {
    if (requestId) {
      fetchGuidance();
    }
  }, [requestId, fetchGuidance]);

  // Evaluate Questionnaire answers
  const handleEvaluateQuestionnaire = async () => {
    if (!guidance || guidance.eligibilityCriteria.length === 0) return;

    setIsEvaluating(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const authToken = authContext?.token || localStorage.getItem('govverify_auth_token') || null;
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
      <div
        id="action-guidance-error-card"
        className="p-6 bg-white rounded-2xl border border-[#FECDCA] bg-[#FEF3F2]/40 shadow-xs space-y-3"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#B42318] font-bold">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">Action Guidance & Roadmap Notice</span>
          </div>
          <button
            type="button"
            id="retry-guidance-btn"
            onClick={() => fetchGuidance()}
            className="px-3.5 py-1.5 bg-[#2457C5] hover:bg-[#1D46A6] text-white text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Loading</span>
          </button>
        </div>
        <p className="text-xs text-[#526176] leading-relaxed">
          {loadError || 'Action guidance is currently being formulated from verified gazettes.'} Always cross-check scheme requirements directly on sovereign government portals (.gov.in / .nic.in).
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
  const hasRoadmap = Boolean(guidance.roadmap);
  const hasMeaningfulScheme = Boolean(
    (detectedScheme && detectedScheme.isMeaningfulConnection && (guidance.roadmap || schemeGuide)) ||
    hasRoadmap
  );
  const roadmap = guidance.roadmap;

  const ROADMAP_STEPS_METADATA: Array<{ id: RoadmapStepId; number: number; label: string; icon: any }> = [
    { id: 'understand_scheme', number: 1, label: '1. Understand', icon: Compass },
    { id: 'check_eligibility', number: 2, label: '2. Eligibility', icon: ShieldCheck },
    { id: 'prepare_documents', number: 3, label: '3. Documents', icon: FileText },
    { id: 'apply_online_offline', number: 4, label: '4. Apply', icon: BookOpen },
    { id: 'track_application', number: 5, label: '5. Track', icon: Clock },
    { id: 'follow_up_recourse', number: 6, label: '6. Follow-up', icon: HelpCircle },
  ];

  const currentStepIndex = ROADMAP_STEPS_METADATA.findIndex((s) => s.id === activeRoadmapStep);

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 1. CONTEXTUAL ROADMAP PROMPT (Phase 7 & 8: Context-Aware Roadmap Entry) */}
      {/* ==================================================================== */}
      {hasMeaningfulScheme && (roadmap || detectedScheme) && !isSchemeDismissed && (
        <div
          id="contextual-scheme-prompt"
          className={`rounded-2xl border-2 p-6 sm:p-7 shadow-xs space-y-4 ${
            isContradicted
              ? 'bg-gradient-to-r from-[#FEF3F2] to-[#FFF5F5] border-[#D92D20]/30'
              : isPartiallySupported
              ? 'bg-gradient-to-r from-[#FFFAEB] to-[#FFFDF5] border-[#F79009]/30'
              : isInsufficient
              ? 'bg-gradient-to-r from-[#F0F9FF] to-[#F5FBFF] border-[#0284C7]/30'
              : 'bg-gradient-to-r from-[#EBF1FF] to-[#F5F7FA] border-[#2457C5]/30'
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2457C5] text-white">
                  {roadmap?.stateOrUtName
                    ? `${(roadmap?.jurisdiction || detectedScheme?.jurisdiction)} SCHEME: ${roadmap.stateOrUtName.toUpperCase()}`
                    : detectedScheme?.stateOrUtName
                    ? `${(roadmap?.jurisdiction || detectedScheme?.jurisdiction)} SCHEME: ${detectedScheme.stateOrUtName.toUpperCase()}`
                    : `${(roadmap?.jurisdiction || detectedScheme?.jurisdiction)} JURISDICTION`}
                </span>
                {(roadmap?.isDynamicallyDiscovered || detectedScheme?.isDynamicallyDiscovered) && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#027A48] text-white flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Dynamically Discovered Scheme</span>
                  </span>
                )}
                {isContradicted ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#D92D20] text-white flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Refuted Statement Notice</span>
                  </span>
                ) : isPartiallySupported ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#B54708] text-white flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Conditional Prerequisites Apply</span>
                  </span>
                ) : isInsufficient ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#026AA2] text-white flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    <span>Unverified Claim Advisory</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#027A48] text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified Government Scheme</span>
                  </span>
                )}
                <span className="text-xs font-semibold text-[#526176]">
                  {roadmap?.ministryOrDepartment || detectedScheme?.administeringMinistryOrDepartment}
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[#172B4D]">
                {isContradicted
                  ? 'Officially Contradicted Statement: Protection & Reporting Roadmap'
                  : isPartiallySupported
                  ? 'Partially Supported Initiative: Review Prerequisites & Application Roadmap'
                  : isInsufficient
                  ? 'Unverified Statement: Official Guidance & Verification Directory'
                  : 'Interested in this scheme? Explore your application roadmap.'}
              </h3>
              <p className="text-xs text-[#526176] leading-relaxed">
                {isContradicted
                  ? 'This claim has been officially refuted by government records. Explore our 6-step protection roadmap to learn how to report suspected fraud, avoid unauthorized fees, and verify authentic gazettes.'
                  : isPartiallySupported
                  ? `Evidence confirms that ${roadmap?.officialSchemeName || detectedScheme?.officialSchemeName} exists, but crucial conditions and prerequisite rules apply. Explore the 6-step roadmap to review mandatory requirements before applying.`
                  : isInsufficient
                  ? 'Reliable sovereign records could not substantiate this claim. Explore verified directories and guidance steps to safely verify whether an official benefit exists.'
                  : `Evidence-grounded 6-step roadmap for ${roadmap?.officialSchemeName || detectedScheme?.officialSchemeName}. Check eligibility, assemble required documents, apply via verified portals, and track progress without third-party fees.`}
              </p>

              {/* 6-Step Visual Stepper Preview */}
              <div className="pt-2 grid grid-cols-2 sm:grid-cols-6 gap-2">
                {ROADMAP_STEPS_METADATA.map((step) => {
                  const StepIcon = step.icon;
                  return (
                    <div
                      key={step.id}
                      className="p-1.5 px-2 rounded-lg bg-white/80 border border-[#D0E1FD] text-[11px] text-[#2457C5] flex items-center gap-1.5 font-semibold"
                    >
                      <StepIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
              <button
                type="button"
                id="explore-scheme-btn"
                onClick={() => setIsSchemeExplored((prev) => !prev)}
                className="py-2.5 px-5 bg-[#2457C5] hover:bg-[#1D46A6] active:bg-[#193B8C] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>
                  {isSchemeExplored
                    ? 'Hide Roadmap'
                    : isContradicted
                    ? 'Explore Protection Roadmap (6 Steps)'
                    : 'Explore Scheme Application Roadmap (6 Steps)'}
                </span>
                {isSchemeExplored ? <ChevronUp className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
              <button
                type="button"
                id="dismiss-scheme-btn"
                onClick={() => setIsSchemeDismissed(true)}
                className="py-2.5 px-4 bg-white hover:bg-[#F0F4F9] border border-[#D0D5DD] text-[#526176] hover:text-[#172B4D] text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dismissed indicator with option to re-open */}
      {hasMeaningfulScheme && (roadmap || detectedScheme) && isSchemeDismissed && (
        <div className="px-4 py-2.5 bg-[#F0F4F9] rounded-xl border border-[#E1E7EF] flex items-center justify-between text-xs text-[#526176]">
          <span>Scheme application roadmap dismissed ({roadmap?.officialSchemeName || detectedScheme?.officialSchemeName}).</span>
          <button
            type="button"
            onClick={() => setIsSchemeDismissed(false)}
            className="font-bold text-[#2457C5] hover:underline"
          >
            Re-open Application Roadmap
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. EVIDENCE-GROUNDED SCHEME APPLICATION ROADMAP (6-Step Stepper) */}
      {/* ==================================================================== */}
      {hasMeaningfulScheme && isSchemeExplored && (
        <div
          id="evidence-grounded-roadmap-card"
          className="bg-white rounded-2xl border-2 border-[#2457C5]/40 shadow-sm overflow-hidden space-y-6"
        >
          {/* Header Banner */}
          <div className="p-6 sm:p-7 border-b border-[#E1E7EF] bg-gradient-to-r from-[#F0F4F9] to-white space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#2457C5] text-white">
                  {roadmap?.stateOrUtName
                    ? `${roadmap.stateOrUtName.toUpperCase()} ${(roadmap?.jurisdiction || detectedScheme?.jurisdiction)} SCHEME ROADMAP`
                    : `${(roadmap?.jurisdiction || detectedScheme?.jurisdiction)} GOVERNMENT SCHEME ROADMAP`}
                </span>
                {(roadmap?.isDynamicallyDiscovered || detectedScheme?.isDynamicallyDiscovered) && (
                  <span className="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#027A48] text-white flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Dynamically Discovered & Verified</span>
                  </span>
                )}
                {detectedScheme?.alternativeNamesOrAbbreviations && detectedScheme.alternativeNamesOrAbbreviations.length > 0 && (
                  <span className="text-xs text-[#526176]">
                    Also known as: <strong>{detectedScheme.alternativeNamesOrAbbreviations.join(', ')}</strong>
                  </span>
                )}
              </div>
              <span className="text-[11px] text-[#526176] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#2457C5]" />
                <span>
                  Source Verified: {(roadmap?.sourceVerificationTimestamp || detectedScheme?.lastSourceVerificationTimestamp || '').split('T')[0]}
                </span>
              </span>
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-[#172B4D]">
              {roadmap?.officialSchemeName || detectedScheme?.officialSchemeName}
            </h3>
            <p className="text-xs text-[#526176]">
              Administered by: <strong>{roadmap?.ministryOrDepartment || detectedScheme?.administeringMinistryOrDepartment}</strong>
            </p>
          </div>

          {/* Phase 8: Disclosed Unconfirmed Attributes Banner */}
          {roadmap?.unconfirmedAttributes && roadmap.unconfirmedAttributes.length > 0 && (
            <div className="mx-6 sm:mx-7 p-4 rounded-xl border border-[#FEDF89] bg-[#FFFAEB] text-xs leading-relaxed text-[#B54708] flex items-start gap-3">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Official Verification Disclosure:</span>
                <p className="opacity-95 text-[11px]">
                  The following details could not be independently confirmed on sovereign servers and require departmental verification:
                </p>
                <ul className="list-disc pl-4 space-y-0.5 opacity-90 text-[11px]">
                  {roadmap.unconfirmedAttributes.map((attr, idx) => (
                    <li key={idx}>{attr}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Verdict Warning Banner if claim has unsupported elements (Phase D) */}
          {roadmap?.unsupportedClaimNotice && (
            <div
              className={`mx-6 sm:mx-7 p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed ${
                isContradicted
                  ? 'bg-[#FEF3F2] border-[#FECDCA] text-[#B42318]'
                  : isPartiallySupported
                  ? 'bg-[#FEF7C3] border-[#FEDF89] text-[#B54708]'
                  : 'bg-[#F0F4F9] border-[#D0D5DD] text-[#344054]'
              }`}
            >
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-bold block">
                  {isContradicted
                    ? 'Misinformation Warning: Claim Contradicted by Government Records'
                    : isPartiallySupported
                    ? 'Important Condition: Claim Only Partially Supported'
                    : 'Unverified Claim Notice'}
                </span>
                <p className="opacity-95">{roadmap.unsupportedClaimNotice}</p>
              </div>
            </div>
          )}

          {/* Stepper Navigation Bar */}
          <div className="px-6 sm:px-7">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 border-b border-[#E1E7EF] pb-4">
              {ROADMAP_STEPS_METADATA.map((step) => {
                const isActive = activeRoadmapStep === step.id;
                const Icon = step.icon;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepChange(step.id)}
                    className={`p-2.5 rounded-xl text-left transition-all border flex items-center gap-2 cursor-pointer ${
                      isActive
                        ? 'bg-[#EBF1FF] border-[#2457C5] text-[#2457C5] shadow-xs font-bold'
                        : 'bg-[#F9FAFB] border-[#E1E7EF] text-[#526176] hover:bg-white hover:text-[#172B4D]'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isActive ? 'bg-[#2457C5] text-white' : 'bg-[#E1E7EF] text-[#526176]'
                      }`}
                    >
                      {step.number}
                    </span>
                    <span className="text-xs truncate">{step.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stepper Step Content Panels */}
          <div className="px-6 sm:px-7 space-y-6">
            {/* STEP 1: UNDERSTAND THE SCHEME */}
            {activeRoadmapStep === 'understand_scheme' && (
              <div className="space-y-5">
                <div className="p-5 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#526176] block">
                      Scheme Purpose & Objective
                    </span>
                    <p className="text-xs sm:text-sm text-[#172B4D] leading-relaxed">
                      {roadmap?.purpose || schemeGuide?.schemeOverview}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#E1E7EF] space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#526176] block">
                      Published Benefit & Maximum Entitlement
                    </span>
                    <p className="text-xs text-[#172B4D] leading-relaxed font-medium">
                      {roadmap?.benefitDetails.amountOrType || schemeGuide?.benefitsProvided.description}
                    </p>
                    {roadmap?.benefitDetails.limitsAndConditions && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#EBF1FF] border border-[#2457C5]/30 text-xs font-bold text-[#2457C5]">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Verified Benefit Limit: {roadmap.benefitDetails.limitsAndConditions}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-[#E1E7EF] grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {roadmap?.benefitDetails.frequency && (
                      <div>
                        <span className="text-[10px] font-bold text-[#526176] uppercase block">Distribution Frequency</span>
                        <p className="font-semibold text-[#172B4D] mt-0.5">{roadmap.benefitDetails.frequency}</p>
                      </div>
                    )}
                    {roadmap?.benefitDetails.duration && (
                      <div>
                        <span className="text-[10px] font-bold text-[#526176] uppercase block">Assistance Duration</span>
                        <p className="font-semibold text-[#172B4D] mt-0.5">{roadmap.benefitDetails.duration}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-bold text-[#526176] uppercase block">Official Application Fee</span>
                      <p className="font-semibold text-[#172B4D] mt-0.5">
                        {roadmap?.benefitDetails.applicableFees || schemeGuide?.deadlinesFeesRenewal.fees || 'Free on official portal'}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[#EBF1FF] border border-[#2457C5]/20 text-[11px] text-[#2457C5] flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <p>
                      <strong>General vs. Personal Entitlement:</strong>{' '}
                      {roadmap?.benefitDetails.generalVsPersonalNotice ||
                        'Published scheme benefits represent statutory maximums. Your individual benefit depends on official document verification.'}
                    </p>
                  </div>
                </div>

                {/* Step 1 Actionable Checklist */}
                {roadmap?.steps[0]?.actionableChecklist && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#172B4D]">
                      Step 1 Action Checklist
                    </span>
                    <div className="space-y-2">
                      {roadmap.steps[0].actionableChecklist.map((task) => {
                        const isDone = Boolean(completedRoadmapTasks[task.id]);
                        return (
                          <div
                            key={task.id}
                            onClick={() => toggleRoadmapTask(task.id)}
                            className={`p-3 rounded-xl border text-xs cursor-pointer flex items-start gap-2.5 transition-colors ${
                              isDone ? 'bg-[#EBFDF2] border-[#C6F5D5] text-[#0B7A48]' : 'bg-white border-[#E1E7EF] hover:bg-[#F9FAFB]'
                            }`}
                          >
                            <div className="pt-0.5 shrink-0">
                              {isDone ? <CheckSquare className="w-4 h-4 text-[#0B7A48]" /> : <Square className="w-4 h-4 text-[#98A2B3]" />}
                            </div>
                            <div>
                              <span className={`font-bold block ${isDone ? 'line-through opacity-80' : 'text-[#172B4D]'}`}>{task.task}</span>
                              <span className={`text-[11px] ${isDone ? 'opacity-75' : 'text-[#526176]'}`}>{task.detail}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: CHECK ELIGIBILITY */}
            {activeRoadmapStep === 'check_eligibility' && (
              <div className="space-y-5">
                <div className="space-y-1 border-b border-[#E1E7EF] pb-3">
                  <h4 className="text-xs sm:text-sm font-bold text-[#172B4D]">
                    Plain-Language Explanation of Published Criteria
                  </h4>
                  <p className="text-xs text-[#526176]">
                    These statutory criteria are extracted directly from official ministry guidelines. Answer the optional questions below to test your preliminary match.
                  </p>
                </div>

                {/* Criteria Explanations Cards */}
                {roadmap?.eligibilityPrep.criteriaExplanations && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {roadmap.eligibilityPrep.criteriaExplanations.map((crit) => (
                      <div key={crit.criterionId} className="p-3.5 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-[#172B4D]">
                          <ShieldCheck className="w-4 h-4 text-[#2457C5] shrink-0" />
                          <span>{crit.criterionTitle}</span>
                        </div>
                        <p className="text-[#526176] text-[11px] leading-relaxed">{crit.description}</p>
                        <p className="text-[10px] text-[#2457C5] bg-[#EBF1FF] p-1.5 rounded font-medium">
                          <strong>Why it matters:</strong> {crit.whyItMatters}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Embedded Questionnaire */}
                {eligibilityCriteria && eligibilityCriteria.length > 0 && !isContradicted && (
                  <div className="p-4 sm:p-5 rounded-xl border border-[#2457C5]/30 bg-[#EBF1FF]/30 space-y-4">
                    <span className="text-xs font-bold text-[#172B4D] uppercase tracking-wider block">
                      Optional Eligibility Self-Check
                    </span>
                    <div className="space-y-3">
                      {eligibilityCriteria.map((crit, idx) => (
                        <div key={crit.id} className="p-3.5 rounded-xl border border-[#E1E7EF] bg-white space-y-2">
                          <span className="text-[10px] font-bold text-[#2457C5] uppercase">
                            Question #{idx + 1}: {crit.title}
                          </span>
                          <h5 className="text-xs sm:text-sm font-bold text-[#172B4D]">{crit.question}</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                            {crit.options.map((opt) => {
                              const isSelected = selectedAnswers[crit.id] === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setSelectedAnswers((prev) => ({ ...prev, [crit.id]: opt.value }))}
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
                        </div>
                      ))}
                    </div>

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
                            <span>Evaluating criteria...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Evaluate My Preliminary Match</span>
                          </>
                        )}
                      </button>
                      <span className="text-[11px] text-[#526176]">
                        Strict deterministic evaluation. No Aadhaar, PAN, or passwords collected.
                      </span>
                    </div>

                    {/* Evaluation Result */}
                    {evaluationResult && (
                      <div className="p-4 rounded-xl border border-[#E1E7EF] bg-white space-y-3 shadow-2xs">
                        <div
                          className={`p-3 rounded-lg border flex items-center gap-2.5 ${
                            evaluationResult.category === 'LIKELY_ELIGIBLE'
                              ? 'bg-[#EBFDF2] border-[#C6F5D5] text-[#0B7A48]'
                              : evaluationResult.category === 'MAY_NOT_MEET_CONDITION'
                              ? 'bg-[#FEF7C3] border-[#FEDF89] text-[#B54708]'
                              : 'bg-[#F0F4F9] border-[#D0D5DD] text-[#344054]'
                          }`}
                        >
                          {evaluationResult.category === 'LIKELY_ELIGIBLE' && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                          {evaluationResult.category === 'MAY_NOT_MEET_CONDITION' && <AlertTriangle className="w-5 h-5 shrink-0" />}
                          {evaluationResult.category === 'CANNOT_DETERMINE' && <HelpCircle className="w-5 h-5 shrink-0" />}
                          <div>
                            <span className="font-bold text-xs sm:text-sm block">{evaluationResult.categoryLabel}</span>
                            <span className="text-[11px] opacity-90">{evaluationResult.overallGuidance}</span>
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          {evaluationResult.matchingCriteria.map((item) => (
                            <div key={item.id} className="flex items-start gap-1.5 text-[#0B7A48]">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span><strong>{item.title}:</strong> {item.note}</span>
                            </div>
                          ))}
                          {evaluationResult.unmatchingCriteria.map((item) => (
                            <div key={item.id} className="flex items-start gap-1.5 text-[#B42318]">
                              <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <span><strong>{item.title}:</strong> {item.note}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="p-3 rounded-lg bg-[#F5F7FA] border border-[#E1E7EF] text-[11px] text-[#526176] flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 text-[#2457C5] mt-0.5" />
                  <p>
                    <strong>Statutory Disclaimer:</strong> GovVerify AI is an independent research platform and never determines official eligibility or grants benefits. Only competent government nodal officers can authorize official applications.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 3: PREPARE DOCUMENTS */}
            {activeRoadmapStep === 'prepare_documents' && (
              <div className="space-y-5">
                <div className="p-3.5 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    <strong>Citizen Privacy Guard:</strong> GovVerify AI never requests or stores Aadhaar numbers, PAN numbers, bank passwords, or OTPs. Keep your physical/digital documents ready for official government submission only.
                  </p>
                </div>

                {/* Mandatory Documents */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA]">
                      MANDATORY DOCUMENTS
                    </span>
                    <span className="text-xs text-[#526176]">Required for all applicants</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(roadmap?.documentPrep.mandatoryDocuments || []).map((doc) => {
                      const isExpanded = Boolean(expandedWhereToObtain[doc.id]);
                      return (
                        <div key={doc.id} className="p-4 rounded-xl border border-[#E1E7EF] bg-white space-y-2 shadow-2xs">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-bold text-[#172B4D]">{doc.name}</span>
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#FEF3F2] text-[#B42318] border border-[#FECDCA] shrink-0">
                              Mandatory
                            </span>
                          </div>
                          <p className="text-[11px] text-[#526176] leading-relaxed">{doc.description}</p>
                          {doc.whyRequired && (
                            <p className="text-[10px] text-[#2457C5] bg-[#EBF1FF] p-1.5 rounded">
                              <strong>Why required:</strong> {doc.whyRequired}
                            </p>
                          )}
                          {doc.whereToObtain && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => toggleWhereToObtain(doc.id)}
                                className="text-[11px] font-bold text-[#2457C5] hover:underline flex items-center gap-1 cursor-pointer"
                              >
                                <span>{isExpanded ? 'Hide Where to Obtain' : 'Where to Obtain Document'}</span>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                              {isExpanded && (
                                <div className="mt-2 p-2.5 rounded-lg bg-[#F5F7FA] border border-[#E1E7EF] space-y-1 text-[11px] text-[#172B4D]">
                                  <p><strong>Issuing Authority:</strong> {doc.whereToObtain.issuingAuthority}</p>
                                  <p><strong>Office / Portal:</strong> {doc.whereToObtain.officialPortalOrOffice}</p>
                                  {doc.whereToObtain.procedureSummary && (
                                    <p className="text-[#526176]"><strong>Procedure:</strong> {doc.whereToObtain.procedureSummary}</p>
                                  )}
                                  {doc.whereToObtain.sourceUrl && (
                                    <a
                                      href={doc.whereToObtain.sourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-semibold text-[#2457C5] hover:underline inline-flex items-center gap-1 pt-1"
                                    >
                                      <span>Open portal</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Conditional Documents */}
                {(roadmap?.documentPrep.conditionalDocuments || []).length > 0 && (
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#EBF1FF] text-[#2457C5] border border-[#2457C5]/30">
                        CONDITIONAL DOCUMENTS
                      </span>
                      <span className="text-xs text-[#526176]">Required only if specific criteria or quotas apply</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(roadmap?.documentPrep.conditionalDocuments || []).map((doc) => {
                        const isExpanded = Boolean(expandedWhereToObtain[doc.id]);
                        return (
                          <div key={doc.id} className="p-4 rounded-xl border border-[#E1E7EF] bg-white space-y-2 shadow-2xs">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-bold text-[#172B4D]">{doc.name}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#EBF1FF] text-[#2457C5] border border-[#2457C5]/30 shrink-0">
                                Conditional
                              </span>
                            </div>
                            <p className="text-[11px] text-[#526176] leading-relaxed">{doc.description}</p>
                            {doc.conditionDescription && (
                              <p className="text-[10px] font-semibold text-[#B54708] bg-[#FEF7C3] p-1.5 rounded">
                                Condition: {doc.conditionDescription}
                              </p>
                            )}
                            {doc.whereToObtain && (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() => toggleWhereToObtain(doc.id)}
                                  className="text-[11px] font-bold text-[#2457C5] hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <span>{isExpanded ? 'Hide Where to Obtain' : 'Where to Obtain Document'}</span>
                                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                {isExpanded && (
                                  <div className="mt-2 p-2.5 rounded-lg bg-[#F5F7FA] border border-[#E1E7EF] space-y-1 text-[11px] text-[#172B4D]">
                                    <p><strong>Issuing Authority:</strong> {doc.whereToObtain.issuingAuthority}</p>
                                    <p><strong>Office / Portal:</strong> {doc.whereToObtain.officialPortalOrOffice}</p>
                                    {doc.whereToObtain.procedureSummary && (
                                      <p className="text-[#526176]"><strong>Procedure:</strong> {doc.whereToObtain.procedureSummary}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: APPLY ONLINE OR OFFLINE */}
            {activeRoadmapStep === 'apply_online_offline' && (
              <div className="space-y-5">
                <div className="flex items-center gap-2 border-b border-[#E1E7EF] pb-3">
                  <button
                    type="button"
                    onClick={() => setApplicationModeTab('online')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      applicationModeTab === 'online' ? 'bg-[#2457C5] text-white shadow-xs' : 'bg-[#F0F4F9] text-[#526176]'
                    }`}
                  >
                    Online Portal Steps
                  </button>
                  <button
                    type="button"
                    onClick={() => setApplicationModeTab('offline')}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      applicationModeTab === 'offline' ? 'bg-[#2457C5] text-white shadow-xs' : 'bg-[#F0F4F9] text-[#526176]'
                    }`}
                  >
                    Offline / CSC Office Steps
                  </button>
                </div>

                {applicationModeTab === 'online' ? (
                  <div className="space-y-4">
                    <ol className="space-y-2.5 text-xs text-[#172B4D]">
                      {(roadmap?.applicationInstructions.onlineSteps || []).map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F5F7FA] border border-[#E1E7EF]">
                          <span className="w-5 h-5 rounded-full bg-[#2457C5] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>

                    {/* Official Validated Portal Card */}
                    {roadmap?.applicationInstructions.isPortalVerified && roadmap.applicationInstructions.officialPortalUrl ? (
                      <div className="p-4 rounded-xl border-2 border-[#2457C5]/30 bg-[#EBF1FF]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-[#2457C5] uppercase block">Validated Sovereign Portal</span>
                          <span className="text-xs font-bold text-[#172B4D] block truncate">{roadmap.applicationInstructions.officialPortalUrl}</span>
                        </div>
                        <a
                          href={roadmap.applicationInstructions.officialPortalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="py-2.5 px-4 bg-[#2457C5] hover:bg-[#1D46A6] text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <span>Continue to Official Website</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-[#FEF7C3] border border-[#FEDF89] text-[#B54708] text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          {roadmap?.applicationInstructions.unconfirmedDetailsNotice ||
                            'A direct online application link could not be independently verified on primary sovereign servers. Use the verified scheme portal or visit your local CSC.'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3 text-xs text-[#172B4D]">
                    <ol className="space-y-2.5">
                      {(roadmap?.applicationInstructions.offlineSteps || []).map((step, idx) => (
                        <li key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-[#F5F7FA] border border-[#E1E7EF]">
                          <span className="w-5 h-5 rounded-full bg-[#526176] text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: TRACK APPLICATION */}
            {activeRoadmapStep === 'track_application' && (
              <div className="space-y-5">
                {/* Reference Number Description */}
                <div className="p-4 rounded-xl border border-[#2457C5]/30 bg-[#EBF1FF]/40 space-y-1 text-xs">
                  <span className="text-[10px] font-bold text-[#2457C5] uppercase block">
                    What Reference Number to Look For
                  </span>
                  <p className="text-[#172B4D] font-semibold">
                    {roadmap?.afterSubmission.referenceNumberDescription}
                  </p>
                  <p className="text-[#526176] text-[11px]">
                    Retain this number on your acknowledgment slip or intake receipt to query departmental databases.
                  </p>
                </div>

                {/* Milestone Approval Stages Timeline */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#172B4D] block">
                    Documented Verification & Approval Stages
                  </span>
                  <div className="space-y-2.5">
                    {(roadmap?.afterSubmission.approvalStages || []).map((stage) => (
                      <div key={stage.stageNumber} className="p-3.5 rounded-xl border border-[#E1E7EF] bg-white flex items-start gap-3 shadow-2xs">
                        <span className="w-6 h-6 rounded-full bg-[#2457C5] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {stage.stageNumber}
                        </span>
                        <div className="space-y-0.5 flex-1 text-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-bold text-[#172B4D]">{stage.stageName}</span>
                            <span className="text-[10px] font-semibold text-[#526176] bg-[#F0F4F9] px-2 py-0.5 rounded self-start sm:self-auto">
                              {stage.responsibleEntity}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#526176] leading-relaxed">{stage.description}</p>
                          {stage.estimatedTimelineOrNote && (
                            <p className="text-[10px] text-[#2457C5] font-medium pt-0.5">
                              Timeline note: {stage.estimatedTimelineOrNote}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tracking Instructions */}
                <div className="p-4 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-2 text-xs">
                  <span className="font-bold text-[#172B4D] block">How to Query Status Online</span>
                  <ul className="space-y-1.5 text-[11px] text-[#526176]">
                    {(roadmap?.afterSubmission.trackingSteps || []).map((step, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-[#2457C5] font-bold">•</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                  {roadmap?.afterSubmission.isTrackingUrlVerified && roadmap.afterSubmission.trackingUrl && (
                    <div className="pt-2">
                      <a
                        href={roadmap.afterSubmission.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-[#2457C5] hover:underline inline-flex items-center gap-1"
                      >
                        <span>Open official tracking portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-[#F5F7FA] border border-[#E1E7EF] text-[11px] text-[#526176]">
                  <strong>Notice:</strong> GovVerify AI never submits applications, checks private dossiers, or contacts authorities on your behalf.
                </div>
              </div>
            )}

            {/* STEP 6: FOLLOW-UP & RECOURSE */}
            {activeRoadmapStep === 'follow_up_recourse' && (
              <div className="space-y-5">
                {/* Correction Procedure */}
                <div className="p-4 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-1.5 text-xs">
                  <span className="text-[10px] font-bold text-[#2457C5] uppercase block">
                    Defective Application & Objection Recourse
                  </span>
                  <h5 className="font-bold text-[#172B4D]">How to Resolve Application Objections</h5>
                  <p className="text-[#526176] leading-relaxed">
                    {roadmap?.afterSubmission.correctionProcedure ||
                      'If an application is marked defective or documents are rejected, log in immediately to inspect objection remarks and upload certified replacements before the closing deadline.'}
                  </p>
                </div>

                {/* Official Grievance Channels */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#172B4D] block">
                    Verified Grievance & Escalation Routes
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {roadmap?.afterSubmission.grievanceChannels.helplinePhone && (
                      <div className="p-3.5 rounded-xl border border-[#E1E7EF] bg-white space-y-1 shadow-2xs">
                        <span className="text-[10px] font-bold text-[#526176] uppercase flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#2457C5]" />
                          <span>Toll-Free Helpline</span>
                        </span>
                        <p className="font-semibold text-[#172B4D]">{roadmap?.afterSubmission.grievanceChannels.helplinePhone}</p>
                      </div>
                    )}
                    {roadmap?.afterSubmission.grievanceChannels.helplineEmail && (
                      <div className="p-3.5 rounded-xl border border-[#E1E7EF] bg-white space-y-1 shadow-2xs">
                        <span className="text-[10px] font-bold text-[#526176] uppercase flex items-center gap-1">
                          <Mail className="w-3 h-3 text-[#2457C5]" />
                          <span>Helpdesk Email</span>
                        </span>
                        <p className="font-semibold text-[#172B4D] truncate">{roadmap?.afterSubmission.grievanceChannels.helplineEmail}</p>
                      </div>
                    )}
                    {roadmap?.afterSubmission.grievanceChannels.grievancePortalUrl && (
                      <div className="p-3.5 rounded-xl border border-[#E1E7EF] bg-white space-y-1 shadow-2xs">
                        <span className="text-[10px] font-bold text-[#526176] uppercase flex items-center gap-1">
                          <Globe className="w-3 h-3 text-[#2457C5]" />
                          <span>Public Grievance Portal</span>
                        </span>
                        <a
                          href={roadmap.afterSubmission.grievanceChannels.grievancePortalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#2457C5] hover:underline flex items-center gap-1"
                        >
                          <span>{roadmap.afterSubmission.grievanceChannels.grievancePortalName || 'CPGRAMS'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#F0F4F9] border border-[#E1E7EF] text-[11px] text-[#526176] space-y-1">
                  <p><strong>CPGRAMS Escalation:</strong> Citizens can escalate unresolved central or state ministry complaints via pgportal.gov.in.</p>
                  <p><strong>Right to Information (RTI):</strong> Official scheme records and processing delays can be queried through rtionline.gov.in.</p>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Navigation Footer (Prev / Next Buttons) */}
          <div className="p-4 sm:p-5 bg-[#F5F7FA] border-t border-[#E1E7EF] flex items-center justify-between">
            <button
              type="button"
              disabled={currentStepIndex <= 0}
              onClick={() => handleStepChange(ROADMAP_STEPS_METADATA[currentStepIndex - 1].id)}
              className="py-2 px-4 rounded-xl border border-[#D0D5DD] bg-white hover:bg-[#F0F4F9] disabled:opacity-40 text-xs font-bold text-[#172B4D] flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Previous Step</span>
            </button>

            <span className="text-xs font-semibold text-[#526176]">
              Step {currentStepIndex + 1} of {ROADMAP_STEPS_METADATA.length}
            </span>

            <button
              type="button"
              disabled={currentStepIndex >= ROADMAP_STEPS_METADATA.length - 1}
              onClick={() => handleStepChange(ROADMAP_STEPS_METADATA[currentStepIndex + 1].id)}
              className="py-2 px-4 rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shadow-xs"
            >
              <span>Next Step</span>
              <ArrowRight className="w-3.5 h-3.5" />
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
      {/* 1B. NO CONFIRMED SCHEME IDENTIFIED (Safe Discovery Path) */}
      {/* ==================================================================== */}
      {!hasMeaningfulScheme && (
        <div
          id="no-scheme-identified-notice"
          className="bg-white rounded-2xl border border-[#E1E7EF] p-6 sm:p-7 shadow-xs space-y-3"
        >
          <div className="flex items-center gap-2 text-[#526176]">
            <Compass className="w-4 h-4 text-[#2457C5]" />
            <h3 className="text-sm font-bold text-[#172B4D]">
              Government Scheme Application Roadmap
            </h3>
          </div>
          <p className="text-xs text-[#526176] leading-relaxed">
            No specific government welfare scheme could be confidently identified for this claim. Official application roadmaps are generated only when a verified Central or State scheme is detected from primary gazettes to prevent misleading application advice.
          </p>
          <div className="pt-2 border-t border-[#E1E7EF] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <span className="text-[#526176] text-[11px]">
              Explore verified sovereign schemes across India:
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href="https://www.myscheme.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#EBF1FF] border border-[#2457C5]/30 text-[#2457C5] font-bold text-[11px] hover:bg-[#D0E1FD] transition-colors"
              >
                <span>myScheme Portal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="https://services.india.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F0F4F9] border border-[#D0D5DD] text-[#526176] font-bold text-[11px] hover:text-[#172B4D] transition-colors"
              >
                <span>National Services Directory</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
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
