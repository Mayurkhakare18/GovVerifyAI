/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 7: Application Status Guidance Component
 * Clear plain-language status explanations, official tracking channels,
 * grievance recourse pathways, and strict independent advisory disclaimers.
 */

import React, { useState } from 'react';
import {
  HelpCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileQuestion,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { ApplicationStatusGuidanceData } from '../../services/api/schemes';

interface ApplicationStatusGuideProps {
  initialStatusGuidance: ApplicationStatusGuidanceData;
  onStatusChange?: (newStatus: string) => void;
  isLoading?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'NOT_STARTED', label: 'Not Started', color: 'slate' },
  { value: 'DOCUMENTS_PENDING', label: 'Documents Pending', color: 'amber' },
  { value: 'READY_TO_APPLY', label: 'Ready to Apply', color: 'blue' },
  { value: 'SUBMITTED', label: 'Submitted', color: 'indigo' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: 'purple' },
  { value: 'APPROVED', label: 'Approved', color: 'emerald' },
  { value: 'REJECTED', label: 'Rejected', color: 'rose' },
  { value: 'UNKNOWN', label: 'Other / Unknown', color: 'slate' },
];

export const ApplicationStatusGuide: React.FC<ApplicationStatusGuideProps> = ({
  initialStatusGuidance,
  onStatusChange,
  isLoading = false,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>(
    initialStatusGuidance.currentStatus || 'NOT_STARTED'
  );

  const handleSelectStatus = (status: string) => {
    setSelectedStatus(status);
    if (onStatusChange) {
      onStatusChange(status);
    }
  };

  const isRejected = selectedStatus === 'REJECTED';
  const isApproved = selectedStatus === 'APPROVED';

  return (
    <div className="space-y-6 text-slate-800">
      {/* 1. Status Selection Tabs */}
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
          Select Your Current Official Application Status
        </label>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => {
            const isActive = selectedStatus === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelectStatus(opt.value)}
                disabled={isLoading}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/10'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Status Meaning & Explanation Card */}
      <div
        className={`rounded-2xl p-6 border transition-all ${
          isApproved
            ? 'bg-emerald-50/70 border-emerald-200'
            : isRejected
            ? 'bg-rose-50/70 border-rose-200'
            : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              isApproved
                ? 'bg-emerald-100 text-emerald-700'
                : isRejected
                ? 'bg-rose-100 text-rose-700'
                : 'bg-blue-100 text-blue-700'
            }`}
          >
            {isApproved ? (
              <CheckCircle className="w-6 h-6" />
            ) : isRejected ? (
              <XCircle className="w-6 h-6" />
            ) : (
              <Clock className="w-6 h-6" />
            )}
          </div>

          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Application Status Analysis
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-0.5">
              Status: {selectedStatus.replace(/_/g, ' ')}
            </h3>
            <p className="text-sm text-slate-700 mt-2 leading-relaxed">
              {initialStatusGuidance.statusMeaning}
            </p>
          </div>
        </div>

        {/* Concrete Next Steps */}
        {initialStatusGuidance.nextSteps && initialStatusGuidance.nextSteps.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-200/70">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2.5">
              Recommended Next Actions
            </h4>
            <ul className="space-y-2">
              {initialStatusGuidance.nextSteps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-700">
                  <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 3. Official Tracking Channels */}
      {initialStatusGuidance.trackingMethods && initialStatusGuidance.trackingMethods.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Official Application Tracking Channels
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {initialStatusGuidance.trackingMethods.map((method, idx) => (
              <div
                key={idx}
                className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 mb-1">{method.channel}</div>
                  <p className="text-xs text-slate-600 leading-relaxed">{method.instructions}</p>
                </div>
                {method.portalUrl && (
                  <div className="mt-3 pt-2 border-t border-slate-200/50">
                    <a
                      href={method.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800"
                    >
                      <span>Open Official Tracking Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Recourse & Appeal for Rejected / Issues */}
      {initialStatusGuidance.officialRecourseOrAppeal?.available && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                Official Appeal & Redressal Pathway
              </h4>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                {initialStatusGuidance.officialRecourseOrAppeal.instructions}
              </p>
              {initialStatusGuidance.officialRecourseOrAppeal.portalUrl && (
                <div className="mt-2.5">
                  <a
                    href={initialStatusGuidance.officialRecourseOrAppeal.portalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700 hover:text-blue-900 underline"
                  >
                    <span>Proceed to {initialStatusGuidance.officialRecourseOrAppeal.channel}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Mandatory Disclaimer */}
      <div className="bg-slate-100 rounded-xl p-4 text-xs text-slate-600 leading-relaxed flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>{initialStatusGuidance.disclaimer}</div>
      </div>
    </div>
  );
};
