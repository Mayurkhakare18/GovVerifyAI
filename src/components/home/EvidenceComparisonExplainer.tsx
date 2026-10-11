import React from 'react';
import {
  FileText,
  Split,
  Search,
  Scale,
  CheckCircle2,
  XCircle,
  FileCheck,
} from 'lucide-react';

export const EvidenceComparisonExplainer: React.FC = () => {
  return (
    <section
      id="resources"
      aria-label="Claim to Evidence Comparison Methodology"
      className="py-16 md:py-24 bg-white border-b border-brand-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-14 space-y-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-blue bg-brand-softblue px-2.5 py-1 rounded-md border border-brand-softblue-border">
            <span>Analytical Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
            How Claim-to-Evidence Comparison Works
          </h2>
          <p className="text-brand-slate text-sm sm:text-base leading-relaxed">
            GovVerify AI will not evaluate claims as single black-box statements. Instead, it parses complex
            messages into atomic factual assertions and maps each assertion directly against statutory
            government clauses.
          </p>
        </div>

        {/* Visual Comparison Architecture Diagram */}
        <div className="bg-brand-bg-subtle rounded-2xl border border-brand-border p-6 sm:p-8 space-y-8">
          {/* Top: Illustrative Claim Input */}
          <div className="bg-white p-5.5 rounded-xl border border-brand-border shadow-2xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-slate">
                1. Citizen Input Claim (Sample)
              </span>
              <span className="text-[11px] font-mono text-brand-slate-light">
                Natural Language Ingestion
              </span>
            </div>
            <div className="p-3.5 bg-brand-bg-subtle border-l-3 border-brand-blue rounded text-sm text-brand-navy font-medium italic">
              "Under the PM-KISAN scheme, the central government has increased the installment amount from ₹2,000 to ₹4,000 per installment for all small and marginal farmers starting this year."
            </div>
          </div>

          {/* Middle: Decomposition & Matching Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Column A: Atomic Decomposition */}
            <div className="lg:col-span-5 bg-white p-5.5 rounded-xl border border-brand-border shadow-2xs space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-blue">
                <Split className="w-4 h-4" />
                <span>2. Atomic Proposition Breakdown</span>
              </div>
              <p className="text-xs text-brand-slate">
                Deconstructs the narrative into independent verifiable propositions:
              </p>

              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-lg bg-brand-bg-subtle border border-brand-border flex items-start gap-2.5">
                  <span className="font-mono font-bold text-brand-blue shrink-0">A1.</span>
                  <div>
                    <span className="font-semibold text-brand-navy">Target Scheme: </span>
                    <span className="text-brand-slate">PM-KISAN (Pradhan Mantri Kisan Samman Nidhi).</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-brand-bg-subtle border border-brand-border flex items-start gap-2.5">
                  <span className="font-mono font-bold text-brand-blue shrink-0">A2.</span>
                  <div>
                    <span className="font-semibold text-brand-navy">Financial Revision: </span>
                    <span className="text-brand-slate">Installment doubled from ₹2,000 to ₹4,000.</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-brand-bg-subtle border border-brand-border flex items-start gap-2.5">
                  <span className="font-mono font-bold text-brand-blue shrink-0">A3.</span>
                  <div>
                    <span className="font-semibold text-brand-navy">Effective Date: </span>
                    <span className="text-brand-slate">Enacted starting the current financial period.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column B: Authoritative Evidence Match */}
            <div className="lg:col-span-7 bg-white p-5.5 rounded-xl border border-brand-border shadow-2xs space-y-3.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-green">
                <FileCheck className="w-4 h-4 text-brand-green" />
                <span>3. Authoritative Source Clause Mapping</span>
              </div>
              <p className="text-xs text-brand-slate">
                Matched against official government documentation (Ministry & PIB):
              </p>

              <div className="space-y-2.5 text-xs">
                <div className="p-3.5 rounded-lg bg-brand-green-light border border-brand-green-border">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-brand-navy mb-1">
                    <span>Ministry of Agriculture & Farmers Welfare · Operational Guidelines Clause 3.1</span>
                    <span className="font-mono text-[10px] bg-white text-brand-green font-bold px-1.5 py-0.5 rounded border border-brand-green-border">
                      Official Source
                    </span>
                  </div>
                  <p className="text-brand-slate italic text-[11px] leading-relaxed">
                    "Under the scheme, an amount of ₹6,000/- per year is released by the Central Government in three equal installments of ₹2,000/- each directly into the bank accounts of the beneficiaries..."
                  </p>
                </div>

                <div className="p-3.5 rounded-lg bg-rose-50/70 border border-rose-200">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-rose-950 mb-1">
                    <span>Press Information Bureau (PIB Fact Check) · Clarification Circular</span>
                    <span className="font-mono text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded">
                      Official Clarification
                    </span>
                  </div>
                  <p className="text-rose-900 italic text-[11px] leading-relaxed">
                    "No decision has been taken by the Union Government to increase the PM-KISAN installment to ₹4,000. Circulating messages claiming an increment are false."
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom: Explainable Synthesis Outcome */}
          <div className="bg-white p-5.5 rounded-xl border border-brand-border shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-brand-border">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-slate">
                4. Granular Synthesis & Explainable Outcome
              </span>
              <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded">
                Eventual Verdict: CONTRADICTED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-brand-bg-subtle rounded-lg border border-brand-border">
                <div className="font-bold text-brand-navy mb-1">What is Accurate:</div>
                <p className="text-brand-slate">
                  The PM-KISAN scheme is an active direct benefit transfer for eligible farmer families.
                </p>
              </div>

              <div className="p-3.5 bg-brand-bg-subtle rounded-lg border border-brand-border">
                <div className="font-bold text-brand-navy mb-1">What is Contradicted:</div>
                <p className="text-brand-slate">
                  The installment remains ₹2,000 (annual ₹6,000). The claim of ₹4,000 is explicitly refuted.
                </p>
              </div>

              <div className="p-3.5 bg-brand-bg-subtle rounded-lg border border-brand-border">
                <div className="font-bold text-brand-navy mb-1">Auditable Evidence Reference:</div>
                <p className="text-brand-slate">
                  Official Gazette / PIB Clarification Ref No: PIB-DEL-2024-FACT-AGRI-09.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
