/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 9: Voice Input Component with High-Accuracy Speech Recognition
 * Implements strict Web Speech API SpeechRecognition specifications:
 * - Explicit locale configuration: en-IN (English), hi-IN (Hindi), mr-IN (Marathi).
 * - Clean separation of finalized transcript from real-time interim recognition results.
 * - Zero word/phrase duplication on repeated onresult cycles.
 * - Continuous recognition with explicit citizen start/stop triggers.
 * - Editable transcript buffer with in-flight sensitive PII guardrails.
 * - Echo prevention: Pauses/disables recording while assistant TTS is speaking.
 * - Accessible microphone permission denial recovery and browser fallback.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Send,
  AlertCircle,
  X,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Languages,
  Square,
  VolumeX,
} from 'lucide-react';
import { SupportedLanguage, SUPPORTED_I18N_LANGUAGES } from '../../i18n';
import { useLanguage } from '../../contexts/LanguageContext';
import { checkSensitiveIdentifierViolation } from '../../utils/sensitiveIdentifiers';

interface VoiceInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  selectedLanguage: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  isAssistantSpeaking?: boolean;
  placeholder?: string;
  className?: string;
}

// Window declaration for Web Speech API recognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onSendMessage,
  disabled = false,
  selectedLanguage,
  onLanguageChange,
  isAssistantSpeaking = false,
  placeholder,
  className = '',
}) => {
  const { t, setLanguage } = useLanguage();
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [piiWarning, setPiiWarning] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isManuallyStoppedRef = useRef(false);

  // Check browser SpeechRecognition support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsSupported(false);
      }
    }
  }, []);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        isManuallyStoppedRef.current = true;
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  // Stop recording if assistant starts speaking to prevent audio feedback/echo
  useEffect(() => {
    if (isAssistantSpeaking && isRecording) {
      stopRecording();
    }
  }, [isAssistantSpeaking, isRecording]);

  /**
   * Stop active speech recognition cleanly and merge any remaining interim segment
   */
  const stopRecording = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsRecording(false);

    // If there is any trailing interim text, merge it once cleanly into finalTranscript
    setInterimTranscript((prevInterim) => {
      if (prevInterim.trim()) {
        setFinalTranscript((prevFinal) => {
          const merged = prevFinal ? `${prevFinal.trim()} ${prevInterim.trim()}` : prevInterim.trim();
          const pii = checkSensitiveIdentifierViolation(merged, selectedLanguage);
          if (pii.isViolated) {
            setPiiWarning(pii.refusalMessage || 'Sensitive identifier detected');
          }
          return merged;
        });
      }
      return '';
    });
  }, [selectedLanguage]);

  /**
   * Start speech recognition with strict locale binding and clean event listeners
   */
  const startRecording = useCallback(() => {
    if (disabled || isAssistantSpeaking) return;
    setMicError(null);
    setPiiWarning(null);
    isManuallyStoppedRef.current = false;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError(t('voice.micUnsupported'));
      return;
    }

    try {
      // Abort any existing instance
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Stay active while user speaks multiple phrases
      recognition.interimResults = true; // Stream interim results for real-time visual feedback
      recognition.maxAlternatives = 1;

      // Explicit locale configuration matching citizen selection
      const localeMap: Record<SupportedLanguage, string> = {
        mr: 'mr-IN',
        hi: 'hi-IN',
        en: 'en-IN',
      };
      recognition.lang = localeMap[selectedLanguage] || 'en-IN';

      recognition.onstart = () => {
        setIsRecording(true);
        setMicError(null);
      };

      /**
       * HIGH-ACCURACY TRANSCRIPTION HANDLER
       * Crucial Fix: Only accumulate to final transcript when item.isFinal is true.
       * Keep interim results in a separate ephemeral state to avoid word doubling/garbling.
       */
      recognition.onresult = (event: any) => {
        let currentInterim = '';
        let newlyFinalizedChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const text = result[0]?.transcript || '';

          if (result.isFinal) {
            newlyFinalizedChunk += (newlyFinalizedChunk ? ' ' : '') + text.trim();
          } else {
            currentInterim += (currentInterim ? ' ' : '') + text.trim();
          }
        }

        if (newlyFinalizedChunk) {
          setFinalTranscript((prev) => {
            const updated = prev ? `${prev.trim()} ${newlyFinalizedChunk.trim()}` : newlyFinalizedChunk.trim();
            // In-flight sensitive PII check
            const pii = checkSensitiveIdentifierViolation(updated, selectedLanguage);
            if (pii.isViolated) {
              setPiiWarning(pii.refusalMessage || 'Sensitive identifier detected');
            } else {
              setPiiWarning(null);
            }
            return updated;
          });
        }

        setInterimTranscript(currentInterim);
      };

      recognition.onerror = (event: any) => {
        console.warn('[VoiceInput] Speech recognition error event:', event.error);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setMicError(t('voice.micPermissionDenied'));
          setIsRecording(false);
        } else if (event.error === 'no-speech') {
          // Normal silence pause, keep recording in continuous mode unless manually stopped
          if (isManuallyStoppedRef.current) {
            setIsRecording(false);
          }
        } else if (event.error === 'network') {
          setMicError('Speech recognition network timeout. You can type directly.');
          setIsRecording(false);
        } else if (event.error !== 'aborted') {
          setMicError(`Voice notice: ${event.error}. You can type directly.`);
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        // If not manually stopped and continuous mode ended unexpectedly, cleanly reset
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('[VoiceInput] Microphone start exception:', err.message);
      setMicError('Microphone could not be activated. Please check browser permissions.');
      setIsRecording(false);
    }
  }, [disabled, isAssistantSpeaking, selectedLanguage, t]);

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setFinalTranscript(val);

    const pii = checkSensitiveIdentifierViolation(val, selectedLanguage);
    if (pii.isViolated) {
      setPiiWarning(pii.refusalMessage || 'Sensitive personal identifier detected.');
    } else {
      setPiiWarning(null);
    }
  };

  const handleSend = () => {
    if (isRecording) {
      stopRecording();
    }

    const trimmed = (finalTranscript + (interimTranscript ? ` ${interimTranscript}` : '')).trim();
    if (!trimmed || disabled) return;

    // Enforce PII guardrail before dispatching
    const pii = checkSensitiveIdentifierViolation(trimmed, selectedLanguage);
    if (pii.isViolated) {
      setPiiWarning(pii.refusalMessage || 'Please remove sensitive credentials before sending.');
      return;
    }

    onSendMessage(trimmed);
    setFinalTranscript('');
    setInterimTranscript('');
    setPiiWarning(null);
    setMicError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    if (isRecording) {
      stopRecording();
    }
    setFinalTranscript('');
    setInterimTranscript('');
    setPiiWarning(null);
    setMicError(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleLanguageSelect = (newLang: SupportedLanguage) => {
    if (isRecording) {
      stopRecording();
    }
    if (onLanguageChange) {
      onLanguageChange(newLang);
    } else {
      setLanguage(newLang);
    }
  };

  const isSendDisabled = disabled || (!finalTranscript.trim() && !interimTranscript.trim());

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Real-time Assistant Speaking Notice (Echo Cancellation Guard) */}
      {isAssistantSpeaking && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs animate-in fade-in">
          <VolumeX className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Assistant is speaking. Microphone paused to prevent audio feedback.</span>
        </div>
      )}

      {/* Recording Waveform Banner */}
      {isRecording && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="w-3 h-3 bg-red-500 rounded-full block animate-ping" />
              <span className="w-3 h-3 bg-red-600 rounded-full block absolute inset-0" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-emerald-950">
                {t('voice.listening')} ({selectedLanguage === 'mr' ? 'मराठी' : selectedLanguage === 'hi' ? 'हिन्दी' : 'English'})
              </span>
              <span className="text-[11px] text-emerald-700">
                Speak clearly into your microphone...
              </span>
            </div>
          </div>

          {/* 5-Bar Waveform Animation */}
          <div className="flex items-center gap-1 px-3 py-1 bg-white/80 rounded-lg border border-emerald-200">
            <span className="w-1 h-3 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.4s]" />
            <span className="w-1 h-5 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.2s]" />
            <span className="w-1 h-7 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.5s]" />
            <span className="w-1 h-4 bg-emerald-600 rounded-full animate-bounce [animation-delay:-0.1s]" />
            <span className="w-1 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{t('voice.stopRecording')}</span>
          </button>
        </div>
      )}

      {/* Sensitive PII Guardrail Warning Banner */}
      {piiWarning && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs shadow-xs animate-in fade-in">
          <ShieldAlert className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">Privacy Safeguard Notice:</span>
            <span>{piiWarning}</span>
          </div>
        </div>
      )}

      {/* Microphone Error Banner */}
      {micError && (
        <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs shadow-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span>{micError}</span>
          </div>
          <button
            type="button"
            onClick={() => setMicError(null)}
            className="text-amber-700 hover:text-amber-950 p-0.5"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Live Interim Transcript Display */}
      {interimTranscript && isRecording && (
        <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 italic flex items-center gap-2 animate-in fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
          <span className="font-medium text-slate-500">Transcribing:</span>
          <span>"{interimTranscript}"</span>
        </div>
      )}

      {/* Primary Input Container */}
      <div className="relative border border-slate-300 rounded-2xl bg-white shadow-xs focus-within:ring-2 focus-within:ring-brand-blue focus-within:border-brand-blue transition-all">
        <textarea
          ref={textareaRef}
          value={finalTranscript}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={
            isRecording
              ? 'Listening to speech... your words appear here in real time.'
              : placeholder || t('voice.inputPlaceholder') || 'Speak or type your question in English, Hindi, or Marathi...'
          }
          rows={2}
          className="w-full px-3.5 pt-3 pb-11 rounded-2xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 bg-transparent resize-none focus:outline-none leading-relaxed"
        />

        {/* Action Controls Toolbar along bottom inside textarea container */}
        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
          {/* Left Toolbar: Language selector pill & clear button */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {/* Direct Language Switcher Dropdown */}
            <div className="relative flex items-center bg-slate-100 hover:bg-slate-200 rounded-lg p-0.5 border border-slate-200 transition-colors">
              <Languages className="w-3 h-3 text-slate-600 ml-1.5 pointer-events-none" />
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageSelect(e.target.value as SupportedLanguage)}
                className="bg-transparent text-[11px] font-bold text-slate-700 py-1 pl-1 pr-2 rounded-md focus:outline-none cursor-pointer"
                title="Voice Recognition Language"
                aria-label="Select voice recognition language"
              >
                {SUPPORTED_I18N_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.native}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Transcript Button */}
            {finalTranscript && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title={t('voice.clearTranscript') || 'Clear text'}
                aria-label="Clear input"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Toolbar: Microphone toggle & Send button */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {/* Microphone Toggle Button */}
            {isSupported && (
              <button
                type="button"
                onClick={handleToggleRecord}
                disabled={disabled || isAssistantSpeaking}
                className={`p-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 ${
                  isRecording
                    ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                    : isAssistantSpeaking
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
                title={isRecording ? t('voice.stopRecording') : t('voice.startRecording')}
                aria-label={isRecording ? 'Stop Recording' : 'Start Recording'}
              >
                {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {/* Send Message Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={isSendDisabled}
              className={`p-2 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer ${
                isSendDisabled
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-brand-blue text-white hover:bg-brand-blue-hover shadow-brand-blue/20'
              }`}
              title={t('voice.sendQuery') || 'Send message'}
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
