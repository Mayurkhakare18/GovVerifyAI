import React from 'react';
import {
  Split,
  FileSearch,
  FileCheck2,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';

export const FeatureSection: React.FC = () => {
  const features = [
    {
      id: 'claim-level',
      title: 'Claim-Level Verification',
      subtitle: 'Atomic statement decomposition',
      description:
        'Viral messages often mix genuine scheme titles with exaggerated sums or inaccurate eligibility deadlines. GovVerify AI will separate complex statements into distinct, atomic propositions (benefit amount, qualifying income, target dates) and evaluate each sub-clause individually.',
      plannedWorkflow: 'Deconstructs narratives into testable factual units',
      icon: Split,
    },
    {
      id: 'evidence-transparency',
      title: 'Evidence Transparency',
      subtitle: 'Direct source passage inspection',
      description:
        'Citizens are never asked to take an AI system\'s word on faith. Every verification finding will display the exact official circular reference number, gazette publication date, issuing ministry, and verifiable excerpts from statutory text.',
      plannedWorkflow: 'Direct links to sovereign .gov.in and egazette.gov.in records',
      icon: FileSearch,
    },
    {
      id: 'document-verification',
      title: 'Document Verification',
      subtitle: 'Bilingual OCR and circular cross-referencing',
      description:
        'Citizens often receive scanned circulars or photos of purported government orders. The planned pipeline will extract bilingual text (Hindi and English), verify administrative header identifiers, and cross-match Government Order numbers against the official gazette archive.',
      plannedWorkflow: 'Planned OCR and document structure matching for Phase 2',
      icon: FileCheck2,
    },
  ];

  return (
    <section
      id="features"
      aria-label="Features and Evidence Architecture"
      className="py-16 md:py-24 bg-brand-bg-subtle border-b border-brand-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-14 space-y-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-blue bg-brand-softblue px-2.5 py-1 rounded-md border border-brand-softblue-border">
            <span>Evidentiary Architecture</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
            More Than a Search. Evidence You Can Examine.
          </h2>
          <p className="text-brand-slate text-sm sm:text-base leading-relaxed">
            Traditional web searches retrieve blog opinions and news snippets. GovVerify AI is
            architected for structured, clause-by-clause comparison against primary legal documentation.
          </p>
        </div>

        {/* 3 Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.id}
                className="bg-white rounded-2xl border border-brand-border p-7 flex flex-col justify-between hover:border-brand-blue hover:shadow-md transition-all duration-200"
              >
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-xl bg-brand-softblue text-brand-blue flex items-center justify-center border border-brand-softblue-border shadow-2xs">
                    <Icon className="w-6 h-6 stroke-[2]" aria-hidden="true" />
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-brand-blue uppercase tracking-wider block mb-1">
                      {feature.subtitle}
                    </span>
                    <h3 className="text-lg font-bold text-brand-navy leading-snug">
                      {feature.title}
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm text-brand-slate leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="pt-5 mt-5 border-t border-brand-border">
                  <div className="flex items-center gap-2 text-xs font-semibold text-brand-navy">
                    <CheckCircle2 className="w-4 h-4 text-brand-green shrink-0" aria-hidden="true" />
                    <span>{feature.plannedWorkflow}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
