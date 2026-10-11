/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Light Dashboard Layout with Horizontal Navigation
 * Implements a modern, accessible, citizen-friendly header with horizontal navigation,
 * account dropdown, mobile drawer, and #F7F9FC light surface canvas.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  History,
  Database,
  User,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ChevronDown,
  Shield,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, Link } from '../../contexts/RouterContext';
import { BrandLogo } from '../common/BrandLogo';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, profile, signOut } = useAuth();
  const { currentPath, navigate } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const navigationItems = [
    {
      name: 'Overview',
      path: '/app',
      icon: LayoutDashboard,
      description: 'Account overview and recent activity',
    },
    {
      name: 'Verify a Claim',
      path: '/app/verify',
      icon: ShieldCheck,
      description: 'Submit claims for sovereign verification',
    },
    {
      name: 'History',
      path: '/app/history',
      icon: History,
      description: 'Review saved verifications and reports',
    },
    {
      name: 'Sources & Evidence',
      path: '/app/sources',
      icon: Database,
      description: 'Audit verified government portals and gazettes',
    },
  ];

  // Close account dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setAccountMenuOpen(false);
  }, [currentPath]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const isRouteActive = (itemPath: string) => {
    if (itemPath === '/app') {
      return currentPath === '/app';
    }
    return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`);
  };

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Citizen';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-[#182230] flex flex-col antialiased selection:bg-[#EAF1FF] selection:text-[#2457C5]">
      {/* Sticky Horizontal Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E4E7EC] shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            
            {/* Left: Brand Logo */}
            <div className="flex items-center gap-6 shrink-0">
              <Link href="/app" className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-[#2457C5] rounded-lg">
                <BrandLogo size={32} showText={true} showTagline={false} />
              </Link>
              <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF1FF] border border-[#D1E9FF] text-[#2457C5] text-[11px] font-bold">
                <Shield className="w-3 h-3 text-[#2457C5]" />
                <span>Sovereign Fact Verification</span>
              </div>
            </div>

            {/* Middle: Horizontal Nav Links (Desktop) */}
            <nav className="hidden md:flex items-center gap-1 lg:gap-2" aria-label="Main Navigation">
              {navigationItems.map((item) => {
                const active = isRouteActive(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                      active
                        ? 'bg-[#EAF1FF] text-[#2457C5] shadow-xs'
                        : 'text-[#475467] hover:text-[#182230] hover:bg-[#F2F4F7]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-[#2457C5]' : 'text-[#667085]'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right: Actions, Public Link & Account Menu */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Link
                href="/"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#475467] hover:text-[#182230] hover:bg-[#F2F4F7] border border-[#E4E7EC] transition-colors"
                title="View public informational website"
              >
                <span>Public Site</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#667085]" />
              </Link>

              {/* Citizen Account Dropdown */}
              <div className="relative" ref={accountMenuRef}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  aria-expanded={accountMenuOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-2.5 p-1.5 pl-2 rounded-xl hover:bg-[#F2F4F7] border border-transparent hover:border-[#E4E7EC] transition-all focus:outline-none focus:ring-2 focus:ring-[#2457C5]"
                >
                  <div className="w-8 h-8 rounded-full bg-[#EAF1FF] border border-[#D1E9FF] text-[#2457C5] flex items-center justify-center font-bold text-xs shadow-xs">
                    {userInitial}
                  </div>
                  <div className="hidden lg:flex flex-col text-left leading-none">
                    <span className="text-xs font-bold text-[#182230] max-w-[120px] truncate">
                      {displayName}
                    </span>
                    <span className="text-[10px] text-[#667085] mt-0.5">Account</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-[#667085] hidden lg:block" />
                </button>

                {/* Account Dropdown Menu */}
                {accountMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lg border border-[#E4E7EC] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-3 border-b border-[#F2F4F7]">
                      <p className="text-xs font-bold text-[#182230] truncate">{displayName}</p>
                      <p className="text-[11px] text-[#667085] truncate mt-0.5">{user?.email || 'Authenticated Citizen'}</p>
                    </div>

                    <div className="py-1">
                      <Link
                        href="/app/profile"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#344054] hover:bg-[#F2F4F7] hover:text-[#182230]"
                      >
                        <User className="w-4 h-4 text-[#667085]" />
                        <span>Profile & Preferences</span>
                      </Link>
                      <Link
                        href="/app/verify"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#344054] hover:bg-[#F2F4F7] hover:text-[#182230]"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#667085]" />
                        <span>Verify a New Claim</span>
                      </Link>
                      <Link
                        href="/app/history"
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#344054] hover:bg-[#F2F4F7] hover:text-[#182230]"
                      >
                        <History className="w-4 h-4 text-[#667085]" />
                        <span>Saved Verifications</span>
                      </Link>
                    </div>

                    <div className="pt-1 border-t border-[#F2F4F7]">
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-[#B42318] hover:bg-[#FEF3F2] text-left transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-[#B42318]" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Hamburger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                className="md:hidden p-2 rounded-xl text-[#475467] hover:text-[#182230] hover:bg-[#F2F4F7] border border-[#E4E7EC] focus:outline-none focus:ring-2 focus:ring-[#2457C5]"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#E4E7EC] bg-white px-4 pt-3 pb-6 space-y-3 shadow-md animate-in fade-in slide-in-from-top-1">
            <div className="space-y-1">
              {navigationItems.map((item) => {
                const active = isRouteActive(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      active
                        ? 'bg-[#EAF1FF] text-[#2457C5]'
                        : 'text-[#475467] hover:text-[#182230] hover:bg-[#F2F4F7]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-[#2457C5]' : 'text-[#667085]'}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#F2F4F7] space-y-1">
              <Link
                href="/app/profile"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-[#475467] hover:text-[#182230] hover:bg-[#F2F4F7]"
              >
                <User className="w-4 h-4 text-[#667085]" />
                <span>Profile & Settings</span>
              </Link>
              <Link
                href="/"
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-[#475467] hover:text-[#182230] hover:bg-[#F2F4F7]"
              >
                <ExternalLink className="w-4 h-4 text-[#667085]" />
                <span>Public Marketing Site</span>
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-[#B42318] hover:bg-[#FEF3F2] text-left transition-colors"
              >
                <LogOut className="w-4 h-4 text-[#B42318]" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>

      {/* Clean Light Footer */}
      <footer className="mt-auto border-t border-[#E4E7EC] bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#667085]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#182230]">GovVerify AI</span>
            <span>—</span>
            <span>Sovereign Government Verification & Fact Analysis</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Powered by Tavily & Google Gemini</span>
            <span>•</span>
            <Link href="/" className="hover:text-[#2457C5] transition-colors">
              Landing Page
            </Link>
            <span>•</span>
            <Link href="/app/profile" className="hover:text-[#2457C5] transition-colors">
              Citizen Settings
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
