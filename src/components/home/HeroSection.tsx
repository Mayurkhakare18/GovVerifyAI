import React from 'react';
import { ShieldCheck, ArrowRight, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from '../../contexts/RouterContext';

export const HeroSection: React.FC<{ onGetStarted?: () => void }> = ({ onGetStarted }) => {
  const { isAuthenticated } = useAuth();

  return (
    <section
      id="home"
      aria-label="GovVerify AI Hero Section"
      className="relative w-full min-h-[65vh] sm:min-h-[75vh] lg:min-h-[82vh] flex items-center overflow-hidden border-b border-brand-border bg-slate-900"
      style={{
        backgroundImage:
          "url('/Verify%20the%20Claim_%20India%20Government%20Workspace.png'), url('/verify-claim-hero.png'), url('/hero-bg.png')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Subtle directional gradient on the left for contrast */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/85 via-45% to-white/20 lg:to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Responsive mobile overlay for readability */}
      <div
        className="absolute inset-0 bg-white/70 sm:hidden pointer-events-none"
        aria-hidden="true"
      />

      {/* Hero Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-32 relative z-10 w-full">
        <div className="max-w-2xl lg:max-w-3xl">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] xl:text-[3.6rem] font-black text-brand-navy tracking-tight leading-[1.14]">
            Verify Government Information{' '}
            <span className="text-brand-blue font-black">with Confidence.</span>
          </h1>

          <p className="mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-brand-slate leading-relaxed font-normal">
            Check claims about government schemes, scholarships, benefits, policies, and
            announcements using authoritative sources. Get clear explanations and evidence
            references in simple language.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/app"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white text-sm font-bold shadow-md shadow-brand-blue/20 transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Open Citizen Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={onGetStarted}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white text-sm font-bold shadow-md shadow-brand-blue/20 transition-all cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Get Started — Free Verification</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <a
              href="#how-it-works"
              className="inline-flex items-center gap-1.5 px-4.5 py-3 rounded-xl bg-white/90 hover:bg-white text-brand-navy border border-brand-border text-sm font-semibold transition-colors"
            >
              <span>Explore How It Works</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
