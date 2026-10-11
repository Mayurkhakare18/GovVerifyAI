import React, { useState } from 'react';
import {
  Landmark,
  GraduationCap,
  HeartHandshake,
  ScrollText,
  Megaphone,
  FileCheck2,
  ArrowRight,
  Info,
} from 'lucide-react';
import { SCHEME_CATEGORIES } from '../../data/categories';
import { SchemeCategory } from '../../types';
import { StatusModal } from '../common/StatusModal';

export const CategoryExplorer: React.FC = () => {
  const [activeCategoryModal, setActiveCategoryModal] = useState<SchemeCategory | null>(null);

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Landmark':
        return <Landmark className="w-5 h-5 stroke-[2]" />;
      case 'GraduationCap':
        return <GraduationCap className="w-5 h-5 stroke-[2]" />;
      case 'HeartHandshake':
        return <HeartHandshake className="w-5 h-5 stroke-[2]" />;
      case 'ScrollText':
        return <ScrollText className="w-5 h-5 stroke-[2]" />;
      case 'Megaphone':
        return <Megaphone className="w-5 h-5 stroke-[2]" />;
      case 'FileCheck2':
        return <FileCheck2 className="w-5 h-5 stroke-[2]" />;
      default:
        return <Landmark className="w-5 h-5 stroke-[2]" />;
    }
  };

  return (
    <>
      <section
        id="schemes"
        aria-label="Explore by Category"
        className="py-16 md:py-24 bg-brand-bg-subtle border-b border-brand-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="max-w-3xl mb-14 space-y-3">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-blue bg-brand-softblue px-2.5 py-1 rounded-md border border-brand-softblue-border">
              <span>Information Domains</span>
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
              Explore by Category
            </h2>
            <p className="text-brand-slate text-sm sm:text-base leading-relaxed">
              Explore major categories of citizen communications. Each domain maps directly to
              sovereign central and state government repositories for authoritative verification.
            </p>
          </div>

          {/* 6 Category Cards Responsive Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SCHEME_CATEGORIES.map((cat) => (
              <div
                key={cat.id}
                className="bg-white rounded-2xl border border-brand-border p-6.5 flex flex-col justify-between hover:border-brand-blue hover:shadow-md transition-all duration-200"
              >
                <div className="space-y-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-softblue text-brand-blue flex items-center justify-center border border-brand-softblue-border shadow-2xs">
                    {getCategoryIcon(cat.iconName)}
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-brand-navy mb-1.5 leading-snug">
                      {cat.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-brand-slate leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  {/* Common Schemes */}
                  <div className="pt-2 border-t border-brand-border">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-slate-light block mb-1.5">
                      Key Programs Covered:
                    </span>
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {cat.commonExamples.map((ex, i) => (
                        <span
                          key={i}
                          className="inline-block bg-white text-brand-navy border border-brand-border px-2 py-0.5 rounded-md text-[11px] font-medium"
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Primary Sources */}
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-slate-light block mb-1">
                      Authoritative Repositories:
                    </span>
                    <div className="text-xs text-brand-slate font-mono space-y-0.5">
                      {cat.primarySources.map((src, i) => (
                        <div key={i} className="truncate">
                          · {src}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Card Action */}
                <div className="pt-5 mt-4 border-t border-brand-border">
                  <button
                    type="button"
                    onClick={() => setActiveCategoryModal(cat)}
                    className="w-full inline-flex items-center justify-between text-xs font-bold text-brand-blue hover:text-brand-blue-hover p-2 rounded-lg hover:bg-brand-softblue transition-colors focus-visible:outline-brand-blue"
                  >
                    <span>View Category Scope</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Category Scope Status Modal */}
      {activeCategoryModal && (
        <StatusModal
          isOpen={activeCategoryModal !== null}
          onClose={() => setActiveCategoryModal(null)}
          title={activeCategoryModal.name}
          badgeText="Domain Architecture"
          primaryActionLabel="Understood"
        >
          <div className="space-y-4">
            <p className="text-brand-slate text-sm leading-relaxed">
              {activeCategoryModal.description}
            </p>

            <div className="p-3.5 bg-brand-softblue border border-brand-softblue-border rounded-xl text-xs space-y-1.5 text-brand-navy">
              <div className="font-bold text-brand-blue flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-brand-blue" />
                Category Directory Status (Phase 1):
              </div>
              <p className="text-brand-slate leading-relaxed">
                Live filtering and dedicated directory indices are planned for{' '}
                <strong className="text-brand-navy">Phase 2</strong>. In accordance with platform integrity
                principles, we do not present fabricated mock search results.
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-brand-navy uppercase tracking-wider block">
                Primary Government Repositories for this Domain:
              </span>
              <ul className="text-xs font-mono text-brand-slate space-y-1 bg-brand-bg-subtle p-3 rounded-xl border border-brand-border">
                {activeCategoryModal.primarySources.map((source, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
                    <span>{source}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-brand-navy uppercase tracking-wider block">
                Key Inquiries in this Domain:
              </span>
              <div className="text-xs text-brand-slate italic">
                {activeCategoryModal.commonExamples.join(', ')}
              </div>
            </div>
          </div>
        </StatusModal>
      )}
    </>
  );
};
