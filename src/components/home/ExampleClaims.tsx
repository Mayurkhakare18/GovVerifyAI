import React from 'react';
import {
  Coins,
  GraduationCap,
  Home,
  HeartPulse,
  ArrowUpRight,
  AlertCircle,
  Building,
} from 'lucide-react';
import { EXAMPLE_CLAIMS } from '../../data/examples';
import { ExampleClaim } from '../../types';

interface ExampleClaimsProps {
  onSelectClaim: (claimText: string) => void;
}

export const ExampleClaims: React.FC<ExampleClaimsProps> = ({ onSelectClaim }) => {
  const getCategoryIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Coins':
        return <Coins className="w-4.5 h-4.5" />;
      case 'GraduationCap':
        return <GraduationCap className="w-4.5 h-4.5" />;
      case 'Home':
        return <Home className="w-4.5 h-4.5" />;
      case 'HeartPulse':
        return <HeartPulse className="w-4.5 h-4.5" />;
      default:
        return <Coins className="w-4.5 h-4.5" />;
    }
  };

  const handleSelect = (claim: ExampleClaim) => {
    onSelectClaim(claim.claimText);
    const consoleEl = document.getElementById('verification-console');
    if (consoleEl) {
      consoleEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        const textarea = document.getElementById('claim-input');
        if (textarea) textarea.focus();
      }, 400);
    }
  };

  return (
    <section
      id="examples"
      aria-label="Example Claims for Verification"
      className="py-16 md:py-20 bg-brand-bg-subtle border-b border-brand-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-10 space-y-2.5">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-blue bg-brand-softblue px-2.5 py-1 rounded-md border border-brand-softblue-border">
            <span>Illustrative Samples</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-navy tracking-tight">
            See What You Can Verify
          </h2>
          <p className="text-brand-slate text-sm sm:text-base leading-relaxed">
            Select an illustrative citizen claim below to populate the verification console and test
            input formatting. These represent common policy topics circulating on public communication channels.
          </p>
        </div>

        {/* Clear Illustrative Disclaimer Banner */}
        <div className="mb-8 p-4 rounded-xl border border-amber-200 bg-amber-50/70 flex items-start gap-3">
          <AlertCircle className="w-4.5 h-4.5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-xs sm:text-sm text-amber-900 leading-relaxed">
            <span className="font-bold">Illustrative Input Examples Only — Unverified:</span> These cards
            serve strictly to demonstrate input formatting and claim scope. GovVerify AI does not hardcode
            verdicts, synthetic ratings, or fabricated statistics into these samples. Each statement remains
            unverified until processed by the future source retrieval engine.
          </div>
        </div>

        {/* 4 Polished Example Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {EXAMPLE_CLAIMS.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between p-6 bg-white hover:bg-white rounded-xl border border-brand-border hover:border-brand-blue hover:shadow-md transition-all duration-200"
            >
              <div className="space-y-3.5">
                {/* Category Header with Icon */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-brand-blue">
                    <div className="w-7 h-7 rounded-lg bg-brand-softblue text-brand-blue flex items-center justify-center shrink-0 border border-brand-softblue-border">
                      {getCategoryIcon(item.iconName)}
                    </div>
                    <span>{item.category}</span>
                  </div>
                  <span className="text-brand-slate-light font-mono text-[11px]">Illustrative Claim</span>
                </div>

                {/* Title */}
                <h3 className="text-base font-bold text-brand-navy group-hover:text-brand-blue transition-colors leading-snug">
                  {item.title}
                </h3>

                {/* Target Ministry */}
                <div className="flex items-center gap-1.5 text-xs text-brand-slate">
                  <Building className="w-3.5 h-3.5 shrink-0 text-brand-slate-light" aria-hidden="true" />
                  <span className="truncate">{item.targetMinistry}</span>
                </div>

                {/* Claim Statement Quote */}
                <div className="p-3.5 bg-brand-bg-subtle group-hover:bg-brand-softblue/30 rounded-lg border border-brand-border text-xs sm:text-sm text-brand-navy leading-relaxed italic">
                  "{item.claimText}"
                </div>

                {/* Context Note */}
                <p className="text-[11px] text-brand-slate">
                  {item.whyPeopleAsk}
                </p>
              </div>

              {/* Action Button: Try this claim */}
              <div className="pt-4.5 mt-4 border-t border-brand-border flex items-center justify-between">
                <span className="text-[11px] text-brand-slate-light">Click to populate console</span>
                <button
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-brand-blue bg-brand-softblue hover:bg-brand-blue hover:text-white rounded-lg transition-colors focus-visible:outline-brand-blue shadow-2xs"
                >
                  <span>Try this claim</span>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
