import React from 'react';
import {
  Split,
  FileSearch,
  FileCheck2,
  CheckCircle2,
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const FeatureSection: React.FC = () => {
  const { t } = useLanguage();

  const features = [
    {
      id: 'claim-level',
      title: t('features.claimLevelTitle'),
      subtitle: t('features.claimLevelSub'),
      description: t('features.claimLevelDesc'),
      plannedWorkflow: t('features.claimLevelWorkflow'),
      icon: Split,
    },
    {
      id: 'evidence-transparency',
      title: t('features.evidenceTitle'),
      subtitle: t('features.evidenceSub'),
      description: t('features.evidenceDesc'),
      plannedWorkflow: t('features.evidenceWorkflow'),
      icon: FileSearch,
    },
    {
      id: 'document-verification',
      title: t('features.documentTitle'),
      subtitle: t('features.documentSub'),
      description: t('features.documentDesc'),
      plannedWorkflow: t('features.documentWorkflow'),
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
            <span>{t('features.badge')}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
            {t('features.title')}
          </h2>
          <p className="text-brand-slate text-sm sm:text-base leading-relaxed">
            {t('features.subtitle')}
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
