import React from 'react';
import { ShieldCheck, Target, Eye, AlertOctagon, CheckCircle2 } from 'lucide-react';

export const AboutSection: React.FC = () => {
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
              <span>Civic Purpose & Background</span>
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-brand-navy tracking-tight leading-tight">
              Bridging the Gap Between Sovereign Gazettes and Everyday Citizens
            </h2>

            <p className="text-brand-navy text-sm sm:text-base leading-relaxed">
              In India, hundreds of millions of citizens rely on social media groups and messaging apps
              for news about welfare schemes, scholarships, direct cash transfers, and public recruitment.
              Unfortunately, altered PDF notifications, misleading headlines, and outright fraud frequently
              circulate, causing citizens to pay unauthorized fees or miss genuine deadlines.
            </p>

            <p className="text-brand-slate text-sm leading-relaxed">
              While the official Gazettes of India and ministry portals publish authoritative records,
              these legal documents are often dense, multi-page notifications written in technical administrative
              parlance. <strong className="text-brand-navy">GovVerify AI</strong> is engineered as an open bridge:
              enabling any citizen, grassroots worker, or journalist to test a claim against sovereign public
              archives with complete transparency and auditable citations.
            </p>

            {/* Core Commitments List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3">
                <div className="p-1 rounded-md bg-brand-green-light text-brand-green border border-brand-green-border shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-navy">Zero Commercial or Political Affiliation</h3>
                  <p className="text-xs text-brand-slate">
                    GovVerify AI operates strictly as an objective, non-partisan civic technology tool.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded-md bg-brand-softblue text-brand-blue border border-brand-softblue-border shrink-0 mt-0.5">
                  <Eye className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-navy">Radical Epistemic Honesty</h3>
                  <p className="text-xs text-brand-slate">
                    If official gazettes have not addressed a viral rumor, we state INSUFFICIENT_EVIDENCE
                    rather than guessing or fabricating synthetic conclusions.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-1 rounded-md bg-purple-50 text-purple-700 border border-purple-200 shrink-0 mt-0.5">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-brand-navy">Direct Clause-Level Auditability</h3>
                  <p className="text-xs text-brand-slate">
                    Citizens are not asked to take an AI system's word on faith. Every future result will
                    point to the specific government circular number, notification date, and source clause.
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
