/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Landmark,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  HelpCircle,
  Clock,
  Layers,
  MapPin,
  Sparkles,
  Loader2,
  ArrowRight,
  ShieldAlert,
  Compass,
} from 'lucide-react';
import { SchemeItem, EligibilityResult, schemeApi } from '../../services/api/schemes';
import { PersonalizedAssessmentModal } from './PersonalizedAssessmentModal';
import { ApplicationAssistanceModal } from '../guidance/ApplicationAssistanceModal';
import { useLanguage } from '../../contexts/LanguageContext';

interface SchemeDetailModalProps {
  scheme: SchemeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onVerifyClaim?: (claimText: string) => void;
  onSelectScheme?: (schemeId: string) => void;
}

export const SchemeDetailModal: React.FC<SchemeDetailModalProps> = ({
  scheme,
  isOpen,
  onClose,
  onVerifyClaim,
  onSelectScheme,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'overview' | 'eligibility' | 'documents' | 'roadmap' | 'checker'>('overview');
  const [isAssessmentOpen, setIsAssessmentOpen] = useState<boolean>(false);
  const [isAssistanceOpen, setIsAssistanceOpen] = useState<boolean>(false);

  // Eligibility Checker State
  const [incomeLakhs, setIncomeLakhs] = useState<string>('');
  const [domicileState, setDomicileState] = useState<string>('');
  const [isFarmer, setIsFarmer] = useState<boolean | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evalResult, setEvalResult] = useState<EligibilityResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setActiveTab('overview');
      setEvalResult(null);
      setEvalError(null);
      if (scheme?.state) {
        setDomicileState(scheme.state);
      } else {
        setDomicileState('');
      }
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, scheme]);

  if (!isOpen || !scheme) return null;

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsEvaluating(true);
    setEvalError(null);
    try {
      const details: Record<string, any> = {};
      if (incomeLakhs) details.annualIncomeLakhs = parseFloat(incomeLakhs);
      if (domicileState) details.state = domicileState;
      if (isFarmer !== null) details.isLandholder = isFarmer;

      const result = await schemeApi.checkEligibility(scheme.id, details);
      setEvalResult(result);
    } catch (err: any) {
      setEvalError(err.message || 'Error checking eligibility.');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleVerifySchemeClick = () => {
    if (onVerifyClaim) {
      const suggestedClaim = `Under ${scheme.shortName || scheme.schemeName}, ${scheme.benefits}`;
      onVerifyClaim(suggestedClaim);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scheme-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-brand-navy/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-brand-border overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-brand-border bg-gradient-to-r from-brand-bg-subtle via-white to-slate-50 flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1 pr-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                  scheme.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : scheme.status === 'UPCOMING'
                    ? 'bg-blue-100 text-blue-800'
                    : scheme.status === 'CLOSED'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                Status: {scheme.status}
              </span>

              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-brand-slate border border-slate-200">
                {scheme.jurisdiction === 'CENTRAL' ? 'National / Central' : `State: ${scheme.state || 'State'}`}
              </span>

              <span className="text-[11px] font-bold text-brand-blue bg-brand-softblue px-2 py-0.5 rounded-md border border-brand-softblue-border">
                {scheme.category}
              </span>
            </div>

            <h2 id="scheme-modal-title" className="text-lg sm:text-xl font-black text-brand-navy leading-tight">
              {scheme.schemeName}
            </h2>

            <div className="text-xs text-brand-slate flex items-center gap-1.5 font-medium">
              <Landmark className="w-3.5 h-3.5 text-brand-blue shrink-0" />
              <span>{scheme.administeringMinistry}</span>
              {scheme.department && <span>· {scheme.department}</span>}
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-brand-slate hover:text-brand-navy hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-brand-border px-5 sm:px-6 bg-brand-bg-subtle/50 overflow-x-auto gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-brand-slate hover:text-brand-navy'
            }`}
          >
            {t('schemeDetail.overviewTab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('eligibility')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'eligibility'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-brand-slate hover:text-brand-navy'
            }`}
          >
            {t('schemeDetail.eligibilityTab')} ({scheme.eligibilityConditions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'documents'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-brand-slate hover:text-brand-navy'
            }`}
          >
            {t('schemeDetail.documentsTab')} ({scheme.requiredDocuments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roadmap')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'roadmap'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-brand-slate hover:text-brand-navy'
            }`}
          >
            {t('schemeDetail.roadmapTab')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('checker')}
            className={`py-3 px-3 text-xs font-bold border-b-2 transition-colors whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'checker'
                ? 'border-brand-blue text-brand-blue'
                : 'border-transparent text-brand-slate hover:text-brand-navy'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('schemeDetail.checkerTab')}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-brand-navy flex-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-brand-slate">
                  Scheme Description
                </h4>
                <p className="text-brand-slate leading-relaxed">
                  {scheme.description}
                </p>
              </div>

              {/* Benefits Banner */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Verified Official Benefits</span>
                </div>
                <p className="font-semibold text-xs sm:text-sm leading-relaxed">
                  {scheme.benefits}
                </p>
              </div>

              {/* Sovereign Citations & Last Verified Date */}
              <div className="p-3.5 rounded-xl border border-brand-border bg-brand-bg-subtle space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-brand-slate uppercase tracking-wider">
                    Authoritative Sovereign Source:
                  </span>
                  <span className="text-brand-slate-light flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Verified: {new Date(scheme.lastVerifiedDate).toLocaleDateString()}
                  </span>
                </div>

                {scheme.sourceCitations.map((cite, i) => (
                  <div key={i} className="text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1">
                    <span className="text-brand-navy font-medium">
                      {cite.title} ({cite.issuingAuthority})
                    </span>
                    <a
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-brand-blue hover:underline font-bold"
                    >
                      <span>{cite.domain}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: ELIGIBILITY CHECKLIST */}
          {activeTab === 'eligibility' && (
            <div className="space-y-3">
              <div className="text-xs text-brand-slate">
                Statutory conditions established in official government circulars and scheme guidelines:
              </div>
              <div className="space-y-2">
                {scheme.eligibilityConditions.map((cond, i) => (
                  <div key={i} className="p-3 rounded-xl border border-brand-border bg-white shadow-2xs flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-brand-navy leading-relaxed font-medium">
                      {cond}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: REQUIRED DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-3">
              <div className="text-xs text-brand-slate">
                Official citizen documentation required for registration and identity verification:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {scheme.requiredDocuments.map((doc, i) => (
                  <div key={i} className="p-3 rounded-xl border border-brand-border bg-white shadow-2xs flex items-start gap-2.5">
                    <FileText className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-brand-navy font-medium">
                      {doc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: APPLICATION ROADMAP */}
          {activeTab === 'roadmap' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-brand-slate">
                  Official application roadmap ({scheme.applicationProcedure.mode} mode):
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-softblue text-brand-blue border border-brand-softblue-border">
                  {scheme.applicationProcedure.mode} Application
                </span>
              </div>

              <div className="space-y-3 relative before:absolute before:top-2 before:bottom-2 before:left-3.5 before:w-0.5 before:bg-brand-border">
                {scheme.applicationProcedure.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 relative pl-1">
                    <div className="w-6 h-6 rounded-full bg-brand-blue text-white flex items-center justify-center text-xs font-black shrink-0 shadow-2xs">
                      {i + 1}
                    </div>
                    <div className="p-3 rounded-xl border border-brand-border bg-white shadow-2xs flex-1 text-xs sm:text-sm font-medium text-brand-navy leading-relaxed">
                      {step}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3.5 rounded-xl bg-brand-softblue border border-brand-softblue-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs text-brand-navy font-semibold">
                  Official Application Portal:
                </span>
                <a
                  href={scheme.applicationProcedure.officialPortalUrl || scheme.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-blue hover:bg-brand-blue-hover text-white rounded-lg text-xs font-bold shadow-2xs transition-colors self-start sm:self-auto"
                >
                  <span>Open Government Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 5: ELIGIBILITY CHECKER */}
          {activeTab === 'checker' && (
            <div className="space-y-4">
              {/* Comprehensive Assessment Launcher Banner */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-brand-softblue via-sky-50 to-emerald-50 border border-brand-softblue-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-brand-blue">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Phase 6: Multi-Step Personalized Assessment</span>
                  </div>
                  <p className="text-xs text-brand-navy leading-relaxed font-medium">
                    Evaluate all statutory criteria independently, check document readiness, and view alternate options.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAssessmentOpen(true)}
                  className="py-2 px-4 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-bold text-xs shadow-2xs transition-colors whitespace-nowrap flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                >
                  <span>Launch 6-Step Engine</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Statutory Verification Notice
                </div>
                <p className="text-[11px] leading-relaxed">
                  GovVerify AI provides indicative preliminary matching based on published guidelines. We never guarantee enrollment or legal entitlement. Official verification rests exclusively with government revenue and nodal officers.
                </p>
              </div>

              <form onSubmit={handleEvaluate} className="space-y-3 p-4 rounded-xl border border-brand-border bg-white shadow-2xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-brand-navy mb-1">
                      Annual Family Income (Rs in Lakhs)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 2.5"
                      value={incomeLakhs}
                      onChange={(e) => setIncomeLakhs(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-brand-border focus:border-brand-blue focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-brand-navy mb-1">
                      State Domicile
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Maharashtra"
                      value={domicileState}
                      onChange={(e) => setDomicileState(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-brand-border focus:border-brand-blue focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-brand-navy mb-1">
                    Landholding / Agricultural Status
                  </label>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="farmerStatus"
                        checked={isFarmer === true}
                        onChange={() => setIsFarmer(true)}
                        className="text-brand-blue"
                      />
                      <span>Yes, Own Land / Farmer</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="farmerStatus"
                        checked={isFarmer === false}
                        onChange={() => setIsFarmer(false)}
                        className="text-brand-blue"
                      />
                      <span>No Landholding</span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isEvaluating}
                  className="w-full py-2 px-4 rounded-lg bg-brand-blue hover:bg-brand-blue-hover text-white font-bold text-xs shadow-2xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking Statutory Rules...</span>
                    </>
                  ) : (
                    <span>Evaluate Preliminary Criteria</span>
                  )}
                </button>
              </form>

              {/* Evaluation Results Card */}
              {evalResult && (
                <div className="p-4 rounded-xl border border-brand-border bg-brand-bg-subtle space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-brand-slate">
                      Preliminary Finding:
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                        evalResult.evaluationStatus === 'POTENTIALLY_ELIGIBLE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : evalResult.evaluationStatus === 'CRITERIA_UNMET'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {evalResult.evaluationStatus.replace('_', ' ')}
                    </span>
                  </div>

                  <p className="text-xs text-brand-navy leading-relaxed font-medium">
                    {evalResult.advisoryNote}
                  </p>

                  {evalResult.matchedCriteria.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase">
                        Matched Conditions:
                      </span>
                      {evalResult.matchedCriteria.map((c, i) => (
                        <div key={i} className="text-xs text-emerald-900 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {evalResult.unmetCriteria.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-rose-700 uppercase">
                        Unmet Statutory Conditions:
                      </span>
                      {evalResult.unmetCriteria.map((c, i) => (
                        <div key={i} className="text-xs text-rose-900 flex items-center gap-1">
                          <X className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {evalResult.missingCriteria.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-amber-700 uppercase">
                        Missing Criteria to Confirm:
                      </span>
                      {evalResult.missingCriteria.map((c, i) => (
                        <div key={i} className="text-xs text-amber-900 flex items-center gap-1">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-brand-border bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleVerifySchemeClick}
            className="px-4 py-2 rounded-xl bg-brand-softblue hover:bg-brand-softblue-border text-brand-blue font-bold text-xs transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Verify Claim</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAssistanceOpen(true)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <Compass className="w-4 h-4" />
            <span>Application Assistance</span>
          </button>

          <a
            href={scheme.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5"
          >
            <span>Official Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Phase 6 Personalized Assessment Engine Modal */}
      {isAssessmentOpen && (
        <PersonalizedAssessmentModal
          scheme={scheme}
          isOpen={isAssessmentOpen}
          onClose={() => setIsAssessmentOpen(false)}
          onSelectAlternativeScheme={(altId) => {
            setIsAssessmentOpen(false);
            if (onSelectScheme) {
              onSelectScheme(altId);
            }
          }}
        />
      )}

      {/* Phase 7 Smart Scheme Application Assistance Modal */}
      {isAssistanceOpen && (
        <ApplicationAssistanceModal
          schemeId={scheme.id}
          schemeName={scheme.schemeName}
          isOpen={isAssistanceOpen}
          onClose={() => setIsAssistanceOpen(false)}
        />
      )}
    </div>
  );
};
