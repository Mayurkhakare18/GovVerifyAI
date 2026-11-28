/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 9: Voice Conversation Panel Component
 * Displays multi-turn conversational messages with voice playback,
 * interactive scheme cards, single-question progressive eligibility flow,
 * application roadmaps, and factual claim verification verdicts.
 */

import React, { useRef, useEffect } from 'react';
import {
  User,
  Bot,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  FileText,
  Compass,
  ArrowRight,
  Shield,
  RotateCcw,
} from 'lucide-react';
import { SupportedLanguage } from '../../i18n';
import { useLanguage } from '../../contexts/LanguageContext';
import { VoiceResponsePlayer } from './VoiceResponsePlayer';
import { VoiceAssistantResponse, VoiceChatMessage } from '../../services/api/types';

export interface ExtendedVoiceMessage extends VoiceChatMessage {
  assistantResponse?: VoiceAssistantResponse;
}

interface VoiceConversationPanelProps {
  messages: ExtendedVoiceMessage[];
  language: SupportedLanguage;
  isLoading?: boolean;
  onSelectOption?: (optionText: string) => void;
  onSelectSchemeAction?: (schemeId: string, action: 'eligibility' | 'roadmap') => void;
  onClearConversation?: () => void;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  className?: string;
}

export const VoiceConversationPanel: React.FC<VoiceConversationPanelProps> = ({
  messages,
  language,
  isLoading = false,
  onSelectOption,
  onSelectSchemeAction,
  onClearConversation,
  onSpeakingChange,
  className = '',
}) => {
  const { t } = useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {messages.length === 0 && (
          <div className="py-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-softblue text-brand-blue flex items-center justify-center mx-auto shadow-xs">
              <Bot className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-brand-navy">
                {t('voice.title')}
              </h3>
              <p className="text-xs text-brand-slate max-w-sm mx-auto leading-relaxed">
                {t('voice.subtitle')}
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const payload = msg.assistantResponse?.actionPayload;
          const citations = msg.assistantResponse?.citations;

          return (
            <div
              key={msg.id || index}
              className={`flex gap-3 animate-in fade-in duration-150 ${
                isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {/* Avatar */}
              {!isUser && (
                <div className="w-8 h-8 rounded-xl bg-brand-navy text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              {/* Message Bubble Container */}
              <div className={`space-y-2 max-w-[88%] sm:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
                {/* Main Bubble */}
                <div
                  className={`p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    isUser
                      ? 'bg-brand-blue text-white rounded-br-xs shadow-xs font-medium'
                      : 'bg-white text-brand-navy border border-brand-border rounded-bl-xs shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Audio Player for Assistant Messages */}
                  {!isUser && msg.assistantResponse?.spokenText && (
                    <div className="pt-2 mt-2 border-t border-brand-border/40">
                      <VoiceResponsePlayer
                        textToSpeak={msg.assistantResponse.spokenText}
                        language={msg.assistantResponse.language || language}
                        autoPlay={index === messages.length - 1}
                        onSpeakingChange={onSpeakingChange}
                      />
                    </div>
                  )}
                </div>

                {/* ACTION PAYLOAD: Discovered Schemes */}
                {!isUser && payload?.schemes && payload.schemes.length > 0 && (
                  <div className="space-y-2 pt-1 w-full">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-brand-slate flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-brand-blue" />
                      <span>Sovereign Government Schemes</span>
                    </div>

                    <div className="space-y-2">
                      {payload.schemes.map((scheme: any) => (
                        <div
                          key={scheme.id}
                          className="p-3 rounded-xl border border-brand-border bg-white shadow-2xs space-y-2"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-1.5">
                            <div>
                              <h4 className="text-xs sm:text-sm font-bold text-brand-navy">
                                {scheme.schemeName}
                              </h4>
                              {scheme.shortName && (
                                <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-brand-softblue text-brand-blue">
                                  {scheme.shortName}
                                </span>
                              )}
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-brand-bg-subtle text-brand-slate border border-brand-border/60">
                              {scheme.jurisdiction}
                            </span>
                          </div>

                          <p className="text-xs text-brand-slate leading-relaxed">
                            {scheme.benefits}
                          </p>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            {onSelectSchemeAction && (
                              <button
                                type="button"
                                onClick={() => onSelectSchemeAction(scheme.id, 'eligibility')}
                                className="px-3 py-1 rounded-lg bg-brand-blue hover:bg-brand-blue-hover text-white text-[11px] font-bold transition-colors flex items-center gap-1 shadow-2xs"
                              >
                                <span>Check Eligibility</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}

                            {onSelectSchemeAction && (
                              <button
                                type="button"
                                onClick={() => onSelectSchemeAction(scheme.id, 'roadmap')}
                                className="px-3 py-1 rounded-lg bg-brand-softblue hover:bg-brand-softblue-border text-brand-blue text-[11px] font-semibold transition-colors"
                              >
                                View Roadmap
                              </button>
                            )}

                            {scheme.officialUrl && (
                              <a
                                href={scheme.officialUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-brand-slate hover:text-brand-navy flex items-center gap-0.5 underline font-medium ml-auto"
                              >
                                <span>Official Portal</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ACTION PAYLOAD: Progressive Eligibility Single Question */}
                {!isUser && payload?.eligibilityStep && !payload.eligibilityStep.isComplete && (
                  <div className="p-3.5 rounded-xl border border-brand-blue/30 bg-brand-softblue/30 space-y-2.5 w-full">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-brand-blue uppercase tracking-wide">
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Statutory Eligibility Question</span>
                    </div>

                    <p className="text-xs sm:text-sm font-semibold text-brand-navy">
                      {payload.eligibilityStep.question}
                    </p>

                    <p className="text-[11px] text-brand-slate italic">
                      Official Rationale: {payload.eligibilityStep.rationale}
                    </p>

                    {payload.eligibilityStep.options && onSelectOption && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {payload.eligibilityStep.options.map((opt: string, i: number) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => onSelectOption(opt)}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-brand-softblue text-brand-navy text-xs font-semibold border border-brand-border shadow-2xs transition-colors"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ACTION PAYLOAD: Completed Eligibility Assessment */}
                {!isUser && payload?.eligibilityStep?.isComplete && payload.eligibilityStep.finalAssessment && (
                  <div className="p-3.5 rounded-xl border border-emerald-300 bg-emerald-50/70 space-y-2 w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase tracking-wide text-brand-navy flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Assessment Complete</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-600 text-white">
                        {payload.eligibilityStep.finalAssessment.overallStatus}
                      </span>
                    </div>

                    <p className="text-xs text-brand-slate leading-relaxed">
                      {payload.eligibilityStep.finalAssessment.summaryExplanation}
                    </p>
                  </div>
                )}

                {/* ACTION PAYLOAD: Factual Claim Verification Verdict */}
                {!isUser && payload?.verdict && (
                  <div className="p-3.5 rounded-xl border border-brand-border bg-white shadow-2xs space-y-2 w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand-navy flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-brand-blue" />
                        <span>Sovereign Claim Audit</span>
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                          payload.verdict.verdict === 'SUPPORTED'
                            ? 'bg-emerald-600 text-white'
                            : payload.verdict.verdict === 'PARTIALLY_SUPPORTED'
                            ? 'bg-amber-500 text-white'
                            : payload.verdict.verdict === 'CONTRADICTED'
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-500 text-white'
                        }`}
                      >
                        {payload.verdict.verdict}
                      </span>
                    </div>

                    <p className="text-xs text-brand-slate leading-relaxed">
                      {payload.verdict.explanation}
                    </p>
                  </div>
                )}

                {/* Official Sovereign Citations */}
                {!isUser && citations && citations.length > 0 && (
                  <div className="p-2.5 rounded-lg border border-brand-border/60 bg-brand-bg-subtle/50 text-[11px] text-brand-slate space-y-1 w-full">
                    <div className="font-bold text-brand-navy flex items-center gap-1 text-[10px] uppercase tracking-wider">
                      <Shield className="w-3 h-3 text-brand-blue" />
                      <span>Verified Sovereign Sources:</span>
                    </div>
                    {citations.map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-brand-blue font-bold">[{i + 1}]</span>
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-brand-navy truncate flex items-center gap-1"
                        >
                          <span className="truncate">{c.title || c.authority}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* User Avatar */}
              {isUser && (
                <div className="w-8 h-8 rounded-xl bg-brand-softblue text-brand-blue flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex gap-3 justify-start animate-in fade-in duration-150">
            <div className="w-8 h-8 rounded-xl bg-brand-navy text-white flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-white border border-brand-border rounded-bl-xs shadow-xs text-xs text-brand-slate flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-brand-blue animate-bounce" />
              </span>
              <span>{t('voice.processing')}</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Conversation Toolbar */}
      {messages.length > 0 && onClearConversation && (
        <div className="px-4 py-2 border-t border-brand-border/60 bg-brand-bg-subtle/40 flex justify-end">
          <button
            type="button"
            onClick={onClearConversation}
            className="text-[11px] font-semibold text-brand-slate hover:text-brand-navy transition-colors flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Assistant</span>
          </button>
        </div>
      )}
    </div>
  );
};
