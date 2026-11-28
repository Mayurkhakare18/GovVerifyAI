import React from 'react';
import { ShieldCheck, Target, Eye, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';

export const AboutSection: React.FC = () => {
  const { t } = useLanguage();

  return (
    <section
      id="about"
      aria-label="About GovVerify AI"
      className="py-16 md:py-24 bg-brand-bg-subtle border-b border-brand-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Context & Narrative */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-blue bg-brand-softblue px-2.5 py-1 rounded-md border border-brand-softblue-border">
              <ShieldCheck className="w-3.5 h-3.5 text-brand-blue" />
              <span>{t('about.badge')}</span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-navy tracking-tight leading-tight">
              {t('about.title')}
            </h2>

            <p className="text-brand-navy text-sm sm:text-base leading-relaxed">
              {t('about.p1')}
            </p>

            <p className="text-brand-slate text-sm leading-relaxed">
              {t('about.p2')}
            </p>

            {/* Core Commitments List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-md bg-brand-green-light text-brand-green border border-brand-green-border shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-navy">{t('about.c1Title')}</h3>
                  <p className="text-xs text-brand-slate">
                    {t('about.c1Desc')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded-md bg-brand-softblue text-brand-blue border border-brand-softblue-border shrink-0 mt-0.5">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-navy">{t('about.c2Title')}</h3>
                  <p className="text-xs text-brand-slate">
                    {t('about.c2Desc')}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0 mt-0.5">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-navy">{t('about.c3Title')}</h3>
                  <p className="text-xs text-brand-slate">
                    {t('about.c3Desc')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Independence Statement & Card */}
          <div className="lg:col-span-5 space-y-5">
            <div className="bg-white p-6 sm:p-7 rounded-2xl border border-brand-border shadow-md space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-brand-border">
                <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="text-base font-bold text-brand-navy">
                  Institutional Independence Disclaimer
                </h3>
              </div>

              <p className="text-xs sm:text-sm text-brand-slate leading-relaxed">
                GovVerify AI is an independent civic technology system developed for public interest
                demonstration and information literacy.
              </p>

              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-950 space-y-2">
                <div className="font-bold">Important Notice to Users:</div>
                <ul className="list-disc list-inside space-y-1 text-amber-900">
                  <li>GovVerify AI does NOT represent the Government of India or any State Administration.</li>
                  <li>The platform does NOT issue legal decisions, eligibility certifications, or judicial verdicts.</li>
                  <li>Official benefits must be confirmed directly through sovereign portals (.gov.in or .nic.in).</li>
                </ul>
              </div>

              <div className="text-[11px] text-brand-slate-light pt-1">
                Designed according to open civic technology standards, digital accessibility guidelines, and
                evidence-based verification best practices.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
