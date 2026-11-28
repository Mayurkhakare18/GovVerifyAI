/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 9: Voice Input Component with Robust Chrome SpeechRecognition Lifecycle
 * Implements strict Web Speech API SpeechRecognition specifications:
 * - 8-State Lifecycle: IDLE, REQUESTING_PERMISSION, LISTENING, PROCESSING_TRANSCRIPT,
 *   TRANSCRIPT_READY, SUBMITTING, RESPONDING, ERROR.
 * - Hardware Pre-flight: Probes navigator.mediaDevices.getUserMedia before starting recognition
 *   to ensure microphone hardware is active, unmuted, and permitted.
 * - Complete Lifecycle Events: onstart, onspeechstart, onspeechend, onaudiostart, onaudioend,
 *   onresult, onerror, and onend handled correctly.
 * - Chrome `no-speech` Recovery: Clear explanatory error with manual retry (zero auto-restart loop).
 * - Indian Regional Locales: en-IN (Indian English), hi-IN (Hindi), mr-IN (Marathi).
 * - Silence Detection: 3.5s auto-stop only active AFTER speech has been detected.
 * - Maximum Session Limit: 25s timeout safeguard against runaway background recording.
 * - Concurrency Protection: Guarded by isStartingRef to prevent duplicate recognition instances.
 * - Zero word/phrase duplication on repeated onresult cycles.
 * - Echo prevention: Pauses/disables recording while assistant TTS is speaking.
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
  Loader2,
  CheckCircle2,
  Radio,
} from 'lucide-react';
import { SupportedLanguage, SUPPORTED_I18N_LANGUAGES } from '../../i18n';
import { useLanguage } from '../../contexts/LanguageContext';
import { checkSensitiveIdentifierViolation } from '../../utils/sensitiveIdentifiers';

export type VoiceRecordingState =
  | 'IDLE'
  | 'REQUESTING_PERMISSION'
  | 'LISTENING'
  | 'PROCESSING_TRANSCRIPT'
  | 'TRANSCRIPT_READY'
  | 'SUBMITTING'
  | 'RESPONDING'
  | 'ERROR';

export interface VoiceInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  selectedLanguage: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage) => void;
  isAssistantSpeaking?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  onStateChange?: (state: VoiceRecordingState) => void;
}

// Window declaration for Web Speech API recognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

const SILENCE_TIMEOUT_MS = 3500;
const MAX_RECORDING_DURATION_MS = 25000;

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onSendMessage,
  disabled = false,
  selectedLanguage,
  onLanguageChange,
  isAssistantSpeaking = false,
  isLoading = false,
  placeholder,
  className = '',
  onStateChange,
}) => {
  const { t, setLanguage } = useLanguage();
  const [lifecycleState, setLifecycleState] = useState<VoiceRecordingState>('IDLE');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [piiWarning, setPiiWarning] = useState<string | null>(null);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [activeMicName, setActiveMicName] = useState<string | null>(null);

  // Mutable refs to prevent stale closures and duplicate recognition instances
  const recognitionRef = useRef<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isManuallyStoppedRef = useRef(false);
  const isStartingRef = useRef(false);
  const hasDetectedSpeechRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const lifecycleStateRef = useRef<VoiceRecordingState>('IDLE');
  const selectedLanguageRef = useRef<SupportedLanguage>(selectedLanguage);

  // Keep refs synchronized with state
  useEffect(() => {
    finalTranscriptRef.current = finalTranscript;
  }, [finalTranscript]);

  useEffect(() => {
    lifecycleStateRef.current = lifecycleState;
  }, [lifecycleState]);

  useEffect(() => {
    selectedLanguageRef.current = selectedLanguage;
  }, [selectedLanguage]);

  // Notify parent of state changes safely
  const updateState = useCallback(
    (newState: VoiceRecordingState) => {
      lifecycleStateRef.current = newState;
      setLifecycleState(newState);
      if (onStateChange) {
        onStateChange(newState);
      }
    },
    [onStateChange]
  );

  // Check browser SpeechRecognition support on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setIsSupported(false);
      }
    }
  }, []);

  // Sync isLoading to SUBMITTING or RESPONDING
  useEffect(() => {
    if (isLoading) {
      if (lifecycleStateRef.current !== 'SUBMITTING' && lifecycleStateRef.current !== 'RESPONDING') {
        updateState('RESPONDING');
      }
    } else if (lifecycleStateRef.current === 'SUBMITTING' || lifecycleStateRef.current === 'RESPONDING') {
      updateState('IDLE');
    }
  }, [isLoading, updateState]);

  // Clear timers helper
  const clearTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (maxDurationTimerRef.current) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }, []);

  // Cleanup recognition and timers on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      isStartingRef.current = false;
      if (recognitionRef.current) {
        isManuallyStoppedRef.current = true;
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, [clearTimers]);

  // Stop recording if assistant starts speaking to prevent audio feedback/echo
  useEffect(() => {
    if (
      isAssistantSpeaking &&
      (lifecycleStateRef.current === 'LISTENING' || lifecycleStateRef.current === 'REQUESTING_PERMISSION')
    ) {
      stopRecording();
    }
  }, [isAssistantSpeaking]);

  /**
   * Stop active speech recognition cleanly and merge any remaining interim segment
   */
  const stopRecording = useCallback(() => {
    isManuallyStoppedRef.current = true;
    isStartingRef.current = false;
    clearTimers();
    setIsSpeechDetected(false);

    if (recognitionRef.current) {
      updateState('PROCESSING_TRANSCRIPT');
      try {
        recognitionRef.current.stop();
      } catch (err: any) {
        console.warn('[VoiceInput] recognition.stop() exception:', err.message);
      }
    } else if (lifecycleStateRef.current !== 'ERROR') {
      updateState('IDLE');
    }

    // Merge trailing interim text once cleanly into finalTranscript
    setInterimTranscript((prevInterim) => {
      if (prevInterim.trim()) {
        setFinalTranscript((prevFinal) => {
          const merged = prevFinal ? `${prevFinal.trim()} ${prevInterim.trim()}` : prevInterim.trim();
          finalTranscriptRef.current = merged;
          const pii = checkSensitiveIdentifierViolation(merged, selectedLanguageRef.current);
          if (pii.isViolated) {
            setPiiWarning(pii.refusalMessage || 'Sensitive identifier detected');
          }
          return merged;
        });
      }
      return '';
    });
  }, [clearTimers, updateState]);

  /**
   * Start silence countdown timer: only triggered once speech has been active
   */
  const startSilenceCountdown = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = setTimeout(() => {
      console.log('[VoiceInput] 3.5s silence detected after speech, finalizing capture...');
      stopRecording();
    }, SILENCE_TIMEOUT_MS);
  }, [stopRecording]);

  /**
   * Probes microphone hardware using navigator.mediaDevices.getUserMedia
   * Verifies track readiness and permission before starting SpeechRecognition
   */
  const verifyMicrophoneHardware = async (): Promise<{ ready: boolean; micName?: string; error?: string }> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback: older browser without mediaDevices, delegate to SpeechRecognition
      return { ready: true };
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tracks = stream.getAudioTracks();
      if (!tracks || tracks.length === 0) {
        return { ready: false, error: 'NO_TRACKS' };
      }

      const activeTrack = tracks[0];
      const micLabel = activeTrack.label || 'Default Microphone';
      setActiveMicName(micLabel);

      // Clean up probe tracks immediately to free hardware for Chrome's SpeechRecognition engine
      tracks.forEach((t) => t.stop());

      return { ready: true, micName: micLabel };
    } catch (err: any) {
      console.warn('[VoiceInput] getUserMedia microphone hardware probe failed:', err.name, err.message);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        return { ready: false, error: 'PERMISSION_DENIED' };
      }
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        return { ready: false, error: 'NO_DEVICE' };
      }
      return { ready: false, error: err.message || 'MIC_ERROR' };
    }
  };

  /**
   * Start speech recognition with verified hardware readiness and comprehensive event handlers
   */
  const startRecording = useCallback(async () => {
    // Prevent duplicate calls while starting or while assistant is speaking
    if (disabled || isAssistantSpeaking || isLoading || isStartingRef.current) return;
    if (lifecycleStateRef.current === 'LISTENING') return;

    isStartingRef.current = true;
    isManuallyStoppedRef.current = false;
    hasDetectedSpeechRef.current = false;
    setIsSpeechDetected(false);
    setMicError(null);
    setPiiWarning(null);
    clearTimers();

    // Echo prevention: cancel any active speech synthesis immediately
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError(t('voice.micUnsupported') || 'Speech recognition is not supported in this browser. You can type directly.');
      updateState('ERROR');
      isStartingRef.current = false;
      return;
    }

    // Step 1: Pre-flight permission and hardware readiness verification
    updateState('REQUESTING_PERMISSION');
    const micCheck = await verifyMicrophoneHardware();

    if (!micCheck.ready) {
      isStartingRef.current = false;
      if (micCheck.error === 'PERMISSION_DENIED') {
        setMicError(t('voice.micPermissionDenied') || 'Microphone permission was denied. Please allow microphone access in your browser settings to speak.');
      } else if (micCheck.error === 'NO_DEVICE' || micCheck.error === 'NO_TRACKS') {
        setMicError(t('voice.micNotFound') || 'No microphone detected on your device. Please connect a microphone and try again.');
      } else {
        setMicError(`Microphone initialization error: ${micCheck.error}. You can type directly.`);
      }
      updateState('ERROR');
      return;
    }

    // Step 2: Initialize SpeechRecognition with strict locale binding
    try {
      // Abort any existing instance
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
        recognitionRef.current = null;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Locale mapping: en-IN, hi-IN, mr-IN
      const localeMap: Record<SupportedLanguage, string> = {
        mr: 'mr-IN',
        hi: 'hi-IN',
        en: 'en-IN',
      };
      const activeLocale = localeMap[selectedLanguageRef.current] || 'en-IN';
      recognition.lang = activeLocale;

      console.log(`[VoiceInput] Starting SpeechRecognition bound to locale: ${activeLocale}`);

      // 1. onstart: Speech service has begun listening
      recognition.onstart = () => {
        console.log('[VoiceInput] Event: onstart - SpeechRecognition active');
        isStartingRef.current = false;
        updateState('LISTENING');
        setMicError(null);

        // Maximum recording duration safeguard (25s) to prevent runaway recording
        maxDurationTimerRef.current = setTimeout(() => {
          console.log('[VoiceInput] Maximum recording duration (25s) reached, stopping cleanly');
          stopRecording();
        }, MAX_RECORDING_DURATION_MS);
      };

      // 2. onaudiostart: Audio capture has started
      recognition.onaudiostart = () => {
        console.log('[VoiceInput] Event: onaudiostart - Audio capture receiving sound waves');
      };

      // 3. onspeechstart: Sound recognized as speech has begun
      recognition.onspeechstart = () => {
        console.log('[VoiceInput] Event: onspeechstart - Speech detected');
        hasDetectedSpeechRef.current = true;
        setIsSpeechDetected(true);
        // Cancel any silence timer while speech is actively being detected
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      };

      // 4. onspeechend: Sound recognized as speech has stopped
      recognition.onspeechend = () => {
        console.log('[VoiceInput] Event: onspeechend - Speech paused');
        setIsSpeechDetected(false);
        // User has stopped speaking; start 3.5s silence countdown to finalize
        startSilenceCountdown();
      };

      // 5. onaudioend: Audio capturing finished
      recognition.onaudioend = () => {
        console.log('[VoiceInput] Event: onaudioend - Audio capture ended');
        setIsSpeechDetected(false);
      };

      // 6. onresult: Process interim and finalized text
      recognition.onresult = (event: any) => {
        hasDetectedSpeechRef.current = true;
        setIsSpeechDetected(true);

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
            finalTranscriptRef.current = updated;
            // In-flight sensitive PII check
            const pii = checkSensitiveIdentifierViolation(updated, selectedLanguageRef.current);
            if (pii.isViolated) {
              setPiiWarning(pii.refusalMessage || 'Sensitive identifier detected');
            } else {
              setPiiWarning(null);
            }
            return updated;
          });
        }

        setInterimTranscript(currentInterim);
        // Restart silence countdown after receiving words
        startSilenceCountdown();
      };

      // 7. onerror: Handle Chrome no-speech, permission, and network errors
      recognition.onerror = (event: any) => {
        console.warn('[VoiceInput] Event: onerror - error:', event.error);
        clearTimers();
        isStartingRef.current = false;
        setIsSpeechDetected(false);

        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
          setMicError(t('voice.micPermissionDenied') || 'Microphone access was denied. Please allow microphone permissions or type below.');
          updateState('ERROR');
        } else if (event.error === 'no-speech') {
          // If the user already had some finalized text from earlier phrases, transition to TRANSCRIPT_READY
          if (finalTranscriptRef.current.trim().length > 0) {
            updateState('TRANSCRIPT_READY');
          } else {
            // Display clear no-speech message and DO NOT auto-restart indefinitely (Requirement 4 & 5)
            setMicError(t('voice.noSpeechDetected') || 'No speech was detected. Please check your microphone and speak clearly, or click Try Again.');
            updateState('ERROR');
          }
        } else if (event.error === 'network') {
          setMicError('Speech recognition network timeout. You can type directly.');
          updateState('ERROR');
        } else if (event.error !== 'aborted') {
          setMicError(`Voice notice: ${event.error}. You can type directly.`);
          updateState('ERROR');
        }
      };

      // 8. onend: Cleanly reset state when recognition terminates
      recognition.onend = () => {
        console.log('[VoiceInput] Event: onend - Recognition terminated');
        clearTimers();
        isStartingRef.current = false;
        setIsSpeechDetected(false);
        recognitionRef.current = null;

        setInterimTranscript((prev) => {
          const currentTotal = (finalTranscriptRef.current + (prev ? ` ${prev}` : '')).trim();
          if (currentTotal.length > 0) {
            updateState('TRANSCRIPT_READY');
          } else if (lifecycleStateRef.current !== 'ERROR') {
            updateState('IDLE');
          }
          return '';
        });
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.warn('[VoiceInput] Recognition start exception:', err.message);
      clearTimers();
      isStartingRef.current = false;
      setMicError('Microphone could not be activated. Please check browser permissions.');
      updateState('ERROR');
    }
  }, [
    clearTimers,
    disabled,
    isAssistantSpeaking,
    isLoading,
    startSilenceCountdown,
    stopRecording,
    t,
    updateState,
  ]);

  const handleToggleRecord = () => {
    if (lifecycleState === 'LISTENING' || lifecycleState === 'REQUESTING_PERMISSION') {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleRetryRecord = () => {
    setMicError(null);
    updateState('IDLE');
    // Start fresh recording
    setTimeout(() => {
      startRecording();
    }, 50);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setFinalTranscript(val);
    finalTranscriptRef.current = val;

    const pii = checkSensitiveIdentifierViolation(val, selectedLanguage);
    if (pii.isViolated) {
      setPiiWarning(pii.refusalMessage || 'Sensitive personal identifier detected.');
    } else {
      setPiiWarning(null);
    }

    if (val.trim().length > 0 && lifecycleState === 'IDLE') {
      updateState('TRANSCRIPT_READY');
    } else if (val.trim().length === 0 && lifecycleState === 'TRANSCRIPT_READY') {
      updateState('IDLE');
    }
  };

  const handleSend = () => {
    if (lifecycleState === 'LISTENING') {
      stopRecording();
    }

    const trimmed = (finalTranscript + (interimTranscript ? ` ${interimTranscript}` : '')).trim();
    if (!trimmed || disabled || isLoading) return;

    // Enforce PII guardrail before dispatching
    const pii = checkSensitiveIdentifierViolation(trimmed, selectedLanguage);
    if (pii.isViolated) {
      setPiiWarning(pii.refusalMessage || 'Please remove sensitive credentials before sending.');
      return;
    }

    updateState('SUBMITTING');
    onSendMessage(trimmed);
    setFinalTranscript('');
    finalTranscriptRef.current = '';
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
    if (lifecycleState === 'LISTENING' || lifecycleState === 'REQUESTING_PERMISSION') {
      stopRecording();
    }
    setFinalTranscript('');
    finalTranscriptRef.current = '';
    setInterimTranscript('');
    setPiiWarning(null);
    setMicError(null);
    updateState('IDLE');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleLanguageSelect = (newLang: SupportedLanguage) => {
    if (lifecycleState === 'LISTENING' || lifecycleState === 'REQUESTING_PERMISSION') {
      stopRecording();
    }
    if (onLanguageChange) {
      onLanguageChange(newLang);
    } else {
      setLanguage(newLang);
    }
  };

  const isRecording = lifecycleState === 'LISTENING' || lifecycleState === 'REQUESTING_PERMISSION';
  const isSendDisabled = disabled || isLoading || (!finalTranscript.trim() && !interimTranscript.trim());

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Real-time Assistant Speaking Notice (Echo Cancellation Guard) */}
      {isAssistantSpeaking && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs animate-in fade-in">
          <VolumeX className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Assistant is speaking. Microphone paused to prevent audio feedback.</span>
        </div>
      )}

      {/* 8-State Lifecycle Status Indicators */}
      {lifecycleState === 'REQUESTING_PERMISSION' && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs animate-in fade-in">
          <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
          <div className="flex-1">
            <span className="font-semibold block">{t('voice.lifecycle.requestingPermission') || 'Checking microphone access...'}</span>
            <span className="text-[11px] text-amber-700">Verifying audio hardware stream readiness.</span>
          </div>
        </div>
      )}

      {lifecycleState === 'LISTENING' && (
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="w-3 h-3 bg-red-500 rounded-full block animate-ping" />
              <span className="w-3 h-3 bg-red-600 rounded-full block absolute inset-0" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <span>{t('voice.listening') || 'Listening'} ({selectedLanguage === 'mr' ? 'मराठी (mr-IN)' : selectedLanguage === 'hi' ? 'हिन्दी (hi-IN)' : 'English (en-IN)'})</span>
                {isSpeechDetected && (
                  <span className="px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800 text-[9px] font-extrabold uppercase">
                    Speech Active
                  </span>
                )}
              </span>
              <span className="text-[11px] text-emerald-700 truncate max-w-[260px] sm:max-w-none">
                {isSpeechDetected
                  ? t('voice.detectingSpeech') || 'Detecting speech... Speak clearly.'
                  : 'Speak into microphone. Pausing will auto-finalize.'}
              </span>
            </div>
          </div>

          {/* 5-Bar Waveform Animation */}
          <div className="flex items-center gap-1 px-3 py-1 bg-white/80 rounded-lg border border-emerald-200">
            <span className={`w-1 rounded-full bg-emerald-500 transition-all ${isSpeechDetected ? 'h-4 animate-bounce [animation-delay:-0.4s]' : 'h-2'}`} />
            <span className={`w-1 rounded-full bg-emerald-600 transition-all ${isSpeechDetected ? 'h-6 animate-bounce [animation-delay:-0.2s]' : 'h-3'}`} />
            <span className={`w-1 rounded-full bg-emerald-500 transition-all ${isSpeechDetected ? 'h-7 animate-bounce [animation-delay:-0.5s]' : 'h-4'}`} />
            <span className={`w-1 rounded-full bg-emerald-600 transition-all ${isSpeechDetected ? 'h-5 animate-bounce [animation-delay:-0.1s]' : 'h-3'}`} />
            <span className={`w-1 rounded-full bg-emerald-500 transition-all ${isSpeechDetected ? 'h-3 animate-bounce [animation-delay:-0.3s]' : 'h-2'}`} />
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
            title="Stop recording"
            aria-label="Stop recording"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>{t('voice.stopRecording') || 'Stop'}</span>
          </button>
        </div>
      )}

      {lifecycleState === 'PROCESSING_TRANSCRIPT' && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs animate-in fade-in">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          <span>{t('voice.processing') || 'Processing voice capture and finalizing text...'}</span>
        </div>
      )}

      {lifecycleState === 'SUBMITTING' && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs animate-in fade-in">
          <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin shrink-0" />
          <span>{t('voice.lifecycle.submitting') || 'Sending your query to citizen verification engine...'}</span>
        </div>
      )}

      {lifecycleState === 'RESPONDING' && (
        <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs animate-in fade-in">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 animate-pulse shrink-0" />
          <span>{t('voice.lifecycle.responding') || 'AI Citizen Assistant is generating verified response...'}</span>
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

      {/* Clear Microphone / No-Speech Error Banner with Manual Retry (Requirement 4, 5, 6) */}
      {micError && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs shadow-xs animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1">
            <span className="font-medium block leading-relaxed">{micError}</span>
            {activeMicName && (
              <span className="text-[11px] text-amber-700 block">
                Detected device: {activeMicName}
              </span>
            )}
            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={handleRetryRecord}
                className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition-colors flex items-center gap-1 shadow-2xs cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('voice.retryRecording') || 'Try Again'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMicError(null);
                  updateState('IDLE');
                  if (textareaRef.current) textareaRef.current.focus();
                }}
                className="px-2 py-1 rounded-md bg-white border border-amber-300 text-amber-800 hover:bg-amber-100/50 font-medium text-[11px] transition-colors cursor-pointer"
              >
                Type question instead
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setMicError(null);
              updateState('IDLE');
            }}
            className="text-amber-700 hover:text-amber-950 p-0.5 cursor-pointer"
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
          disabled={disabled || isLoading}
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
                    {l.native} ({l.code === 'mr' ? 'mr-IN' : l.code === 'hi' ? 'hi-IN' : 'en-IN'})
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
                disabled={disabled || isAssistantSpeaking || isLoading}
                className={`p-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95 flex items-center gap-1 ${
                  isRecording
                    ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                    : isAssistantSpeaking || isLoading
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
                title={isRecording ? t('voice.stopRecording') || 'Stop' : t('voice.startRecording') || 'Start'}
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
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
