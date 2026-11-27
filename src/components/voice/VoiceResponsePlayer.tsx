/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 9: Voice Response Text-to-Speech Player
 * Utilizes Web Speech API SpeechSynthesis with support for
 * English (en-IN), Hindi (hi-IN), and Marathi (mr-IN).
 * Provides play, pause, resume, speed adjustment, and interruption.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause, Square, Gauge } from 'lucide-react';
import { SupportedLanguage } from '../../i18n';
import { useLanguage } from '../../contexts/LanguageContext';

interface VoiceResponsePlayerProps {
  textToSpeak: string;
  language: SupportedLanguage;
  autoPlay?: boolean;
  className?: string;
}

export const VoiceResponsePlayer: React.FC<VoiceResponsePlayerProps> = ({
  textToSpeak,
  language,
  autoPlay = false,
  className = '',
}) => {
  const { t } = useLanguage();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);
  const [isSupported, setIsSupported] = useState(true);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setIsSupported(false);
    }
  }, []);

  // Stop any active utterance on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const selectVoiceForLanguage = useCallback((lang: SupportedLanguage): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;

    const targetLocale = lang === 'mr' ? 'mr-IN' : lang === 'hi' ? 'hi-IN' : 'en-IN';
    const langPrefix = lang === 'mr' ? 'mr' : lang === 'hi' ? 'hi' : 'en';

    // 1. Exact match for target locale
    const exact = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === targetLocale.toLowerCase());
    if (exact) return exact;

    // 2. Prefix match (e.g. any Hindi / Marathi voice)
    const prefix = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
    if (prefix) return prefix;

    // 3. Fallback to default voice
    return voices.find((v) => v.default) || voices[0] || null;
  }, []);

  const handlePlay = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    // If currently paused, resume
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }

    // Cancel any previous speaking
    window.speechSynthesis.cancel();

    // Clean markdown syntax from spoken text for clean speech synthesis
    const cleanSpokenText = textToSpeak
      .replace(/[#*_`~[\]()]/g, ' ')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanSpokenText) return;

    const utterance = new SpeechSynthesisUtterance(cleanSpokenText);
    utterance.rate = playbackRate;
    utterance.pitch = 1.0;

    const voice = selectVoiceForLanguage(language);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = language === 'mr' ? 'mr-IN' : language === 'hi' ? 'hi-IN' : 'en-IN';

    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
    };

    utterance.onerror = (e) => {
      // Don't treat user-interrupted cancellations as errors
      if (e.error !== 'canceled' && e.error !== 'interrupted') {
        console.warn('[VoicePlayer] Speech synthesis notice:', e.error);
      }
      setIsPlaying(false);
      setIsPaused(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [textToSpeak, language, playbackRate, isPaused, selectVoiceForLanguage]);

  const handlePause = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isPlaying) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setIsPlaying(false);
    }
  };

  const handleStop = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  };

  const togglePlaybackRate = () => {
    const rates = [0.75, 1.0, 1.25, 1.5];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const newRate = rates[nextIdx];
    setPlaybackRate(newRate);

    // If currently speaking, restart with new speed
    if (isPlaying && utteranceRef.current) {
      handleStop();
      setTimeout(handlePlay, 100);
    }
  };

  // Optional Autoplay
  useEffect(() => {
    if (autoPlay && textToSpeak && isSupported) {
      handlePlay();
    }
  }, [autoPlay, textToSpeak, isSupported]);

  if (!isSupported) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-1.5 p-1 rounded-lg bg-brand-softblue/70 border border-brand-softblue-border text-xs ${className}`}>
      {/* Play / Pause Toggle */}
      {!isPlaying ? (
        <button
          type="button"
          onClick={handlePlay}
          className="p-1.5 rounded-md bg-white hover:bg-brand-softblue text-brand-blue font-semibold transition-colors shadow-2xs flex items-center gap-1"
          title={isPaused ? t('voice.resumeAudio') : t('voice.playingAudio')}
          aria-label={isPaused ? t('voice.resumeAudio') : t('voice.playingAudio')}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span className="text-[11px] font-bold pr-1">{isPaused ? 'Resume' : 'Listen'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={handlePause}
          className="p-1.5 rounded-md bg-white hover:bg-brand-softblue text-amber-700 font-semibold transition-colors shadow-2xs flex items-center gap-1"
          title={t('voice.pauseAudio')}
          aria-label={t('voice.pauseAudio')}
        >
          <Pause className="w-3.5 h-3.5 fill-current" />
          <span className="text-[11px] font-bold pr-1">Pause</span>
        </button>
      )}

      {/* Stop Button */}
      {(isPlaying || isPaused) && (
        <button
          type="button"
          onClick={handleStop}
          className="p-1.5 rounded-md bg-white/80 hover:bg-red-50 text-brand-slate hover:text-red-700 transition-colors shadow-2xs"
          title={t('voice.stopAudio')}
          aria-label={t('voice.stopAudio')}
        >
          <Square className="w-3 h-3 fill-current" />
        </button>
      )}

      {/* Speed Rate Pill */}
      <button
        type="button"
        onClick={togglePlaybackRate}
        className="px-2 py-1 rounded-md bg-white/80 hover:bg-white text-brand-navy text-[10px] font-mono font-bold transition-colors shadow-2xs flex items-center gap-0.5"
        title={t('voice.speechSpeed')}
        aria-label={`${t('voice.speechSpeed')} ${playbackRate}x`}
      >
        <Gauge className="w-2.5 h-2.5 text-brand-slate" />
        <span>{playbackRate}x</span>
      </button>

      {/* Audio Wave Animation when Playing */}
      {isPlaying && (
        <div className="flex items-center gap-0.5 px-1.5" aria-hidden="true">
          <span className="w-0.5 h-3 bg-brand-blue rounded-full animate-bounce [animation-delay:-0.3s]" />
          <span className="w-0.5 h-4 bg-brand-blue rounded-full animate-bounce [animation-delay:-0.15s]" />
          <span className="w-0.5 h-2.5 bg-brand-blue rounded-full animate-bounce [animation-delay:-0.45s]" />
          <span className="w-0.5 h-3.5 bg-brand-blue rounded-full animate-bounce" />
        </div>
      )}
    </div>
  );
};
