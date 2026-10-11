/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ShieldCheck, ArrowRight, Sparkles, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, Link } from '../../contexts/RouterContext';
import { Navbar } from '../layout/Navbar';
import { HeroSection } from '../home/HeroSection';
import { VerificationConsole } from '../home/VerificationConsole';
import { TrustSection } from '../home/TrustSection';
import { ExampleClaims } from '../home/ExampleClaims';
import { AuthModal } from '../auth/AuthModal';

const HowItWorks = React.lazy(() =>
  import('../home/HowItWorks').then((m) => ({ default: m.HowItWorks }))
);
const FeatureSection = React.lazy(() =>
  import('../home/FeatureSection').then((m) => ({ default: m.FeatureSection }))
);
const VerificationPrinciples = React.lazy(() =>
  import('../home/VerificationPrinciples').then((m) => ({ default: m.VerificationPrinciples }))
);
const CategoryExplorer = React.lazy(() =>
  import('../home/CategoryExplorer').then((m) => ({ default: m.CategoryExplorer }))
);
const EvidenceComparisonExplainer = React.lazy(() =>
  import('../home/EvidenceComparisonExplainer').then((m) => ({ default: m.EvidenceComparisonExplainer }))
);
const AboutSection = React.lazy(() =>
  import('../home/AboutSection').then((m) => ({ default: m.AboutSection }))
);
const FaqSection = React.lazy(() =>
  import('../home/FaqSection').then((m) => ({ default: m.FaqSection }))
);
const CtaSection = React.lazy(() =>
  import('../home/CtaSection').then((m) => ({ default: m.CtaSection }))
);
const Footer = React.lazy(() =>
  import('../layout/Footer').then((m) => ({ default: m.Footer }))
);

const SectionPlaceholder = ({
  id,
  minHeight = 'min-h-[320px]',
}: {
  id?: string;
  minHeight?: string;
}) => (
  <section
    id={id}
    className={`w-full ${minHeight} bg-white flex items-center justify-center`}
    aria-busy="true"
  >
    <div className="flex items-center gap-2 text-xs text-brand-slate font-medium">
      <div className="w-4 h-4 rounded-full border-2 border-brand-blue border-t-transparent animate-spin" />
      <span>Loading sovereign verification details...</span>
    </div>
  </section>
);

export const LandingPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const { navigate } = useRouter();
  const [selectedExampleClaim, setSelectedExampleClaim] = useState<string>('');
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalTab, setAuthModalTab] = useState<'signin' | 'signup'>('signup');

  const handleSelectExample = (claimText: string) => {
    if (isAuthenticated) {
      navigate(`/app/verify?claim=${encodeURIComponent(claimText)}`);
    } else {
      setSelectedExampleClaim(claimText);
      const consoleEl = document.getElementById('verification-console');
      if (consoleEl) {
        consoleEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setTimeout(() => {
          const textarea = document.getElementById('claim-input');
          if (textarea) textarea.focus();
        }, 350);
      }
    }
  };

  const handleClaimPopulated = () => {
    setSelectedExampleClaim('');
  };

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate('/app');
    } else {
      setAuthModalTab('signup');
      setAuthModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-brand-navy selection:bg-brand-softblue selection:text-brand-blue">
      {/* Skip to Main Content Link for Accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-blue focus:text-white focus:rounded-md focus:shadow-md focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Navigation Bar */}
      <Navbar />

      {/* Main Content Area */}
      <main id="main-content" className="flex-1">
        {/* 1. Hero Section with Full-Bleed Background Image */}
        <HeroSection onGetStarted={handleGetStarted} />

        {/* 2. Interactive Illustrative Verification Preview Section */}
        <section
          id="verification-console-section"
          className="relative py-12 lg:py-16 bg-gradient-to-b from-brand-bg-subtle via-white to-slate-50 border-b border-brand-border"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-brand-softblue-border text-[11px] font-bold tracking-wider text-brand-blue uppercase shadow-2xs mb-2.5">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-blue" aria-hidden="true" />
                <span>Illustrative Verification Console</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-brand-navy tracking-tight">
                Test a Claim or Official Document
              </h2>
              <p className="mt-2 text-sm sm:text-base text-brand-slate max-w-xl mx-auto">
                Submit an illustrative statement or notification to preview how claims are audited against sovereign gazettes and official ministry portals.
              </p>

              {/* Dedicated Workspace Promotion Banner */}
              <div className="mt-4 p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl inline-flex flex-col sm:flex-row items-center gap-2.5 text-xs text-blue-900 shadow-2xs">
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Looking for persistent history, source directories, and personal records?</span>
                </span>
                <Link
                  href={isAuthenticated ? '/app' : '/app/verify'}
                  className="font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1"
                >
                  <span>{isAuthenticated ? 'Open Authenticated Dashboard' : 'Sign in to Enter Dashboard'}</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <VerificationConsole
              externalClaimText={selectedExampleClaim}
              onClaimPopulated={handleClaimPopulated}
            />
          </div>
        </section>

        {/* 3. Compact Trust & Value Proposition Section (4 items) */}
        <TrustSection />

        {/* 4. Example Claims Section ("See What You Can Verify" with 4 cards) */}
        <ExampleClaims onSelectClaim={handleSelectExample} />

        {/* 5. How It Works (01 Enter -> 02 Find -> 03 Compare -> 04 Review) */}
        <React.Suspense
          fallback={<SectionPlaceholder id="how-it-works" minHeight="min-h-[480px]" />}
        >
          <HowItWorks />
        </React.Suspense>

        {/* 6. Feature Section ("More Than a Search. Evidence You Can Examine.") */}
        <React.Suspense
          fallback={<SectionPlaceholder id="features" minHeight="min-h-[380px]" />}
        >
          <FeatureSection />
        </React.Suspense>

        {/* 7. Verification Principles (5 core principles + 4 eventual verdicts) */}
        <React.Suspense
          fallback={<SectionPlaceholder id="principles" minHeight="min-h-[360px]" />}
        >
          <VerificationPrinciples />
        </React.Suspense>

        {/* 8. Explore by Category (6 domains of government information) */}
        <React.Suspense
          fallback={<SectionPlaceholder id="schemes" minHeight="min-h-[360px]" />}
        >
          <CategoryExplorer />
        </React.Suspense>

        {/* 9. Visual Explanation of Claim-to-Evidence Comparison */}
        <React.Suspense
          fallback={<SectionPlaceholder id="resources" minHeight="min-h-[380px]" />}
        >
          <EvidenceComparisonExplainer />
        </React.Suspense>

        {/* 10. About GovVerify AI */}
        <React.Suspense
          fallback={<SectionPlaceholder id="about" minHeight="min-h-[320px]" />}
        >
          <AboutSection />
        </React.Suspense>

        {/* 11. Frequently Asked Questions (6 required questions) */}
        <React.Suspense
          fallback={<SectionPlaceholder id="faq" minHeight="min-h-[360px]" />}
        >
          <FaqSection />
        </React.Suspense>

        {/* 12. Final Call-to-Action ("Make Informed Decisions with Evidence.") */}
        <React.Suspense
          fallback={<SectionPlaceholder id="cta" minHeight="min-h-[260px]" />}
        >
          <CtaSection onGetStarted={handleGetStarted} />
        </React.Suspense>
      </main>

      {/* Footer */}
      <React.Suspense
        fallback={<footer id="footer" className="w-full min-h-[160px] bg-brand-navy" />}
      >
        <Footer />
      </React.Suspense>

      {/* Auth Modal for Unauthenticated Calls */}
      {authModalOpen && (
        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          initialTab={authModalTab}
        />
      )}
    </div>
  );
};
