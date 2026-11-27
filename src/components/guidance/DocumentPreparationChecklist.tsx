/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 7: Document Preparation Checklist
 * Interactive preparation checklist helping citizens organize required documents,
 * understand format/validity criteria, and locate official issuing authorities.
 */

import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  ShieldAlert,
  ExternalLink,
  Building2,
  FileCheck,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  DocumentPreparationChecklistData,
  DocumentChecklistPreparationItem,
} from '../../services/api/schemes';

interface DocumentPreparationChecklistProps {
  checklistData: DocumentPreparationChecklistData;
  onToggleDocumentReady: (documentId: string, isReady: boolean) => void;
}

export const DocumentPreparationChecklist: React.FC<DocumentPreparationChecklistProps> = ({
  checklistData,
  onToggleDocumentReady,
}) => {
  const [selectedDocDetails, setSelectedDocDetails] = useState<DocumentChecklistPreparationItem | null>(null);

  const percentage = checklistData.readinessPercentage;
  const isComplete = checklistData.readyCount === checklistData.totalDocuments;

  return (
    <div className="space-y-6 text-slate-800">
      {/* 1. Readiness Progress Overview */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-white rounded-2xl p-6 border border-blue-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-700">
              Document Readiness Assistant
            </div>
            <h3 className="text-xl font-bold text-slate-900 mt-1">
              {checklistData.readyCount} of {checklistData.totalDocuments} Documents Ready
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Confirm each required document before beginning your official application submission.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-2xl font-black text-slate-900">{percentage}%</span>
              <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                {isComplete ? 'All Ready' : `${checklistData.missingCount} Missing`}
              </div>
            </div>
            <div className="w-14 h-14 rounded-full border-4 border-slate-200 flex items-center justify-center relative overflow-hidden bg-white shadow-inner">
              <div
                className={`absolute inset-0 ${isComplete ? 'bg-emerald-500' : 'bg-blue-600'} opacity-15`}
                style={{ height: `${percentage}%`, bottom: 0, top: 'auto' }}
              />
              <FileCheck className={`w-6 h-6 ${isComplete ? 'text-emerald-600' : 'text-blue-600'}`} />
            </div>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden mt-4">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* 2. Privacy & Sovereign Notice */}
      <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3.5 flex items-start gap-3 text-xs text-emerald-950">
        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-semibold">Privacy First:</strong> {checklistData.privacyNotice}
        </div>
      </div>

      {/* 3. Interactive Checklist Items */}
      <div className="space-y-3">
        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          Required Documents Checklist
        </h4>

        <div className="space-y-2.5">
          {checklistData.documents.map((doc) => {
            const isReady = doc.isReady;
            return (
              <div
                key={doc.documentId}
                className={`rounded-xl border transition-all ${
                  isReady
                    ? 'bg-emerald-50/40 border-emerald-200/80'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <div className="p-4 flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() => onToggleDocumentReady(doc.documentId, !isReady)}
                    className="mt-0.5 shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={`Mark ${doc.documentName} as ${isReady ? 'missing' : 'ready'}`}
                  >
                    {isReady ? (
                      <CheckSquare className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{doc.documentName}</span>
                      {doc.isMandatory ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 uppercase tracking-wide">
                          Mandatory
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase tracking-wide">
                          Optional
                        </span>
                      )}
                      {isReady && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                          Marked Ready
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{doc.description}</p>

                    {/* Format & Validity pills */}
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <FileCheck className="w-3 h-3 text-slate-400" />
                        Format: <strong className="font-medium text-slate-700">{doc.formatRequirements}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        Validity: <strong className="font-medium text-slate-700">{doc.validityRequirements}</strong>
                      </span>
                    </div>

                    {/* How to obtain banner */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>Issued by: <strong className="font-medium text-slate-800">{doc.whereToObtain.authority}</strong></span>
                      </div>

                      {doc.whereToObtain.portalUrl && (
                        <a
                          href={doc.whereToObtain.portalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          <span>Obtain via {doc.whereToObtain.portalName || 'Official Portal'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. Official Guidance Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600 leading-relaxed flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <div>{checklistData.officialGuidanceNotice}</div>
      </div>
    </div>
  );
};
