/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Verify & Take Action Component
 * Renders verified official next steps, validated portal links,
 * interactive non-invasive eligibility questionnaire, and application checklist.
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
} from 'lucide-react';
import { ActionGuidance, EligibilityEvaluationResult } from '../../server/services/actionGuidance';
import { fetchJsonOrThrow, safeFetchJson } from '../../utils/safeFetch';

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
      // Fallback: evaluate client-side if API call fails
      const matching: any[] = [];
      const unmatching: any[] = [];
      const unknown: any[] = [];

      for (const crit of guidance.eligibilityCriteria) {
        const answer = selectedAnswers[crit.id];
        if (!answer) {
          unknown.push({ id: crit.id, title: crit.title, note: 'Not answered' });
        } else {
          const opt = crit.options.find((o) => o.value === answer);
          if (opt?.isEligibleMatch) {
            matching.push({ id: crit.id, title: crit.title, note: opt.explanation });
          } else {
            unmatching.push({ id: crit.id, title: crit.title, note: opt?.explanation || 'Unmet condition' });
          }
        }
      }

      setEvaluationResult({
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
            Checking official government services & action guidance...
          </h2>
        </div>
        <p className="text-xs text-[#526176]">
          Validating sovereign application portals, eligibility criteria, and required documents against primary records.
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

  const { service, advisoryType, checklist, eligibilityCriteria, followUpActions } = guidance;
  const isSupported = verdict === 'SUPPORTED';
  const isPartiallySupported = verdict === 'PARTIALLY_SUPPORTED';
  const isContradicted = verdict === 'CONTRADICTED';
  const isInsufficient = verdict === 'INSUFFICIENT_EVIDENCE';

  const completedCount = checklist.filter((item) => completedTasks[item.id]).length;

  return (
    <div className="space-y-6">
      {/* ==================================================================== */}
      {/* 4. MAIN ACTION GUIDANCE HEADER & VERDICT-ALIGNED ADVISORY */}
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

          {/* Scheme & Service Overview Card */}
          {service && (
            <div className="p-5 rounded-xl border border-[#E1E7EF] bg-[#F5F7FA] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E7EF] pb-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-[#526176] uppercase tracking-wider block">
                    Identified Public Service / Program
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
      {/* 5. OPTIONAL ELIGIBILITY QUESTIONNAIRE */}
      {/* ==================================================================== */}
      {eligibilityCriteria && eligibilityCriteria.length > 0 && !isContradicted && (
        <div className="bg-white rounded-2xl border border-[#E1E7EF] shadow-xs p-6 sm:p-7 space-y-5">
          <div className="border-b border-[#E1E7EF] pb-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#2457C5]" />
              <h3 className="text-base font-bold text-[#172B4D]">
                Preliminary Eligibility Questionnaire
              </h3>
            </div>
            <p className="text-xs text-[#526176]">
              Answer a few questions based on official scheme rules to assess your preliminary match.
              GovVerify AI never asks for Aadhaar numbers, passwords, OTPs, or bank details.
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
                        className={`text-left p-2.5 rounded-lg border text-xs transition-colors flex items-center justify-between gap-2 ${
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
              onClick={handleEvaluateQuestionnaire}
              disabled={isEvaluating || Object.keys(selectedAnswers).length === 0}
              className="py-2.5 px-5 bg-[#2457C5] hover:bg-[#1D46A6] active:bg-[#193B8C] disabled:bg-[#D0D5DD] text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
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
              No questionnaire responses are shared or stored externally.
            </span>
          </div>

          {/* Evaluation Results Card */}
          {evaluationResult && (
            <div className="p-4 sm:p-5 rounded-xl border border-[#E1E7EF] bg-white space-y-3.5 shadow-2xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2457C5]" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#172B4D]">
                  Preliminary Evaluation Result
                </h4>
              </div>

              <p className="text-xs font-medium text-[#172B4D] bg-[#F5F7FA] p-3 rounded-lg border border-[#E1E7EF]">
                {evaluationResult.overallGuidance}
              </p>

              <div className="space-y-2 text-xs">
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
              </div>

              <div className="p-2.5 rounded-lg bg-[#F0F4F9] text-[11px] text-[#526176] flex items-start gap-2">
                <Info className="w-3.5 h-3.5 shrink-0 text-[#2457C5] mt-0.5" />
                <span>
                  <strong>Civic Notice:</strong> {evaluationResult.disclaimer} Final approval is granted exclusively by the competent government authority after document verification.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. APPLICATION CHECKLIST & REQUIRED DOCUMENTS */}
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
      {/* 7. OFFICIAL PORTAL, "CONTINUE" BUTTON & CONTACTS */}
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
      {/* 8. INTERACTIVE FOLLOW-UP ACTIONS */}
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
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
