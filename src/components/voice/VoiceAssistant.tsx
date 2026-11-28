/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 9: Voice-Based AI Citizen Assistant
 * Fully integrated multilingual voice assistant modal / sliding drawer.
 * Supports English (en-IN), Hindi (hi-IN), and Marathi (mr-IN).
 * Connects conversational scheme discovery, single-question progressive eligibility,
 * application guidance roadmaps, and canonical fact-checking claim verification.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  X,
  Volume2,
  Sparkles,
  ShieldAlert,
  RotateCcw,
  Languages,
  Info,
  ChevronDown,
  Minimize2,
  Maximize2,
  Shield,
  HelpCircle,
  Compass,
} from 'lucide-react';
import { SupportedLanguage } from '../../i18n';
import { useLanguage } from '../../contexts/LanguageContext';
import { VoiceInput } from './VoiceInput';
import { VoiceConversationPanel, ExtendedVoiceMessage } from './VoiceConversationPanel';
import { voiceApi } from '../../services/api/voice';
import { VoiceAssistantSessionState, VoiceAssistantResponse } from '../../services/api/types';

interface VoiceAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuery?: string;
  className?: string;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  isOpen,
  onClose,
  initialQuery,
  className = '',
}) => {
  const { language, setLanguage, t, languages } = useLanguage();
  const [messages, setMessages] = useState<ExtendedVoiceMessage[]>([]);
  const [sessionState, setSessionState] = useState<VoiceAssistantSessionState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);

  // Initialize welcome message whenever language changes or when first opened with empty chat
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeText = t('voice.greeting');
      setMessages([
        {
          id: 'welcome-msg',
          role: 'assistant',
          sender: 'assistant',
          content: welcomeText,
          text: welcomeText,
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  }, [language, t]);

  // Handle initial query if provided when opening
  useEffect(() => {
    if (isOpen && initialQuery && initialQuery.trim()) {
      handleSendMessage(initialQuery.trim());
    }
  }, [isOpen, initialQuery]);

  // Handle sending a message to the backend voice assistant engine
  const handleSendMessage = async (text: string) => {
    if (!text || !text.trim() || isLoading) return;

    setErrorMessage(null);
    const userMsgId = `user-${Date.now()}`;
    const userMsg: ExtendedVoiceMessage = {
      id: userMsgId,
      role: 'user',
      sender: 'citizen',
      content: text.trim(),
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const response = await voiceApi.chat({
        query: text.trim(),
        message: text.trim(),
        language,
        sessionState,
        preferredSpeed: 1.0,
      });

      // Update active session state for multi-turn progressive flows
      if (response.sessionState) {
        setSessionState(response.sessionState);
      }

      const botMsgId = `bot-${Date.now()}`;
      const botMsg: ExtendedVoiceMessage = {
        id: botMsgId,
        role: 'assistant',
        sender: 'assistant',
        content: response.spokenResponse || response.spokenText,
        text: response.spokenResponse || response.spokenText,
        timestamp: new Date().toISOString(),
        intent: response.intent,
        schemes: response.schemes || response.actionPayload?.schemes,
        progressiveStep: response.progressiveEligibility || response.actionPayload?.eligibilityStep,
        eligibilityResult: response.eligibilityResult || response.actionPayload?.eligibilityStep?.finalAssessment,
        roadmap: response.applicationRoadmap || response.actionPayload?.roadmap,
        verificationResult: response.verificationResult || response.actionPayload?.verdict,
        assistantResponse: response,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error('[VoiceAssistant] Error querying voice chat:', err);
      const fallbackErr =
        language === 'mr'
          ? 'माफ करा, विनंती पूर्ण करताना अडचण आली. कृपया पुन्हा प्रयत्न करा.'
          : language === 'hi'
          ? 'क्षमा करें, अनुरोध संसाधित करते समय त्रुटि हुई। कृपया पुनः प्रयास करें।'
          : 'Sorry, there was an issue processing your voice query. Please try again.';

      setErrorMessage(err?.message || fallbackErr);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: 'assistant',
          sender: 'assistant',
          content: err?.message || fallbackErr,
          text: err?.message || fallbackErr,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset conversation to initial state
  const handleClearConversation = () => {
    setSessionState({});
    setErrorMessage(null);
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        sender: 'assistant',
        content: t('voice.greeting'),
        text: t('voice.greeting'),
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  // Quick prompt chips by language
  const quickPrompts = {
    en: [
      { label: 'Farmer Schemes', query: 'Show me government schemes for farmers' },
      { label: 'PM-KISAN Eligibility', query: 'Am I eligible for PM-KISAN?' },
      { label: 'Student Scholarship Docs', query: 'What documents are required for post-matric scholarships?' },
      { label: 'Verify WhatsApp Claim', query: 'Is the WhatsApp message about 50,000 subsidy payout genuine?' },
    ],
    hi: [
      { label: 'किसान योजनाएं', query: 'मुझे किसानों के लिए सरकारी योजनाएं बताइए।' },
      { label: 'पीएम किसान पात्रता', query: 'क्या मैं पीएम किसान सम्मान निधि के लिए पात्र हूँ?' },
      { label: 'छात्रवृत्ति दस्तावेज', query: 'छात्रवृत्ति के लिए कौन से दस्तावेज चाहिए?' },
      { label: 'दावे का सत्यापन', query: 'क्या सभी को ₹50,000 मिलने का दावा सच है?' },
    ],
    mr: [
      { label: 'शेतकरी योजना', query: 'महाराष्ट्रातील शेतकऱ्यांसाठी कोणत्या योजना आहेत?' },
      { label: 'पीएम किसान पात्रता', query: 'मी पीएम किसान योजनेसाठी पात्र आहे का?' },
      { label: 'शिष्यवृत्ती कागदपत्रे', query: 'महाडीबीटी शिष्यवृत्तीसाठी कोणती कागदपत्रे लागतात?' },
      { label: 'दावा पडताळा', query: 'व्हॉट्सॲपवरील ₹५०,००० अनुदानाचा दावा खरा आहे का?' },
    ],
  }[language] || [
    { label: 'Farmer Schemes', query: 'Show me government schemes for farmers' },
    { label: 'Check Eligibility', query: 'Am I eligible for PM-KISAN?' },
  ];

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-end sm:items-center justify-end p-0 sm:p-4 md:p-6 transition-all duration-200 ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="voice-assistant-title"
    >
      <div
        className={`bg-white w-full sm:max-w-xl md:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col transition-all duration-300 ${
          isMinimized ? 'h-[72px]' : 'h-[92vh] sm:h-[86vh] max-h-[880px]'
        }`}
      >
        {/* Assistant Header */}
        <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-[#0F1E36] via-[#162D50] to-[#1E3A68] text-white rounded-t-2xl flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-md">
                <div className="w-full h-full bg-[#0F1E36] rounded-[10px] flex items-center justify-center">
                  <Mic className="w-5 h-5 text-emerald-400 animate-pulse" />
                </div>
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#0F1E36]" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 id="voice-assistant-title" className="text-sm sm:text-base font-bold tracking-tight">
                  {t('voice.title')}
                </h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-400/20 text-emerald-300 rounded-md border border-emerald-400/30">
                  {language.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 hidden sm:block">
                {t('voice.subtitle')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Language Selector Dropdown */}
            <div className="relative inline-flex items-center">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                className="bg-white/10 hover:bg-white/15 text-white text-xs font-semibold py-1 px-2.5 rounded-lg border border-white/20 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer appearance-none pr-6"
                aria-label="Select Voice Assistant Language"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#0F1E36] text-white">
                    {l.native}
                  </option>
                ))}
              </select>
              <Languages className="w-3.5 h-3.5 text-slate-300 absolute right-2 pointer-events-none" />
            </div>

            {/* Clear Conversation */}
            <button
              type="button"
              onClick={handleClearConversation}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              title={t('voice.clearConversation')}
              aria-label="Reset conversation"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Minimize / Maximize */}
            <button
              type="button"
              onClick={() => setIsMinimized((prev) => !prev)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors hidden sm:inline-flex"
              title={isMinimized ? 'Expand' : 'Minimize'}
              aria-label="Toggle minimize"
            >
              {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close voice assistant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Quick Prompts Bar */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto flex items-center gap-2 shrink-0 no-scrollbar">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>{language === 'mr' ? 'सुझाव:' : language === 'hi' ? 'सुझाव:' : 'Try:'}</span>
              </span>
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(p.query)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-full text-xs font-medium bg-white text-slate-700 hover:bg-[#EAF1FF] hover:text-[#2457C5] border border-slate-200 hover:border-[#2457C5]/40 transition-colors shrink-0 disabled:opacity-50"
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Conversation Flow Area */}
            <div className="flex-1 overflow-hidden flex flex-col bg-[#F7F9FC]">
              <VoiceConversationPanel
                messages={messages}
                language={language}
                isLoading={isLoading}
                onSpeakingChange={setIsAssistantSpeaking}
                onSelectOption={(option) => handleSendMessage(option)}
                onSelectSchemeAction={(schemeId, action) => {
                  if (action === 'eligibility') {
                    handleSendMessage(
                      language === 'mr'
                        ? `या योजनेसाठी पात्रता तपासा: ${schemeId}`
                        : language === 'hi'
                        ? `इस योजना के लिए पात्रता जांचें: ${schemeId}`
                        : `Check eligibility criteria for scheme ID: ${schemeId}`
                    );
                  } else {
                    handleSendMessage(
                      language === 'mr'
                        ? `या योजनेचा अर्ज मार्गदर्शक आणि कागदपत्रे दाखवा: ${schemeId}`
                        : language === 'hi'
                        ? `इस योजना का आवेदन रोडमैप और दस्तावेज दिखाएं: ${schemeId}`
                        : `Show application roadmap and documents for scheme ID: ${schemeId}`
                    );
                  }
                }}
                onClearConversation={handleClearConversation}
                className="flex-1"
              />
            </div>

            {/* Voice & Text Input Section */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200 shrink-0">
              <VoiceInput
                onSendMessage={handleSendMessage}
                disabled={isLoading}
                isLoading={isLoading}
                selectedLanguage={language}
                onLanguageChange={setLanguage}
                isAssistantSpeaking={isAssistantSpeaking}
                placeholder={t('voice.speakPrompt')}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};
