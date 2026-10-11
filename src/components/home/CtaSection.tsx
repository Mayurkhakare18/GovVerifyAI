import React from 'react';
import { ArrowUp, BookOpen, ShieldCheck, ArrowRight } from 'lucide-react';

interface CtaSectionProps {
  onGetStarted?: () => void;
}

export const CtaSection: React.FC<CtaSectionProps> = ({ onGetStarted }) => {
  const handleGetStarted = () => {
    if (onGetStarted) {
      onGetStarted();
    } else {
      const consoleEl = document.getElementById('verification-console');
      if (consoleEl) {
        consoleEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          const textarea = document.getElementById('claim-input');
          if (textarea) textarea.focus();
        }, 400);
      }
    }
  };

  const handleReviewPrinciples = () => {
    const el = document.getElementById('principles');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section
      aria-label="Call to Action"
      className="py-20 md:py-24 bg-brand-navy text-white relative overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-md bg-brand-navy-light border border-white/10 text-brand-softblue text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
            <span>Open Civic Public Good</span>
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Make Informed Decisions with Evidence.
          </h2>

          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            Start with a claim. Examine the evidence. Understand what the sources actually say.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-3">
            <button
              type="button"
              onClick={handleGetStarted}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 text-sm sm:text-base font-bold text-brand-navy bg-white hover:bg-slate-100 active:bg-slate-200 rounded-xl shadow-xs transition-colors focus-visible:outline-white"
            >
              <span>Get Started</span>
              <ArrowRight className="w-4 h-4 text-brand-blue" />
            </button>

            <button
              type="button"
              onClick={handleReviewPrinciples}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm sm:text-base font-semibold text-white bg-brand-navy-light hover:bg-slate-800 border border-white/15 rounded-xl transition-colors focus-visible:outline-brand-blue"
            >
              <BookOpen className="w-4 h-4 text-brand-green" />
              <span>Review Verification Principles</span>
            </button>
          </div>

          <div className="pt-4 text-xs text-slate-400">
            Phase 1 Foundation · Backend retrieval & Gemini analysis activating in Phase 2
          </div>
        </div>
      </div>
    </section>
  );
};
