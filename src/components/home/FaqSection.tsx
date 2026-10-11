import React, { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { FAQ_ITEMS } from '../../data/faqs';

export const FaqSection: React.FC = () => {
  const [openFaqId, setOpenFaqId] = useState<string | null>(FAQ_ITEMS[0].id);

  const toggleFaq = (id: string) => {
    setOpenFaqId((prev) => (prev === id ? null : id));
  };

  return (
    <section
      id="faq"
      aria-label="Frequently Asked Questions"
      className="py-16 md:py-24 bg-white border-b border-brand-border"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-blue bg-brand-softblue px-2.5 py-1 rounded-md border border-brand-softblue-border">
            <HelpCircle className="w-3.5 h-3.5 text-brand-blue" />
            <span>Questions & Clarity</span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-brand-slate text-sm sm:text-base leading-relaxed">
            Essential information regarding GovVerify AI's verification methodology, sovereign sources,
            and evidentiary boundaries.
          </p>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => {
            const isOpen = openFaqId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-xl border border-brand-border bg-brand-bg-subtle/50 hover:bg-brand-bg-subtle/80 overflow-hidden transition-all duration-150"
              >
                <button
                  type="button"
                  id={`faq-btn-${item.id}`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-ans-${item.id}`}
                  onClick={() => toggleFaq(item.id)}
                  className="w-full text-left p-5.5 flex items-center justify-between gap-4 hover:bg-brand-bg-subtle/60 transition-colors focus-visible:outline-brand-blue"
                >
                  <span className="text-sm sm:text-base font-bold text-brand-navy leading-snug">
                    {item.question}
                  </span>
                  <div
                    className={`w-7 h-7 rounded-lg bg-brand-bg-subtle flex items-center justify-center text-brand-slate shrink-0 transition-transform duration-200 border border-brand-border ${
                      isOpen ? 'rotate-180 bg-brand-softblue text-brand-blue border-brand-softblue-border' : ''
                    }`}
                  >
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  </div>
                </button>

                {isOpen && (
                  <div
                    id={`faq-ans-${item.id}`}
                    role="region"
                    aria-labelledby={`faq-btn-${item.id}`}
                    className="px-5.5 pb-5.5 pt-1 text-xs sm:text-sm text-brand-slate leading-relaxed border-t border-brand-border animate-in fade-in duration-150"
                  >
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Evidence Quality Note */}
        <div className="mt-8 text-center text-xs text-brand-slate">
          Conclusions depend on the availability and legal publication status of sovereign records.
          Always consult official gazettes on{' '}
          <a
            href="https://egazette.gov.in"
            target="_blank"
            rel="noreferrer noopener"
            className="text-brand-blue font-semibold hover:underline"
          >
            egazette.gov.in
          </a>{' '}
          for formal statutory confirmation.
        </div>
      </div>
    </section>
  );
};
