/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 9: Voice Input Component with Real-Time Speech-to-Text
 * Utilizes Web Speech API SpeechRecognition / webkitSpeechRecognition
 * with full English (en-IN), Hindi (hi-IN), and Marathi (mr-IN) support.
 * Features editable transcript, permission handling, and browser fallback.
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
} from 'lucide-react';
import { SupportedLanguage } from '../../i18n';
import { useLanguage } from '../../contexts/LanguageContext';
import { checkSensitiveIdentifierViolation } from '../../utils/sensitiveIdentifiers';

interface VoiceInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  selectedLanguage: SupportedLanguage;
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
  placeholder,
  className = '',
}) => {
  const { t } = useLanguage();
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [piiWarning, setPiiWarning] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check browser SpeechRecognition support
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsSupported(false);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, []);

  // Start speech recognition upon citizen action
  const startRecording = useCallback(() => {
    if (disabled) return;
    setMicError(null);
    setPiiWarning(null);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError(t('voice.micUnsupported'));
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Locale mapping for Indian accent & regional languages
      const locale =
        selectedLanguage === 'mr'
          ? 'mr-IN'
          : selectedLanguage === 'hi'
          ? 'hi-IN'
          : 'en-IN';
      recognition.lang = locale;

      recognition.onstart = () => {
        setIsRecording(true);
        setMicError(null);
      };

      recognition.onresult = (event: any) => {
        let currentText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          currentText += event.results[i][0].transcript;
        }
        if (currentText.trim()) {
          setTranscript((prev) => {
            const combined = prev ? `${prev} ${currentText}` : currentText;
            // Real-time PII check
            const pii = checkSensitiveIdentifierViolation(combined, selectedLanguage);
            if (pii.isViolated) {
              setPiiWarning(pii.refusalMessage || 'Sensitive identifier detected');
            } else {
              setPiiWarning(null);
            }
            return combined;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('[VoiceInput] Speech recognition event error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setMicError(t('voice.micPermissionDenied'));
        } else if (event.error === 'no-speech') {
          // No speech detected, graceful reset
        } else if (event.error === 'network') {
          setMicError('Speech service connection issue. You can type your question.');
        } else {
          setMicError(`Voice capture note: ${event.error}. You can type directly.`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('[VoiceInput] Microphone start exception:', err.message);
      setMicError('Microphone could not be activated. Please verify browser permissions.');
      setIsRecording(false);
    }
  }, [disabled, selectedLanguage, t]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsRecording(false);
    }
  }, []);

  const handleToggleRecord = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTranscript(val);

    const pii = checkSensitiveIdentifierViolation(val, selectedLanguage);
    if (pii.isViolated) {
      setPiiWarning(pii.refusalMessage || 'Sensitive personal identifier detected.');
    } else {
      setPiiWarning(null);
    }
  };

  const handleSend = () => {
    const trimmed = transcript.trim();
    if (!trimmed || disabled) return;

    // Check PII before dispatching
    const pii = checkSensitiveIdentifierViolation(trimmed, selectedLanguage);
    if (pii.isViolated) {
      setPiiWarning(pii.refusalMessage || 'Please remove sensitive credentials before sending.');
      return;
    }

    if (isRecording) {
      stopRecording();
    }

    onSendMessage(trimmed);
    setTranscript('');
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
    setTranscript('');
    setPiiWarning(null);
    setMicError(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Recording State Waveform Banner */}
      {isRecording && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 rounded-xl border border-red-200 bg-red-50/90 animate-in fade-in duration-150 flex items-center justify-between gap-3 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
            <div className="text-xs font-bold text-red-900 flex items-center gap-2">
              <span>{t('voice.listening')}</span>
              <span className="text-[11px] font-normal text-red-700">
                ({selectedLanguage === 'mr' ? 'मराठी' : selectedLanguage === 'hi' ? 'हिन्दी' : 'English'})
              </span>
            </div>
          </div>

          {/* Animated 5-bar Waveform */}
          <div className="flex items-center gap-1 h-5 px-2" aria-hidden="true">
            <span className="w-1 bg-red-600 rounded-full animate-[bounce_0.6s_ease-in-out_infinite] h-3" />
            <span className="w-1 bg-red-600 rounded-full animate-[bounce_0.7s_ease-in-out_infinite_0.1s] h-5" />
            <span className="w-1 bg-red-600 rounded-full animate-[bounce_0.5s_ease-in-out_infinite_0.2s] h-4" />
            <span className="w-1 bg-red-600 rounded-full animate-[bounce_0.8s_ease-in-out_infinite_0.15s] h-5" />
            <span className="w-1 bg-red-600 rounded-full animate-[bounce_0.6s_ease-in-out_infinite_0.3s] h-2.5" />
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="px-2.5 py-1 text-[11px] font-bold text-red-800 hover:text-red-900 bg-white rounded-lg border border-red-300 shadow-2xs"
          >
            {t('voice.stopRecording')}
          </button>
        </div>
      )}

      {/* PII Violation Alert Banner */}
      {piiWarning && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5"
        >
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1 text-[11px] leading-relaxed font-medium">
            {piiWarning}
          </div>
        </div>
      )}

      {/* Mic Error Notice */}
      {micError && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-800 text-xs flex items-center justify-between gap-2"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{micError}</span>
          </div>
          <button
            type="button"
            onClick={() => setMicError(null)}
            className="p-1 text-red-600 hover:text-red-800"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Speech-to-Text Input Area */}
      <div className="relative rounded-2xl border border-brand-border bg-white shadow-xs focus-within:border-brand-blue focus-within:ring-2 focus-within:ring-brand-blue/15 transition-all">
        <textarea
          ref={textareaRef}
          value={transcript}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder || t('voice.inputPlaceholder')}
          rows={2}
          className="w-full pl-4 pr-24 pt-3 pb-2 text-xs sm:text-sm text-brand-navy placeholder:text-brand-slate/60 bg-transparent resize-none outline-none leading-relaxed"
        />

        {/* Action Controls Toolbar inside Textarea */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1 border-t border-brand-border/40">
          <div className="flex items-center gap-1.5 text-[11px] text-brand-slate">
            {transcript && (
              <span className="text-[10px] font-semibold text-brand-blue flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                <span>{t('voice.editTranscriptNotice')}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {transcript && (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="p-1.5 rounded-lg text-brand-slate hover:text-brand-navy hover:bg-brand-bg-subtle text-xs transition-colors"
                title={t('voice.clearTranscript')}
                aria-label={t('voice.clearTranscript')}
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Microphone Toggle Button */}
            {isSupported && (
              <button
                type="button"
                onClick={handleToggleRecord}
                disabled={disabled}
                className={`p-2 rounded-xl transition-all flex items-center gap-1.5 font-bold text-xs ${
                  isRecording
                    ? 'bg-red-600 text-white shadow-md animate-pulse ring-2 ring-red-400'
                    : 'bg-brand-softblue hover:bg-brand-softblue-border text-brand-blue border border-brand-softblue-border'
                }`}
                title={isRecording ? t('voice.stopRecording') : t('voice.startRecording')}
                aria-label={isRecording ? t('voice.stopRecording') : t('voice.startRecording')}
              >
                {isRecording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                <span className="hidden sm:inline text-[11px]">
                  {isRecording ? 'Listening' : 'Voice'}
                </span>
              </button>
            )}

            {/* Send Query Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!transcript.trim() || disabled || Boolean(piiWarning)}
              className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              title={t('voice.sendQuery')}
              aria-label={t('voice.sendQuery')}
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t('voice.sendQuery')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
