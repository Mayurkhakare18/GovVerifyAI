/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 7: Application Assistance Modal
 * End-to-end citizen application assistance hub connecting:
 * 1. Official Application Roadmap & Portal Navigator
 * 2. Document Preparation Checklist
 * 3. Application Status Guidance & Tracking
 * 4. Interactive Sovereign AI Application Assistant
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Compass,
  FileCheck2,
  Activity,
  Bot,
  ShieldCheck,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  schemeApi,
  ApplicationRoadmapData,
  DocumentPreparationChecklistData,
  ApplicationStatusGuidanceData,
} from '../../services/api/schemes';
import { ApplicationRoadmap } from './ApplicationRoadmap';
import { DocumentPreparationChecklist } from './DocumentPreparationChecklist';
import { ApplicationStatusGuide } from './ApplicationStatusGuide';
import { SchemeApplicationAssistant } from './SchemeApplicationAssistant';
import { useLanguage } from '../../contexts/LanguageContext';

interface ApplicationAssistanceModalProps {
  schemeId: string;
  schemeName: string;
  initialTab?: 'roadmap' | 'documents' | 'status' | 'assistant';
  isOpen: boolean;
  onClose: () => void;
}

export const ApplicationAssistanceModal: React.FC<ApplicationAssistanceModalProps> = ({
  schemeId,
  schemeName,
  initialTab = 'roadmap',
  isOpen,
  onClose,
}) => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'roadmap' | 'documents' | 'status' | 'assistant'>(
    initialTab
  );

  const [roadmap, setRoadmap] = useState<ApplicationRoadmapData | null>(null);
  const [checklist, setChecklist] = useState<DocumentPreparationChecklistData | null>(null);
  const [statusGuidance, setStatusGuidance] = useState<ApplicationStatusGuidanceData | null>(null);
  const [readyDocIds, setReadyDocIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load initial data for the scheme
  useEffect(() => {
    if (!isOpen || !schemeId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    Promise.all([
      schemeApi.getApplicationRoadmap(schemeId),
      schemeApi.getDocumentChecklist(schemeId, readyDocIds),
      schemeApi.getStatusGuidance(schemeId, 'NOT_STARTED'),
    ])
      .then(([rm, cl, sg]) => {
        if (!isMounted) return;
        setRoadmap(rm);
        setChecklist(cl);
        setStatusGuidance(sg);
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setError(err.message || 'Unable to load scheme application assistance data.');
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, schemeId]);

  // Handle document toggle
  const handleToggleDocumentReady = async (docId: string, isReady: boolean) => {
    const updatedIds = isReady
      ? Array.from(new Set([...readyDocIds, docId]))
      : readyDocIds.filter((id) => id !== docId);

    setReadyDocIds(updatedIds);

    try {
      const updatedChecklist = await schemeApi.getDocumentChecklist(schemeId, updatedIds);
      setChecklist(updatedChecklist);
    } catch {
      // Optimistic state preserved
    }
  };

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    try {
      const updated = await schemeApi.getStatusGuidance(schemeId, newStatus);
      setStatusGuidance(updated);
    } catch {
      // Retain existing
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 tracking-wide uppercase">
                <Compass className="w-3.5 h-3.5" />
                Phase 7 Application Engine
              </span>
              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Sovereign Assistance Hub
              </span>
            </div>
            <h2 className="text-xl font-black text-slate-900 mt-1">
              Application Assistance — {schemeName}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 flex gap-2 shrink-0 overflow-x-auto bg-slate-50/50">
          <button
            type="button"
            onClick={() => setActiveTab('roadmap')}
            className={`py-3.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'roadmap'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>{t('guidance.tabRoadmap')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('documents')}
            className={`py-3.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'documents'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>{t('guidance.tabDocuments')}</span>
            {checklist && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-slate-200 text-slate-700 font-extrabold">
                {checklist.readyCount}/{checklist.totalDocuments}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('status')}
            className={`py-3.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'status'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>{t('guidance.tabStatus')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('assistant')}
            className={`py-3.5 px-3.5 text-xs font-bold border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'assistant'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bot className="w-4 h-4 text-indigo-600" />
            <span>{t('guidance.tabAssistant')}</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
              <p className="text-sm font-medium">Loading verified application guidance...</p>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-900 max-w-md mx-auto my-12">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
              <h3 className="font-bold text-sm">Failed to Load Guidance</h3>
              <p className="text-xs text-rose-700 mt-1">{error}</p>
              <button
                type="button"
                onClick={() => {
                  setIsLoading(true);
                  setError(null);
                  Promise.all([
                    schemeApi.getApplicationRoadmap(schemeId),
                    schemeApi.getDocumentChecklist(schemeId, readyDocIds),
                    schemeApi.getStatusGuidance(schemeId, 'NOT_STARTED'),
                  ])
                    .then(([rm, cl, sg]) => {
                      setRoadmap(rm);
                      setChecklist(cl);
                      setStatusGuidance(sg);
                      setIsLoading(false);
                    })
                    .catch((err: any) => {
                      setError(err.message || 'Retry failed.');
                      setIsLoading(false);
                    });
                }}
                className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors inline-flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'roadmap' && roadmap && (
                <ApplicationRoadmap
                  roadmap={roadmap}
                  onOpenChecklist={() => setActiveTab('documents')}
                />
              )}

              {activeTab === 'documents' && checklist && (
                <DocumentPreparationChecklist
                  checklistData={checklist}
                  onToggleDocumentReady={handleToggleDocumentReady}
                />
              )}

              {activeTab === 'status' && statusGuidance && (
                <ApplicationStatusGuide
                  initialStatusGuidance={statusGuidance}
                  onStatusChange={handleStatusChange}
                />
              )}

              {activeTab === 'assistant' && (
                <SchemeApplicationAssistant schemeId={schemeId} schemeName={schemeName} />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>All instructions verified against sovereign government publications (.gov.in / .nic.in).</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
