import React, { useState } from 'react';
import { ExternalLink, AlertCircle, ArrowUp } from 'lucide-react';
import { APP_CONFIG } from '../../config';
import { BrandLogo } from '../common/BrandLogo';
import { StatusModal } from '../common/StatusModal';

export const Footer: React.FC = () => {
  const [legalModalState, setLegalModalState] = useState<{
    isOpen: boolean;
    title: string;
    docType: string;
  }>({ isOpen: false, title: '', docType: '' });

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openLegalPlaceholder = (docType: string, title: string) => {
    setLegalModalState({ isOpen: true, title, docType });
  };

  return (
    <>
      <footer className="bg-brand-navy-dark text-slate-300 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12">
            {/* Brand & Mission Column */}
            <div className="lg:col-span-4 space-y-4">
              <BrandLogo size={36} showText={true} showTagline={true} />

              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed pt-1">
                An open civic technology initiative dedicated to helping citizens, journalists, and
                researchers cross-reference government claims against primary sovereign public records.
              </p>

              <div className="text-xs text-slate-500 font-mono">
                System Status: {APP_CONFIG.version}
              </div>
            </div>

            {/* Quick Navigation Links */}
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Platform
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#home" className="hover:text-white transition-colors">
                    Home
                  </a>
                </li>
                <li>
                  <a href="#verification-console" className="hover:text-white transition-colors">
                    Verification Panel
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#schemes" className="hover:text-white transition-colors">
                    Schemes Directory
                  </a>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#principles" className="hover:text-white transition-colors">
                    Verification Principles
                  </a>
                </li>
                <li>
                  <a href="#resources" className="hover:text-white transition-colors">
                    Comparison Logic
                  </a>
                </li>
                <li>
                  <a href="#about" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    FAQs
                  </a>
                </li>
              </ul>
            </div>

            {/* Authoritative Sovereign Repositories */}
            <div className="lg:col-span-3 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Official Portals
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Direct links to sovereign portals for independent citizen verification:
              </p>
              <ul className="space-y-2 text-xs font-mono">
                <li>
                  <a
                    href="https://egazette.gov.in"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-slate-300 hover:text-brand-softblue transition-colors"
                  >
                    <span>egazette.gov.in</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://pib.gov.in"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-slate-300 hover:text-brand-softblue transition-colors"
                  >
                    <span>pib.gov.in</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.myscheme.gov.in"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-slate-300 hover:text-brand-softblue transition-colors"
                  >
                    <span>myscheme.gov.in</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://india.gov.in"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="flex items-center gap-1.5 text-slate-300 hover:text-brand-softblue transition-colors"
                  >
                    <span>india.gov.in</span>
                    <ExternalLink className="w-3 h-3 text-slate-500" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Governance & Forthcoming Legal Documentation */}
            <div className="lg:col-span-3 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Legal & Governance
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Platform policies designed for public trust and data minimization:
              </p>
              <ul className="space-y-2 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      openLegalPlaceholder(
                        'Privacy Policy',
                        'Privacy Policy & Data Minimization Charter'
                      )
                    }
                    className="text-left text-slate-300 hover:text-white transition-colors"
                  >
                    Privacy Policy (Forthcoming in Phase 2)
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      openLegalPlaceholder(
                        'Terms of Service',
                        'Terms of Civic Service & Disclaimer'
                      )
                    }
                    className="text-left text-slate-300 hover:text-white transition-colors"
                  >
                    Terms of Service (Forthcoming in Phase 2)
                  </button>
                </li>
                <li>
                  <a href="#principles" className="text-slate-300 hover:text-white transition-colors">
                    Evidentiary Transparency Standards
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Legal / Independence Disclaimer Box */}
          <div className="mt-12 pt-8 border-t border-slate-800">
            <div className="p-4.5 bg-slate-900/90 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-2">
              <div className="font-bold text-slate-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Civic Technology & Non-Affiliation Disclaimer</span>
              </div>
              <p className="leading-relaxed">
                {APP_CONFIG.disclaimer}
              </p>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <div>
                © {new Date().getFullYear()} GovVerify AI. Independent civic technology initiative.
              </div>
              <button
                type="button"
                onClick={scrollToTop}
                className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
              >
                <span>Back to top</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Forthcoming Legal Placeholders Modal */}
      <StatusModal
        isOpen={legalModalState.isOpen}
        onClose={() => setLegalModalState({ isOpen: false, title: '', docType: '' })}
        title={legalModalState.title}
        badgeText="Forthcoming in Phase 2"
        primaryActionLabel="Understood"
      >
        <p className="text-brand-slate text-sm leading-relaxed">
          The formal <strong>{legalModalState.docType}</strong> documentation will be published in{' '}
          <strong className="text-brand-navy">Phase 2</strong> alongside user authentication and persistent
          database configuration.
        </p>
        <div className="p-3.5 bg-brand-softblue border border-brand-softblue-border rounded-xl text-xs text-brand-navy space-y-1">
          <div className="font-bold text-brand-blue">Core Privacy Principles Enforced in Phase 1:</div>
          <ul className="list-disc list-inside space-y-0.5 text-brand-slate">
            <li>No personal identification numbers (Aadhaar, PAN, phone) are requested or retained.</li>
            <li>No tracking cookies or telemetry beacons are injected.</li>
            <li>All client-side claim text processing is ephemeral.</li>
          </ul>
        </div>
      </StatusModal>
    </>
  );
};
