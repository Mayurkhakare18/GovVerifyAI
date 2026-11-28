/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 9: Voice Response Text-to-Speech Player
 * Utilizes Web Speech API SpeechSynthesis with explicit locale mapping:
 * - English: en-IN (Indian English)
 * - Hindi: hi-IN (हिन्दी)
 * - Marathi: mr-IN (मराठी)
 * 
 * Accurately detects voice availability: If a Hindi/Marathi voice is not installed
 * on the citizen's browser/OS, informs them transparently rather than playing
 * distorted English phonetics over Devanagari script.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause, Square, Gauge, Info } from 'lucide-react';
import { SupportedLanguage } from '../../i18n';
import { useLanguage } from '../../contexts/LanguageContext';

interface VoiceResponsePlayerProps {
  textToSpeak: string;
  language: SupportedLanguage;
  autoPlay?: boolean;
  onSpeakingChange?: (isSpeaking: boolean) => void;
  className?: string;
}

export const VoiceResponsePlayer: React.FC<VoiceResponsePlayerProps> = ({
  textToSpeak,
  language,
  autoPlay = false,
  onSpeakingChange,
  className = '',
}) => {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isSupported, setIsSupported] = useState(true);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Check speech synthesis support and load voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Notify parent on speaking change
  useEffect(() => {
    if (onSpeakingChange) {
      onSpeakingChange(isPlaying);
    }
  }, [isPlaying, onSpeakingChange]);

  // Stop active utterance on unmount or language switch
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [language]);

  /**
   * Find matching voice for exact language locale.
   * Never forces an English voice for Devanagari text.
   */
  const findVoiceForLocale = useCallback(
    (lang: SupportedLanguage, voices: SpeechSynthesisVoice[]): {
      voice: SpeechSynthesisVoice | null;
      isCompatible: boolean;
      notice: string | null;
    } => {
      if (!voices || voices.length === 0) {
        return { voice: null, isCompatible: true, notice: null };
      }

      if (lang === 'mr') {
        const mrVoice = voices.find(
          (v) =>
            v.lang.toLowerCase() === 'mr-in' ||
            v.lang.toLowerCase().startsWith('mr') ||
            v.name.toLowerCase().includes('marathi') ||
            v.name.includes('मराठी')
        );
        if (mrVoice) {
          return { voice: mrVoice, isCompatible: true, notice: null };
        }
        return {
          voice: null,
          isCompatible: false,
          notice: 'मराठी ऑडिओ आवाज या ब्राऊझरवर उपलब्ध नाही. उत्तर मजकुरामध्ये वाचू शकता.',
        };
      }

      if (lang === 'hi') {
        const hiVoice = voices.find(
          (v) =>
            v.lang.toLowerCase() === 'hi-in' ||
            v.lang.toLowerCase().startsWith('hi') ||
            v.name.toLowerCase().includes('hindi') ||
            v.name.includes('हिन्दी')
        );
        if (hiVoice) {
          return { voice: hiVoice, isCompatible: true, notice: null };
        }
        return {
          voice: null,
          isCompatible: false,
          notice: 'हिन्दी ऑडियो आवाज इस ब्राउज़र पर उपलब्ध नहीं है। उत्तर नीचे टेक्स्ट में प्रदर्शित है।',
        };
      }

      // English: prefer en-IN, fallback to en-GB / en-US
      const enInVoice = voices.find(
        (v) => v.lang.toLowerCase() === 'en-in' || v.name.toLowerCase().includes('india')
      );
      if (enInVoice) {
        return { voice: enInVoice, isCompatible: true, notice: null };
      }

      const anyEn = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
      return { voice: anyEn || voices[0] || null, isCompatible: true, notice: null };
    },
    []
  );

  const handlePlay = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    window.speechSynthesis.cancel();
    setVoiceNotice(null);

    const cleanSpokenText = textToSpeak
      .replace(/[#*_`~[\]()]/g, ' ')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanSpokenText) return;

    const currentVoices = availableVoices.length > 0 ? availableVoices : window.speechSynthesis.getVoices();
    const { voice, isCompatible, notice } = findVoiceForLocale(language, currentVoices);

    if (!isCompatible) {
      setVoiceNotice(notice);
      setIsPlaying(false);
      setIsPaused(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
    utterance.rate = playbackRate;
    utterance.pitch = 1.0;
    utterance.lang = language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';

    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setVoiceNotice(null);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('[VoicePlayer] Speech synthesis notice:', e.error);
      }
      setIsPlaying(false);
      setIsPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [availableVoices, findVoiceForLocale, isPaused, language, playbackRate, textToSpeak]);

  const handlePause = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  }, [isPlaying]);

  const handleStop = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, []);

  const cyclePlaybackRate = () => {
    const rates = [0.75, 1.0, 1.25, 1.5];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);

    // If currently speaking, restart with new rate smoothly
    if (isPlaying) {
      handleStop();
      setTimeout(handlePlay, 100);
    }
  };

  // Optional autoplay on latest message
  useEffect(() => {
    if (autoPlay && textToSpeak) {
      const timer = setTimeout(() => {
        handlePlay();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, textToSpeak, handlePlay]);

  if (!isSupported) {
    return null;
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="inline-flex items-center gap-1.5 p-1 bg-brand-bg-subtle/80 border border-brand-border rounded-xl shadow-2xs">
        {/* Play / Pause Toggle Button */}
        {!isPlaying ? (
          <button
            type="button"
            onClick={handlePlay}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-brand-blue text-white hover:bg-brand-blue-hover active:scale-95 transition-all cursor-pointer shadow-2xs"
            title={isPaused ? t('voice.resumeAudio') : t('voice.playingAudio')}
            aria-label="Play Assistant Response"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isPaused ? t('voice.resumeAudio') : t('voice.playingAudio')}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handlePause}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all cursor-pointer shadow-2xs"
            title={t('voice.pauseAudio')}
            aria-label="Pause Assistant Response"
          >
            <Pause className="w-3 h-3 fill-current" />
            <span>{t('voice.pauseAudio')}</span>
          </button>
        )}

        {/* Stop Playback Button */}
        {(isPlaying || isPaused) && (
          <button
            type="button"
            onClick={handleStop}
            className="p-1 text-xs font-semibold rounded-lg bg-white hover:bg-red-50 text-red-600 border border-red-200 active:scale-95 transition-all cursor-pointer"
            title={t('voice.stopAudio')}
            aria-label="Stop Assistant Response"
          >
            <Square className="w-3 h-3 fill-current" />
          </button>
        )}

        {/* Playback Speed Selector (0.75x, 1x, 1.25x, 1.5x) */}
        <button
          type="button"
          onClick={cyclePlaybackRate}
          className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold rounded-lg bg-white hover:bg-brand-softblue text-brand-slate hover:text-brand-blue border border-brand-border transition-colors cursor-pointer"
          title={`Speed: ${playbackRate}x`}
          aria-label={`Playback speed ${playbackRate}x`}
        >
          <Gauge className="w-3 h-3 text-brand-blue" />
          <span>{playbackRate}x</span>
        </button>

        {/* Real-time audio waveform animation when speaking */}
        {isPlaying && (
          <div className="flex items-center gap-0.5 px-1.5 py-1">
            <span className="w-0.5 h-3 bg-emerald-500 animate-pulse rounded-full" />
            <span className="w-0.5 h-4 bg-emerald-500 animate-bounce rounded-full" />
            <span className="w-0.5 h-2.5 bg-emerald-500 animate-pulse rounded-full" />
            <span className="w-0.5 h-3.5 bg-emerald-500 animate-bounce rounded-full" />
          </div>
        )}
      </div>

      {/* Voice Unavailable Notice */}
      {voiceNotice && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 animate-in fade-in">
          <Info className="w-3 h-3 text-amber-600 shrink-0" />
          <span>{voiceNotice}</span>
        </div>
      )}
    </div>
  );
};
