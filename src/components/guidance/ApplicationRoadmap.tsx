/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 7: Application Roadmap Component
 * Displays verified application procedures, official portals,
 * submission authorities, approval milestones, and contact/grievance channels.
 */

import React from 'react';
import {
  ExternalLink,
  ShieldCheck,
  Calendar,
  Building,
  CheckCircle2,
  Phone,
  Mail,
  AlertTriangle,
  FileText,
  Info,
} from 'lucide-react';
import { ApplicationRoadmapData } from '../../services/api/schemes';
import { useLanguage } from '../../contexts/LanguageContext';

interface ApplicationRoadmapProps {
  roadmap: ApplicationRoadmapData;
  onOpenChecklist?: () => void;
}

export const ApplicationRoadmap: React.FC<ApplicationRoadmapProps> = ({
  roadmap,
  onOpenChecklist,
}) => {
  const { t } = useLanguage();
  return (
    <div className="space-y-6 text-slate-800">
      {/* 1. Header Overview & Verified Portal */}
      <div className="bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 rounded-2xl p-6 border border-indigo-100/80 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 tracking-wide uppercase">
                {roadmap.applicationMethod} Application
              </span>
              {roadmap.isApplicationPortalVerified ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {t('guidance.verifiedPortal') || 'Verified Portal'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  {t('guidance.unverifiedPortal') || 'Portal Unconfirmed'}
                </span>
              )}
            </div>
            <h3 className="text-xl font-bold text-slate-900">{roadmap.schemeName}</h3>
            <p className="text-sm text-slate-600 mt-0.5">{roadmap.ministryOrDepartment}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            {roadmap.officialApplicationPortal && (
              <a
                href={roadmap.officialApplicationPortal}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm hover:shadow transition-all group"
              >
                <span>{t('guidance.openOfficialPortal') || 'Open Official Portal'}</span>
                <ExternalLink className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            )}
            {onOpenChecklist && (
              <button
                type="button"
                onClick={onOpenChecklist}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4 text-indigo-600" />
                <span>{t('guidance.prepareDocuments') || 'Prepare Documents'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Start / End Dates & Submission Authority */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-indigo-100/60">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Application Window</div>
              <div className="text-sm font-semibold text-slate-800 mt-0.5">
                {roadmap.applicationStartAndEndDates.startDate} — {roadmap.applicationStartAndEndDates.endDate}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{roadmap.applicationStartAndEndDates.note}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-100/70 text-indigo-700 flex items-center justify-center shrink-0">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Submission Authority</div>
              <div className="text-sm font-semibold text-slate-800 mt-0.5">{roadmap.submissionAuthority}</div>
              <div className="text-xs text-slate-500 mt-0.5">Statutory government department responsible for processing</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Step-by-Step Instructions */}
      <div className="space-y-4">
        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <span>Application Procedure & Instructions</span>
        </h4>

        {/* Online Steps */}
        {roadmap.stepByStepInstructions.online.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span>
              Online Submission Pathway
            </div>
            <ol className="space-y-3">
              {roadmap.stepByStepInstructions.online.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-50 text-blue-700 font-bold text-xs shrink-0 mt-0.5 border border-blue-200">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Offline Steps */}
        {roadmap.stepByStepInstructions.offline.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-3 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-600"></span>
              Offline / CSC Kendra Pathway
            </div>
            <ol className="space-y-3">
              {roadmap.stepByStepInstructions.offline.map((step, idx) => (
                <li key={idx} className="flex items-start gap-3 text-sm text-slate-700">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-700 font-bold text-xs shrink-0 mt-0.5 border border-amber-200">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {/* 3. Verification & Approval Process Milestones */}
      {roadmap.verificationAndApprovalProcess.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-base font-bold text-slate-900">Verification & Approval Stages</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {roadmap.verificationAndApprovalProcess.map((milestone) => (
              <div
                key={milestone.stageNumber}
                className="bg-slate-50/70 rounded-xl p-4 border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">
                      Stage {milestone.stageNumber}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">{milestone.estimatedTimelineOrNote}</span>
                  </div>
                  <div className="text-sm font-semibold text-slate-900">{milestone.stageName}</div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{milestone.description}</p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-200/60 text-[11px] text-slate-500 font-medium">
                  Authority: {milestone.responsibleAuthority}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Grievance & Official Contacts */}
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
          Official Helpdesk & Grievance Redressal
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
          {roadmap.officialContactAndGrievance.helplinePhone && (
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Helpline: <strong className="font-semibold text-slate-900">{roadmap.officialContactAndGrievance.helplinePhone}</strong></span>
            </div>
          )}
          {roadmap.officialContactAndGrievance.helplineEmail && (
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Email: <strong className="font-semibold text-slate-900">{roadmap.officialContactAndGrievance.helplineEmail}</strong></span>
            </div>
          )}
          {roadmap.officialContactAndGrievance.grievancePortalUrl && (
            <div className="flex items-center gap-2">
              <ExternalLink className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <a
                href={roadmap.officialContactAndGrievance.grievancePortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline font-semibold"
              >
                {roadmap.officialContactAndGrievance.grievancePortalName || 'Grievance Portal'}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* 5. Authoritative Source Citations */}
      {roadmap.sourceCitations.length > 0 && (
        <div className="pt-2">
          <div className="text-xs font-semibold text-slate-500 mb-2">Verified Official Sources:</div>
          <div className="flex flex-wrap gap-2">
            {roadmap.sourceCitations.map((src, idx) => (
              <a
                key={idx}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white hover:bg-slate-50 text-blue-700 border border-slate-200 rounded-lg transition-colors"
              >
                <span>{src.title}</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 6. Statutory Disclaimer */}
      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-amber-900 leading-relaxed">
        <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>{roadmap.statutoryDisclaimer}</div>
      </div>
    </div>
  );
};
