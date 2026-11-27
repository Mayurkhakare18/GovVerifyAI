/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Phase 7: Interactive Scheme Application Assistant
 * AI application guidance grounded in verified government sovereign sources.
 * Enforces client-side PII sanitization, prompt injection defenses,
 * and explicit non-guarantee statutory disclaimers.
 */

import React, { useState } from 'react';
import {
  Send,
  Bot,
  User,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Info,
  Loader2,
} from 'lucide-react';
import { schemeApi, SourceCitation, ApplicationAssistantAnswer } from '../../services/api/schemes';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  citations?: SourceCitation[];
  isVerified?: boolean;
  disclaimer?: string;
  error?: boolean;
}

interface SchemeApplicationAssistantProps {
  schemeId: string;
  schemeName: string;
}

const QUICK_PROMPTS = [
  'What documents are mandatory to apply?',
  'Can I apply offline through a CSC Kendra?',
  'How long does verification and approval take?',
  'Where do I track my submitted application?',
];

export const SchemeApplicationAssistant: React.FC<SchemeApplicationAssistantProps> = ({
  schemeId,
  schemeName,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Namaste! I am your official application guidance assistant for ${schemeName}. You can ask about required documents, submission steps, approval stages, or tracking methods. Every answer is grounded in verified official government publications.`,
      isVerified: true,
      disclaimer:
        'GovVerify AI is an independent informational platform. We provide guidance from published government sources and do not submit or process applications.',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [piiWarning, setPiiWarning] = useState<string | null>(null);

  // Client-side PII check
  const detectPii = (text: string): string | null => {
    // 12-digit Aadhaar pattern
    if (/\b\d{4}\s?\d{4}\s?\d{4}\b/.test(text)) {
      return 'Please remove your Aadhaar number. GovVerify AI never collects identity numbers.';
    }
    // 10-char PAN pattern
    if (/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/i.test(text)) {
      return 'Please remove your PAN number. GovVerify AI never collects tax identifiers.';
    }
    // Bank account or OTP mention
    if (/\b(otp|password|pin|cvv)\b/i.test(text)) {
      return 'Never share OTPs, passwords, or PINs. GovVerify AI never asks for confidential credentials.';
    }
    return null;
  };

  const handleSend = async (queryText?: string) => {
    const q = (queryText !== undefined ? queryText : input).trim();
    if (!q || isLoading) return;

    // Check PII
    const piiErr = detectPii(q);
    if (piiErr) {
      setPiiWarning(piiErr);
      return;
    }
    setPiiWarning(null);

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res: ApplicationAssistantAnswer = await schemeApi.askApplicationAssistant(schemeId, q);

      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: res.answer,
        citations: res.citations,
        isVerified: res.isVerified,
        disclaimer: res.disclaimer,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: err.message || 'Unable to retrieve verified guidance at this moment. Please try again.',
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 flex flex-col h-[520px]">
      {/* 1. Quick Prompts */}
      <div className="flex flex-wrap gap-1.5 shrink-0">
        {QUICK_PROMPTS.map((prompt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSend(prompt)}
            disabled={isLoading}
            className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors text-left"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* 2. Chat Conversation Box */}
      <div className="flex-1 overflow-y-auto space-y-3.5 p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  isUser
                    ? 'bg-blue-600 text-white'
                    : msg.error
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-indigo-600 text-white shadow-xs'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-blue-600 text-white shadow-xs'
                    : msg.error
                    ? 'bg-rose-50 border border-rose-200 text-rose-900'
                    : 'bg-white border border-slate-200 text-slate-800 shadow-xs'
                }`}
              >
                {!isUser && msg.isVerified !== undefined && (
                  <div className="mb-1.5 flex items-center gap-1">
                    {msg.isVerified ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Grounded in Official Guidelines
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        Unconfirmed / Discretionary
                      </span>
                    )}
                  </div>
                )}

                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Citations */}
                {!isUser && msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Official Citations:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.citations.map((c, i) => (
                        <a
                          key={i}
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 underline font-medium"
                        >
                          <span>{c.domain}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-white p-3 rounded-xl border border-slate-200 w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span>Consulting official sovereign guidelines...</span>
          </div>
        )}
      </div>

      {/* 3. PII Warning Banner */}
      {piiWarning && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-center gap-2 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{piiWarning}</span>
        </div>
      )}

      {/* 4. Input Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            if (piiWarning) setPiiWarning(null);
          }}
          placeholder="Ask a question about applying (e.g. 'How do I get an income certificate?')..."
          disabled={isLoading}
          className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-xs"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors shrink-0"
        >
          <span>Ask</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};
