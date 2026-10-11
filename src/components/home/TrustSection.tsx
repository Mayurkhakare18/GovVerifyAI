import React from 'react';
import { Scale, Building2, FileCheck2, HelpCircle } from 'lucide-react';

export const TrustSection: React.FC = () => {
  const trustItems = [
    {
      title: 'Evidence-Based Analysis',
      description:
        'Evaluates factual claims directly against published sovereign public records rather than web speculation or narrative summaries.',
      icon: Scale,
    },
    {
      title: 'Official-Source Focus',
      description:
        'Evidence is retrieved strictly from the Gazette of India, PIB releases, and verified .gov.in and .nic.in portals.',
      icon: Building2,
    },
    {
      title: 'Clause and Document References',
      description:
        'Every finding references specific government circular numbers, notification dates, and precise administrative clauses.',
      icon: FileCheck2,
    },
    {
      title: 'Transparent Uncertainty',
      description:
        'Explicitly returns Insufficient Evidence when public records do not corroborate or refute an unverified rumor.',
      icon: HelpCircle,
    },
  ];

  return (
    <section
      aria-label="Trust and Value Proposition"
      className="py-12 bg-white border-b border-brand-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {trustItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="p-5.5 rounded-xl border border-brand-border bg-brand-bg-subtle/80 hover:bg-white hover:border-brand-softblue-border hover:shadow-xs transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-brand-softblue text-brand-blue flex items-center justify-center mb-3.5 border border-brand-softblue-border">
                  <Icon className="w-4.5 h-4.5 stroke-[2.2]" aria-hidden="true" />
                </div>
                <h3 className="text-sm font-bold text-brand-navy mb-1.5 leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-brand-slate leading-relaxed">
                  {item.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
