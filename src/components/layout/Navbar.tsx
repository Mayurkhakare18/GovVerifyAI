import React, { useState } from 'react';
import { Menu, X, Globe, User, LogIn, ChevronDown, CheckCircle2, LayoutDashboard, Mic } from 'lucide-react';
import { APP_CONFIG } from '../../config';
import { BrandLogo } from '../common/BrandLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Link } from '../../contexts/RouterContext';
import { VoiceAssistant } from '../voice/VoiceAssistant';

import { AuthModal } from '../auth/AuthModal';

interface NavbarProps {
  onNavigate?: (sectionId: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onNavigate }) => {
  const { user, profile, isAuthenticated } = useAuth();
  const { language, setLanguage, t, languages, currentLanguageOption } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);
  const [voiceAssistantOpen, setVoiceAssistantOpen] = useState(false);
  const [authModalState, setAuthModalState] = useState<{
    isOpen: boolean;
    tab: 'signin' | 'signup' | 'profile';
  }>({ isOpen: false, tab: 'signin' });

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (onNavigate) {
      onNavigate(targetId);
    } else {
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const openAuthNotice = (tab: 'signin' | 'signup' | 'profile') => {
    setAuthModalState({ isOpen: true, tab });
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white/85 backdrop-blur-md border-b border-brand-border/60 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
            {/* Left: Brand Logo, Name, Tagline */}
            <a
              href="#home"
              onClick={(e) => handleNavClick(e, 'home')}
              className="flex items-center group focus-visible:outline-brand-blue rounded-lg py-1"
              aria-label="GovVerify AI Home"
            >
              <BrandLogo size={38} showText={true} showTagline={true} />
            </a>

            {/* Center: Primary Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-7" aria-label="Main Navigation">
              <a
                href="#home"
                onClick={(e) => handleNavClick(e, 'home')}
                className="text-sm font-semibold text-brand-navy hover:text-brand-blue transition-colors py-1"
              >
                {t('nav.home')}
              </a>
              <a
                href="#how-it-works"
                onClick={(e) => handleNavClick(e, 'how-it-works')}
                className="text-sm font-semibold text-brand-navy hover:text-brand-blue transition-colors py-1"
              >
                {t('nav.howItWorks')}
              </a>
              <a
                href="#schemes"
                onClick={(e) => handleNavClick(e, 'schemes')}
                className="text-sm font-semibold text-brand-navy hover:text-brand-blue transition-colors py-1"
              >
                {t('nav.schemes')}
              </a>
              <a
                href="#features"
                onClick={(e) => handleNavClick(e, 'features')}
                className="text-sm font-semibold text-brand-navy hover:text-brand-blue transition-colors py-1"
              >
                {t('nav.features')}
              </a>
              <a
                href="#resources"
                onClick={(e) => handleNavClick(e, 'resources')}
                className="text-sm font-semibold text-brand-navy hover:text-brand-blue transition-colors py-1"
              >
                {t('nav.resources')}
              </a>
              <a
                href="#about"
                onClick={(e) => handleNavClick(e, 'about')}
                className="text-sm font-semibold text-brand-navy hover:text-brand-blue transition-colors py-1"
              >
                {t('nav.about')}
              </a>
            </nav>

            {/* Right: Language Selector, Sign In, Get Started */}
            <div className="hidden lg:flex items-center gap-3">
              {/* Voice Citizen Assistant Header Button */}
              <button
                type="button"
                onClick={() => setVoiceAssistantOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-xs transition-all active:scale-95 cursor-pointer"
                title={t('voice.title')}
                aria-label="Open Multilingual Voice Assistant"
              >
                <Mic className="w-3.5 h-3.5 text-white animate-pulse" />
                <span>{t('voice.title')}</span>
              </button>

              {/* Language Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                  aria-expanded={langDropdownOpen}
                  aria-label="Select interface language"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-navy hover:text-brand-blue bg-brand-bg-subtle hover:bg-brand-softblue border border-brand-border rounded-lg transition-colors focus-visible:outline-brand-blue"
                >
                  <Globe className="w-3.5 h-3.5 text-brand-slate" aria-hidden="true" />
                  <span>{currentLanguageOption.native}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-brand-slate" aria-hidden="true" />
                </button>

                {langDropdownOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-brand-border rounded-xl shadow-lg py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1 text-[10px] font-bold text-brand-slate uppercase tracking-wider border-b border-brand-border">
                      {t('nav.selectLanguage')}
                    </div>
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setLanguage(lang.code);
                          setLangDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-brand-softblue transition-colors ${
                          language === lang.code
                            ? 'font-bold text-brand-blue bg-brand-softblue/60'
                            : 'text-brand-navy'
                        }`}
                      >
                        <span>{lang.native}</span>
                        <span className="text-[11px] text-brand-slate">{lang.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Authenticated citizen profile button vs Sign In / Get Started */}
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2">
                  <Link
                    href="/app"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue-hover rounded-lg shadow-xs transition-colors"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>{t('nav.dashboard')}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => openAuthNotice('profile')}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-brand-navy bg-brand-softblue hover:bg-blue-100 border border-brand-softblue-border rounded-lg transition-colors focus-visible:outline-brand-blue shadow-2xs"
                    aria-label="View citizen account and profile"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" aria-hidden="true" />
                    <span className="max-w-[110px] truncate">
                      {profile?.display_name || user.email?.split('@')[0]}
                    </span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Sign In Button */}
                  <button
                    type="button"
                    onClick={() => openAuthNotice('signin')}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-brand-navy hover:text-brand-blue hover:bg-brand-softblue rounded-lg transition-colors focus-visible:outline-brand-blue"
                  >
                    <LogIn className="w-4 h-4 text-brand-slate" aria-hidden="true" />
                    <span>{t('nav.signIn')}</span>
                  </button>

                  {/* Get Started Button */}
                  <button
                    type="button"
                    onClick={() => openAuthNotice('signup')}
                    className="flex items-center gap-1.5 px-4.5 py-2 text-sm font-semibold text-white bg-brand-blue hover:bg-brand-blue-hover active:bg-brand-navy-light rounded-lg shadow-xs transition-colors focus-visible:outline-brand-blue"
                  >
                    <User className="w-4 h-4" aria-hidden="true" />
                    <span>{t('nav.getStarted')}</span>
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Hamburger */}
            <div className="flex lg:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={mobileMenuOpen}
                className="p-2 text-brand-navy hover:text-brand-blue hover:bg-brand-softblue rounded-lg focus-visible:outline-brand-blue"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-brand-border bg-white px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-150">
            <nav className="flex flex-col space-y-1">
              <a
                href="#home"
                onClick={(e) => handleNavClick(e, 'home')}
                className="px-3 py-2 text-sm font-bold text-brand-navy hover:bg-brand-softblue rounded-lg"
              >
                Home
              </a>
              <a
                href="#how-it-works"
                onClick={(e) => handleNavClick(e, 'how-it-works')}
                className="px-3 py-2 text-sm font-bold text-brand-navy hover:bg-brand-softblue rounded-lg"
              >
                How It Works
              </a>
              <a
                href="#schemes"
                onClick={(e) => handleNavClick(e, 'schemes')}
                className="px-3 py-2 text-sm font-bold text-brand-navy hover:bg-brand-softblue rounded-lg"
              >
                Schemes
              </a>
              <a
                href="#features"
                onClick={(e) => handleNavClick(e, 'features')}
                className="px-3 py-2 text-sm font-bold text-brand-navy hover:bg-brand-softblue rounded-lg"
              >
                Features
              </a>
              <a
                href="#resources"
                onClick={(e) => handleNavClick(e, 'resources')}
                className="px-3 py-2 text-sm font-bold text-brand-navy hover:bg-brand-softblue rounded-lg"
              >
                Resources
              </a>
              <a
                href="#about"
                onClick={(e) => handleNavClick(e, 'about')}
                className="px-3 py-2 text-sm font-bold text-brand-navy hover:bg-brand-softblue rounded-lg"
              >
                About
              </a>
            </nav>

            <div className="pt-3 border-t border-brand-border space-y-2.5">
              <div className="flex items-center justify-between px-3 py-2 bg-brand-bg-subtle rounded-lg border border-brand-border">
                <span className="text-xs font-semibold text-brand-slate flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  {t('nav.selectLanguage')}:
                </span>
                <select
                  aria-label="Mobile interface language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="text-xs font-bold text-brand-navy bg-white border border-brand-border rounded px-2 py-1"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.native} ({l.name})
                    </option>
                  ))}
                </select>
              </div>

              {isAuthenticated && user ? (
                <div className="space-y-2">
                  <Link
                    href="/app"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2.5 px-3 text-sm font-bold text-white bg-brand-blue rounded-lg shadow-xs flex items-center justify-center gap-2"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>{t('nav.dashboard')}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthNotice('profile');
                    }}
                    className="w-full text-center py-2 px-3 text-xs font-semibold text-brand-blue bg-brand-softblue rounded-lg border border-brand-softblue-border flex items-center justify-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>My Profile ({profile?.display_name || user.email?.split('@')[0]})</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthNotice('signin');
                    }}
                    className="w-full text-center py-2.5 px-3 text-sm font-semibold text-brand-navy bg-brand-bg-subtle hover:bg-brand-softblue rounded-lg border border-brand-border"
                  >
                    {t('nav.signIn')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      openAuthNotice('signup');
                    }}
                    className="w-full text-center py-2.5 px-3 text-sm font-semibold text-white bg-brand-blue hover:bg-brand-blue-hover rounded-lg shadow-xs"
                  >
                    {t('nav.getStarted')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Interactive Authentication & Profile Modal */}
      {authModalState.isOpen && (
        <React.Suspense fallback={null}>
          <AuthModal
            isOpen={authModalState.isOpen}
            onClose={() => setAuthModalState({ isOpen: false, tab: 'signin' })}
            initialTab={authModalState.tab}
          />
        </React.Suspense>
      )}

      {/* Voice Assistant Modal / Drawer */}
      <VoiceAssistant
        isOpen={voiceAssistantOpen}
        onClose={() => setVoiceAssistantOpen(false)}
      />
    </>
  );
};
