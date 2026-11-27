/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  MinusCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  FileCheck,
  FileText,
  Clock,
  Landmark,
  UserCheck,
  Sparkles,
  Loader2,
  Info,
  RefreshCw,
  FolderCheck,
} from 'lucide-react';
import {
  SchemeItem,
  DetailedEligibilityAssessment,
  CitizenProfileInput,
  ConditionOutcome,
  schemeApi,
} from '../../services/api/schemes';

interface PersonalizedAssessmentModalProps {
  scheme: SchemeItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectAlternativeScheme?: (schemeId: string) => void;
}

export const PersonalizedAssessmentModal: React.FC<PersonalizedAssessmentModalProps> = ({
  scheme,
  isOpen,
  onClose,
  onSelectAlternativeScheme,
}) => {
  // Wizard Step State (1 through 6)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Progressive Form State
  const [domicileState, setDomicileState] = useState<string>('');
  const [annualIncomeLakhs, setAnnualIncomeLakhs] = useState<string>('');
  const [age, setAge] = useState<string>('');
  const [occupation, setOccupation] = useState<string>('other');
  const [isLandholder, setIsLandholder] = useState<boolean | null>(null);
  const [landHectares, setLandHectares] = useState<string>('');
  const [isCollegeEnrolled, setIsCollegeEnrolled] = useState<boolean | null>(null);
  const [attendancePercentage, setAttendancePercentage] = useState<string>('');
  const [isBusinessOwner, setIsBusinessOwner] = useState<boolean | null>(null);
  const [businessType, setBusinessType] = useState<string>('NONE');
  const [isKutchaHouse, setIsKutchaHouse] = useState<boolean | null>(null);
  const [hasCropLoan, setHasCropLoan] = useState<boolean | null>(null);
  const [isTaxPayee, setIsTaxPayee] = useState<boolean | null>(null);
  const [declaredDocuments, setDeclaredDocuments] = useState<string[]>([]);

  // Assessment Engine API State
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [assessment, setAssessment] = useState<DetailedEligibilityAssessment | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Initialize and reset on modal open
  useEffect(() => {
    if (isOpen && scheme) {
      document.body.style.overflow = 'hidden';
      setCurrentStep(1);
      setAssessment(null);
      setEvalError(null);
      setDomicileState(scheme.state || 'Maharashtra');
      setAnnualIncomeLakhs('');
      setAge('');
      setOccupation(
        scheme.category.toLowerCase().includes('agri')
          ? 'farmer'
          : scheme.category.toLowerCase().includes('educ')
          ? 'student'
          : 'other'
      );
      setIsLandholder(null);
      setLandHectares('');
      setIsCollegeEnrolled(null);
      setAttendancePercentage('');
      setIsBusinessOwner(null);
      setBusinessType('NONE');
      setIsKutchaHouse(null);
      setHasCropLoan(null);
      setIsTaxPayee(null);
      setDeclaredDocuments([]);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, scheme]);

  if (!isOpen || !scheme) return null;

  // Toggle declared documents
  const toggleDocument = (docName: string) => {
    setDeclaredDocuments((prev) =>
      prev.includes(docName) ? prev.filter((d) => d !== docName) : [...prev, docName]
    );
  };

  // Run Assessment API Call
  const handleRunAssessment = async () => {
    setIsEvaluating(true);
    setEvalError(null);

    const profile: CitizenProfileInput = {
      declaredDocuments,
    };

    if (domicileState) profile.state = domicileState;
    if (annualIncomeLakhs) profile.annualIncomeLakhs = parseFloat(annualIncomeLakhs);
    if (age) profile.age = parseInt(age, 10);
    if (occupation) profile.occupation = occupation;
    if (isLandholder !== null) profile.isLandholder = isLandholder;
    if (landHectares) profile.landHoldingHectares = parseFloat(landHectares);
    if (isCollegeEnrolled !== null) profile.isCollegeEnrolled = isCollegeEnrolled;
    if (attendancePercentage) profile.attendancePercentage = parseFloat(attendancePercentage);
    if (isBusinessOwner !== null) profile.isBusinessOwner = isBusinessOwner;
    if (businessType !== 'NONE') profile.businessType = businessType;
    if (isKutchaHouse !== null) profile.isKutchaHouse = isKutchaHouse;
    if (hasCropLoan !== null) profile.hasActiveCropLoan = hasCropLoan;
    if (isTaxPayee !== null) profile.isTaxPayee = isTaxPayee;

    try {
      const result = await schemeApi.evaluatePersonalizedEligibility(scheme.id, profile);
      setAssessment(result);
      setCurrentStep(3); // Jump to Step 3: Condition Breakdown
    } catch (err: any) {
      setEvalError(err.message || 'Failed to complete eligibility evaluation.');
    } finally {
      setIsEvaluating(false);
    }
  };

  // Helper for Condition outcome badge
  const renderOutcomeBadge = (outcome: ConditionOutcome) => {
    switch (outcome) {
      case 'SATISFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Satisfied</span>
          </span>
        );
      case 'NOT_SATISFIED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200">
            <X className="w-3 h-3 text-rose-600" />
            <span>Not Satisfied</span>
          </span>
        );
      case 'UNKNOWN':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
            <HelpCircle className="w-3 h-3 text-amber-600" />
            <span>Needs Verification</span>
          </span>
        );
      case 'NOT_APPLICABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <MinusCircle className="w-3 h-3 text-slate-500" />
            <span>Not Applicable</span>
          </span>
        );
    }
  };

  const stepsList = [
    { num: 1, label: 'Scheme & Privacy' },
    { num: 2, label: 'Profile Inputs' },
    { num: 3, label: 'Condition Analysis' },
    { num: 4, label: 'Document Readiness' },
    { num: 5, label: 'Official Roadmap' },
    { num: 6, label: 'Alternatives' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assessment-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-brand-navy/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-brand-border overflow-hidden my-auto max-h-[94vh] flex flex-col animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-brand-border bg-gradient-to-r from-brand-bg-subtle via-white to-slate-50 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-brand-softblue text-brand-blue border border-brand-softblue-border">
                Personalized Assessment Engine
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-brand-slate border border-slate-200">
                {scheme.jurisdiction === 'CENTRAL' ? 'National Scheme' : `State: ${scheme.state || 'State'}`}
              </span>
            </div>

            <h2 id="assessment-modal-title" className="text-base sm:text-lg font-black text-brand-navy leading-tight">
              {scheme.schemeName}
            </h2>
            <div className="text-xs text-brand-slate flex items-center gap-1.5 font-medium">
              <Landmark className="w-3.5 h-3.5 text-brand-blue shrink-0" />
              <span>{scheme.administeringMinistry}</span>
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

        {/* 6-Step Visual Progress Bar */}
        <div className="bg-slate-50 border-b border-brand-border px-4 py-2.5 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[550px] gap-2">
            {stepsList.map((step) => {
              const isActive = currentStep === step.num;
              const isPast = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => {
                    // Allow navigating back or forward only if assessment is already generated for later steps
                    if (step.num <= 2 || assessment) {
                      setCurrentStep(step.num);
                    }
                  }}
                  disabled={step.num > 2 && !assessment}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                    isActive
                      ? 'text-brand-blue'
                      : isPast
                      ? 'text-emerald-700 hover:text-emerald-800'
                      : 'text-brand-slate-light opacity-60 cursor-not-allowed'
                  }`}
                >
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                      isActive
                        ? 'bg-brand-blue text-white shadow-2xs'
                        : isPast
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isPast ? '✓' : step.num}
                  </span>
                  <span className="whitespace-nowrap">{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-brand-navy flex-1">
          {evalError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs uppercase tracking-wider text-rose-800">Assessment Notice</p>
                <p className="text-xs">{evalError}</p>
              </div>
            </div>
          )}

          {/* STEP 1: SCHEME CONTEXT & PRIVACY NOTICE */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-xl border border-brand-border bg-brand-bg-subtle space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-brand-slate">
                  Scheme Scope & Objectives
                </span>
                <p className="text-xs text-brand-navy leading-relaxed">{scheme.description}</p>
                <div className="pt-2 border-t border-brand-border/60">
                  <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Official Benefits: {scheme.benefits}</span>
                  </span>
                </div>
              </div>

              {/* Privacy Safeguard Callout */}
              <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-950 space-y-2">
                <div className="flex items-center gap-2 text-sky-900 font-bold text-xs sm:text-sm">
                  <ShieldCheck className="w-5 h-5 text-brand-blue shrink-0" />
                  <span>Strict Privacy & Zero Sensitive Identifier Collection Policy</span>
                </div>
                <p className="text-xs text-sky-900/90 leading-relaxed">
                  GovVerify AI operates strictly as an informational citizen utility. To protect your identity and security:
                </p>
                <ul className="text-xs text-sky-900 space-y-1 pl-4 list-disc font-medium">
                  <li><strong>Never submit Aadhaar numbers, PAN numbers, or bank account numbers.</strong></li>
                  <li><strong>Never provide passwords, OTPs, or biometric credentials.</strong></li>
                  <li>Assessment answers are evaluated in-memory and are never stored or sold.</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="py-2.5 px-5 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-2"
                >
                  <span>Continue to Questionnaire</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PROGRESSIVE QUESTIONNAIRE */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-brand-navy">
                  Progressive Citizen Profile (No Sensitive Data)
                </h3>
                <p className="text-xs text-brand-slate">
                  Provide demographic parameters to match against official statutory criteria.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* State Domicile */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-brand-slate">
                    State of Domicile / Residence
                  </label>
                  <select
                    value={domicileState}
                    onChange={(e) => setDomicileState(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg border border-brand-border bg-white text-xs font-semibold text-brand-navy focus:outline-hidden focus:ring-1 focus:ring-brand-blue"
                  >
                    <option value="Maharashtra">Maharashtra</option>
                    <option value="Delhi">Delhi</option>
                    <option value="Gujarat">Gujarat</option>
                    <option value="Karnataka">Karnataka</option>
                    <option value="Uttar Pradesh">Uttar Pradesh</option>
                    <option value="Madhya Pradesh">Madhya Pradesh</option>
                    <option value="Rajasthan">Rajasthan</option>
                    <option value="Tamil Nadu">Tamil Nadu</option>
                    <option value="Other">Other State / Union Territory</option>
                  </select>
                </div>

                {/* Annual Income */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-brand-slate">
                    Annual Family Income (in Lakhs INR)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g. 2.5 (for Rs 2,50,000)"
                    value={annualIncomeLakhs}
                    onChange={(e) => setAnnualIncomeLakhs(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg border border-brand-border bg-white text-xs text-brand-navy focus:outline-hidden focus:ring-1 focus:ring-brand-blue"
                  />
                </div>

                {/* Occupation / Profile Category */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-brand-slate">
                    Primary Occupation
                  </label>
                  <select
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="w-full py-2 px-3 rounded-lg border border-brand-border bg-white text-xs font-semibold text-brand-navy focus:outline-hidden focus:ring-1 focus:ring-brand-blue"
                  >
                    <option value="farmer">Farmer / Agricultural Cultivator</option>
                    <option value="student">Student / Higher Education</option>
                    <option value="vendor">Urban Street Vendor / Hawker</option>
                    <option value="business">Small Business / MSME Entrepreneur</option>
                    <option value="wage_worker">Daily Wage Laborer / Informal Worker</option>
                    <option value="other">Salaried / Private Employee / Other</option>
                  </select>
                </div>

                {/* Income Tax Payee Safeguard */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-brand-slate">
                    Are you or family an Income Tax Payee?
                  </label>
                  <div className="flex items-center gap-4 text-xs font-semibold pt-1">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="taxPayee"
                        checked={isTaxPayee === false}
                        onChange={() => setIsTaxPayee(false)}
                      />
                      <span>No (Non-Taxpayer)</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="taxPayee"
                        checked={isTaxPayee === true}
                        onChange={() => setIsTaxPayee(true)}
                      />
                      <span>Yes (Files Income Tax)</span>
                    </label>
                  </div>
                </div>

                {/* Agricultural specific */}
                {(occupation === 'farmer' || scheme.category.toLowerCase().includes('agri')) && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-brand-slate">
                        Do you own cultivable agricultural land?
                      </label>
                      <div className="flex items-center gap-4 text-xs font-semibold pt-1">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="landholder"
                            checked={isLandholder === true}
                            onChange={() => setIsLandholder(true)}
                          />
                          <span>Yes (Land in Family Name)</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="landholder"
                            checked={isLandholder === false}
                            onChange={() => setIsLandholder(false)}
                          />
                          <span>No Landholding</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-brand-slate">
                        Landholding Size (in Hectares)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        placeholder="e.g. 1.2"
                        value={landHectares}
                        onChange={(e) => setLandHectares(e.target.value)}
                        className="w-full py-2 px-3 rounded-lg border border-brand-border bg-white text-xs text-brand-navy focus:outline-hidden focus:ring-1 focus:ring-brand-blue"
                      />
                    </div>
                  </>
                )}

                {/* Student specific */}
                {(occupation === 'student' || scheme.category.toLowerCase().includes('educ')) && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-brand-slate">
                        Enrolled in Approved College / Degree?
                      </label>
                      <div className="flex items-center gap-4 text-xs font-semibold pt-1">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="collegeEnroll"
                            checked={isCollegeEnrolled === true}
                            onChange={() => setIsCollegeEnrolled(true)}
                          />
                          <span>Yes (Active Enrollment)</span>
                        </label>
                        <label className="inline-flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="collegeEnroll"
                            checked={isCollegeEnrolled === false}
                            onChange={() => setIsCollegeEnrolled(false)}
                          />
                          <span>No</span>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-brand-slate">
                        Previous Semester Attendance (%)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        placeholder="e.g. 75"
                        value={attendancePercentage}
                        onChange={(e) => setAttendancePercentage(e.target.value)}
                        className="w-full py-2 px-3 rounded-lg border border-brand-border bg-white text-xs text-brand-navy focus:outline-hidden focus:ring-1 focus:ring-brand-blue"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Document Readiness Checklist (Which ones citizen has) */}
              <div className="pt-2 space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-brand-slate">
                  Documents You Currently Possess (Select All That Apply)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-brand-border">
                  {scheme.requiredDocuments.map((docName, idx) => {
                    const isChecked = declaredDocuments.includes(docName);
                    return (
                      <label
                        key={idx}
                        className="flex items-center gap-2 text-xs font-medium text-brand-navy cursor-pointer hover:text-brand-blue"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleDocument(docName)}
                          className="rounded-sm text-brand-blue"
                        />
                        <span>{docName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="py-2 px-4 rounded-xl border border-brand-border text-brand-slate hover:text-brand-navy font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>

                <button
                  type="button"
                  onClick={handleRunAssessment}
                  disabled={isEvaluating}
                  className="py-2.5 px-6 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isEvaluating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Evaluating Statutory Rules...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span>Run Independent Eligibility Assessment</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CONDITION BREAKDOWN */}
          {currentStep === 3 && assessment && (
            <div className="space-y-4 animate-in fade-in duration-150">
              {/* Overall Status Banner */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  assessment.overallStatus === 'POTENTIALLY_ELIGIBLE'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : assessment.overallStatus === 'CRITERIA_UNMET'
                    ? 'bg-rose-50 border-rose-200 text-rose-950'
                    : 'bg-amber-50 border-amber-200 text-amber-950'
                }`}
              >
                {assessment.overallStatus === 'POTENTIALLY_ELIGIBLE' ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                ) : assessment.overallStatus === 'CRITERIA_UNMET' ? (
                  <X className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                ) : (
                  <HelpCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <h4 className="text-sm font-black uppercase tracking-wide">
                    {assessment.summaryTitle}
                  </h4>
                  <p className="text-xs leading-relaxed font-medium">
                    {assessment.summaryExplanation}
                  </p>
                </div>
              </div>

              {/* Condition by Condition Breakdown Table */}
              <div className="space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-brand-slate">
                  Condition-by-Condition Statutory Audit
                </span>

                <div className="space-y-3">
                  {assessment.conditionBreakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-brand-border bg-white shadow-2xs space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-brand-navy">
                          Condition #{idx + 1}: {item.conditionText}
                        </span>
                        {renderOutcomeBadge(item.outcome)}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200/60">
                        <div>
                          <span className="font-bold text-brand-slate block text-[10px] uppercase">
                            Your Profile Input:
                          </span>
                          <span className="text-brand-navy">{item.citizenInputSummary}</span>
                        </div>
                        <div>
                          <span className="font-bold text-brand-slate block text-[10px] uppercase">
                            Evaluation Finding:
                          </span>
                          <span className="text-brand-navy">{item.reason}</span>
                        </div>
                      </div>

                      {/* Official Source Citation */}
                      <div className="text-[11px] text-brand-slate flex items-center justify-between pt-1">
                        <span className="font-semibold text-brand-slate">
                          Sovereign Rule Source: {item.sourceCitation.title} ({item.sourceCitation.issuingAuthority})
                        </span>
                        <a
                          href={item.sourceCitation.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-blue hover:underline inline-flex items-center gap-1 font-bold"
                        >
                          <span>Official Gazette</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="py-2 px-4 rounded-xl border border-brand-border text-brand-slate hover:text-brand-navy font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="py-2.5 px-5 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-2"
                >
                  <span>Check Document Readiness</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: DOCUMENT READINESS */}
          {currentStep === 4 && assessment && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black text-brand-navy">
                    Document Readiness & Official Issuance Guide
                  </h3>
                  <p className="text-xs text-brand-slate">
                    Statutory documents required for application scrutiny.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                    Available: {assessment.documentReadiness.availableCount}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                    Check Validity: {assessment.documentReadiness.validityCheckCount}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px]">
                    Missing: {assessment.documentReadiness.missingCount}
                  </span>
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-3">
                {assessment.documentReadiness.checklist.map((doc, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-brand-border bg-white shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-bold text-xs text-brand-navy">
                        <FileText className="w-4 h-4 text-brand-blue" />
                        <span>{doc.documentName}</span>
                      </div>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          doc.status === 'AVAILABLE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : doc.status === 'REQUIRES_VALIDITY_CHECK'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {doc.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-xs text-brand-slate leading-relaxed">{doc.notes}</p>

                    <div className="text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 space-y-1">
                      <div className="font-semibold text-brand-navy">
                        <span className="text-brand-slate">Issuing Authority: </span>
                        {doc.issuingAuthority}
                      </div>
                      <div className="text-brand-slate">
                        <span className="font-semibold text-brand-navy">How to Obtain: </span>
                        {doc.howToObtain}
                      </div>
                    </div>

                    {doc.officialPortalUrl && (
                      <div className="pt-1 text-right">
                        <a
                          href={doc.officialPortalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-blue hover:underline inline-flex items-center gap-1 font-bold text-[11px]"
                        >
                          <span>Official Issuing Portal</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Navigation */}
              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="py-2 px-4 rounded-xl border border-brand-border text-brand-slate hover:text-brand-navy font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Condition Breakdown</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="py-2.5 px-5 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-2"
                >
                  <span>Application Roadmap</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: APPLICATION ROADMAP */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-brand-navy">
                  Official Application Roadmap ({scheme.applicationProcedure.mode} Mode)
                </h3>
                <p className="text-xs text-brand-slate">
                  Authoritative steps to register and apply without middlemen.
                </p>
              </div>

              <div className="space-y-2.5">
                {scheme.applicationProcedure.steps.map((st, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-xl border border-brand-border bg-white flex items-start gap-3 shadow-2xs"
                  >
                    <span className="w-6 h-6 rounded-full bg-brand-softblue text-brand-blue font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs text-brand-navy leading-relaxed font-medium">{st}</p>
                  </div>
                ))}
              </div>

              {/* Official Portal Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-brand-border flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-slate">
                    Designated Ministry Application Portal
                  </span>
                  <p className="text-xs font-bold text-brand-navy">
                    {scheme.applicationProcedure.officialPortalUrl}
                  </p>
                </div>
                <a
                  href={scheme.applicationProcedure.officialPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-4 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <span>Visit Official Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Navigation */}
              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="py-2 px-4 rounded-xl border border-brand-border text-brand-slate hover:text-brand-navy font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Document Readiness</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentStep(6)}
                  className="py-2.5 px-5 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-2"
                >
                  <span>Alternative Recommendations</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: ALTERNATIVE SCHEMES */}
          {currentStep === 6 && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-brand-navy">
                  Alternative Sovereign Scheme Recommendations
                </h3>
                <p className="text-xs text-brand-slate">
                  {assessment?.overallStatus === 'CRITERIA_UNMET'
                    ? 'Since some criteria for this scheme were unmet, consider exploring these related government programs.'
                    : 'Additional active government schemes in related categories that may benefit your household.'}
                </p>
              </div>

              {assessment?.alternativeSchemes && assessment.alternativeSchemes.length > 0 ? (
                <div className="space-y-3">
                  {assessment.alternativeSchemes.map((alt) => (
                    <div
                      key={alt.id}
                      className="p-4 rounded-xl border border-brand-border bg-white shadow-2xs space-y-2.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-brand-navy">
                          {alt.schemeName}
                        </h4>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-softblue text-brand-blue">
                          {alt.category}
                        </span>
                      </div>

                      <p className="text-xs text-brand-slate leading-relaxed">
                        <strong className="text-brand-navy">Benefits: </strong> {alt.benefits}
                      </p>

                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
                        <span className="font-bold block text-[10px] uppercase text-amber-800">
                          Preliminary Recommendation Notice:
                        </span>
                        {alt.evaluationNotice}
                      </div>

                      <div className="pt-1 flex items-center justify-between">
                        <a
                          href={alt.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-blue hover:underline inline-flex items-center gap-1 font-bold text-xs"
                        >
                          <span>Official Portal</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>

                        {onSelectAlternativeScheme && (
                          <button
                            type="button"
                            onClick={() => {
                              onSelectAlternativeScheme(alt.id);
                              onClose();
                            }}
                            className="py-1.5 px-3 rounded-lg bg-brand-softblue hover:bg-brand-softblue-border text-brand-blue font-bold text-xs transition-colors"
                          >
                            Assess This Scheme
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-brand-border bg-slate-50 text-brand-slate text-center space-y-1">
                  <p className="font-bold text-xs">No direct alternatives required.</p>
                  <p className="text-xs">
                    Your profile successfully meets the preliminary criteria for {scheme.schemeName}.
                  </p>
                </div>
              )}

              {/* Navigation */}
              <div className="pt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentStep(5)}
                  className="py-2 px-4 rounded-xl border border-brand-border text-brand-slate hover:text-brand-navy font-bold text-xs transition-colors flex items-center gap-1.5"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Roadmap</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-5 rounded-xl bg-brand-navy text-white font-bold text-xs transition-colors"
                >
                  Close Assessment
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Mandatory Sovereign Disclaimer */}
        <div className="p-3.5 sm:p-4 border-t border-brand-border bg-slate-50 text-[11px] text-brand-slate leading-relaxed flex items-center gap-2">
          <Info className="w-4 h-4 text-brand-blue shrink-0" />
          <span>
            <strong>Mandatory Sovereign Disclaimer:</strong> GovVerify AI provides informational guidance only. Official approval and final entitlement rest solely with the administering government authority.
          </span>
        </div>
      </div>
    </div>
  );
};
