import React, { useState } from 'react';
import {
  Building2,
  FileCheck,
  BookmarkCheck,
  SplitSquareVertical,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  XCircle,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { VERIFICATION_PRINCIPLES } from '../../data/principles';
import { VERDICT_DEFINITIONS } from '../../data/verdicts';
import { VerificationVerdict } from '../../types';

export const VerificationPrinciples: React.FC = () => {
  const [selectedVerdict, setSelectedVerdict] = useState<VerificationVerdict>('SUPPORTED');

  const principlesList = [
    {
      title: 'Prefer Authoritative Sources',
      description:
        'Verification is anchored exclusively in primary sovereign records: The Gazette of India (egazette.gov.in), ministry notifications (.gov.in / .nic.in), statutory guidelines, and official Press Information Bureau (PIB) releases — never third-party blogs or social media commentary.',
      benefit: 'Ensures factual claims are evaluated against sovereign, legally enacted public records.',
      icon: Building2,
    },
    {
      title: 'Separate Relevance from Evidentiary Support',
      description:
        'A government document mentioning a welfare scheme does not automatically prove a viral claim true. The system rigorously distinguishes topical relevance from actual evidentiary confirmation of specific numbers or dates.',
      benefit: 'Prevents misleading "partially related" citations from generating false credibility.',
      icon: FileCheck,
    },
    {
      title: 'Explain Contradictory & Supporting Evidence',
      description:
        'Viral messages often wrap genuine program names around false numbers. The platform clarifies exactly which clauses are supported and precisely which figures or dates are contradicted by official records.',
      benefit: 'Eliminates citizen confusion when a claim contains a grain of truth wrapped in error.',
      icon: SplitSquareVertical,
    },
    {
      title: 'Show Source References When Available',
      description:
        'Every verification result will be accompanied by the exact official URL, circular reference number, notification date, and paragraph or clause where the fact is established, enabling independent citizen audits.',
      benefit: 'Empowers citizens, journalists, and researchers to audit primary documents directly.',
      icon: BookmarkCheck,
    },
    {
      title: 'State Clearly When Evidence Is Insufficient',
      description:
        'If official records have not addressed an unverified rumor or if sovereign gazettes do not corroborate a leak, the platform returns an explicit INSUFFICIENT_EVIDENCE finding rather than guessing or hallucinating.',
      benefit: 'Upholds absolute epistemic honesty and prevents synthetic misdirection.',
      icon: AlertCircle,
    },
  ];

  const getVerdictIcon = (verdict: VerificationVerdict) => {
    switch (verdict) {
      case 'SUPPORTED':
        return <CheckCircle2 className="w-5 h-5 text-brand-green" />;
      case 'PARTIALLY_SUPPORTED':
        return <AlertCircle className="w-5 h-5 text-amber-600" />;
      case 'CONTRADICTED':
        return <XCircle className="w-5 h-5 text-rose-600" />;
      case 'INSUFFICIENT_EVIDENCE':
        return <HelpCircle className="w-5 h-5 text-brand-slate" />;
    }
  };

  const currentVerdictDef =
    VERDICT_DEFINITIONS.find((v) => v.verdict === selectedVerdict) || VERDICT_DEFINITIONS[0];

  return (
    <section
      id="principles"
      aria-label="Core Verification Principles"
      className="py-16 md:py-24 bg-white border-b border-brand-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-14 space-y-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-green bg-brand-green-light px-2.5 py-1 rounded-md border border-brand-green-border">
            <ShieldCheck className="w-3.5 h-3.5 text-brand-green" />
            <span>Civic Integrity & Responsibility</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
            Verification Principles
          </h2>
          <p className="text-brand-slate text-sm sm:text-base leading-relaxed">
            Every verification procedure in GovVerify AI is governed by strict civic integrity protocols
            to guarantee accountability, eliminate hallucination, and empower citizens with primary
            government records.
          </p>
        </div>

        {/* 5 Distinctive Principles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {principlesList.map((principle, index) => {
            const Icon = principle.icon;
            return (
              <div
                key={principle.title}
                className="p-6.5 bg-brand-bg-subtle/80 hover:bg-white rounded-xl border border-brand-border hover:border-brand-green-border hover:shadow-xs transition-all duration-200 flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-brand-green-light text-brand-green flex items-center justify-center border border-brand-green-border shadow-2xs">
                      <Icon className="w-5 h-5 stroke-[2.2]" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-mono font-bold text-brand-slate-light">
                      0{index + 1}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-brand-navy leading-snug">
                    {principle.title}
                  </h3>

                  <p className="text-xs sm:text-sm text-brand-slate leading-relaxed">
                    {principle.description}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-brand-border text-xs font-medium text-brand-navy">
                  <span className="text-brand-green font-bold">Standard: </span>
                  {principle.benefit}
                </div>
              </div>
            );
          })}
        </div>

        {/* The Four Eventual Verdicts Sub-Section */}
        <div className="bg-brand-bg-subtle rounded-2xl border border-brand-border p-6 sm:p-8">
          <div className="max-w-2xl mb-6 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-blue">
              Taxonomy of Outcomes
            </span>
            <h3 className="text-xl sm:text-2xl font-extrabold text-brand-navy">
              The Four Eventual Verdicts
            </h3>
            <p className="text-xs sm:text-sm text-brand-slate">
              GovVerify AI uses a calibrated 4-state verdict framework to prevent misleading binary labels.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Verdict Tabs on Left */}
            <div className="lg:col-span-5 space-y-2">
              {VERDICT_DEFINITIONS.map((v) => (
                <button
                  key={v.verdict}
                  type="button"
                  onClick={() => setSelectedVerdict(v.verdict)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                    selectedVerdict === v.verdict
                      ? 'bg-white border-brand-blue shadow-xs'
                      : 'bg-white/60 hover:bg-white border-brand-border text-brand-navy'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">{getVerdictIcon(v.verdict)}</div>
                    <div>
                      <div className="text-[11px] font-bold text-brand-slate font-mono">
                        {v.verdict}
                      </div>
                      <div className="text-sm font-bold text-brand-navy">
                        {v.label}
                      </div>
                    </div>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-brand-slate transition-transform ${
                      selectedVerdict === v.verdict ? 'rotate-90 text-brand-blue' : ''
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Verdict Detail Card on Right */}
            <div className="lg:col-span-7 bg-white p-6 sm:p-7 rounded-xl border border-brand-border shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-brand-border">
                <div className="flex items-center gap-2">
                  {getVerdictIcon(currentVerdictDef.verdict)}
                  <span className="text-base font-extrabold text-brand-navy">
                    {currentVerdictDef.label}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-brand-navy bg-brand-bg-subtle px-2.5 py-1 rounded border border-brand-border">
                  {currentVerdictDef.verdict}
                </span>
              </div>

              <div>
                <div className="text-xs font-bold text-brand-slate uppercase tracking-wider mb-1">
                  Definition & Evidentiary Standard
                </div>
                <p className="text-sm text-brand-slate leading-relaxed">
                  {currentVerdictDef.description}
                </p>
              </div>

              <div className="p-3.5 bg-brand-bg-subtle rounded-lg border border-brand-border text-xs space-y-1">
                <div className="font-bold text-brand-navy">Typical Real-World Scenario:</div>
                <div className="text-brand-slate italic">
                  "{currentVerdictDef.exampleScenario}"
                </div>
              </div>

              <div className="text-[11px] text-brand-slate-light pt-2 border-t border-brand-border">
                Note: In Phase 1, verdicts are not simulated for user queries. This taxonomy will be
                populated once the Gemini API and Tavily source retrieval engine are activated in Phase 2.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
