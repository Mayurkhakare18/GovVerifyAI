/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Landmark,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Filter,
  RefreshCw,
  Loader2,
  MapPin,
  HelpCircle,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { SchemeItem, schemeApi } from '../../services/api/schemes';
import { SchemeDetailModal } from './SchemeDetailModal';

interface SchemeDiscoverySectionProps {
  onSelectSchemeClaim?: (claimText: string) => void;
}

const POPULAR_SEARCH_SUGGESTIONS = [
  'Scholarships for college students',
  'Financial assistance for farmers',
  'Maharashtra farmer solar pump',
  'Government support for women entrepreneurs',
  'Healthcare & hospital coverage',
  'Street vendor business loan',
];

const CATEGORIES = [
  'All Categories',
  'Agriculture',
  'Scholarships & Education',
  'Healthcare',
  'Small Business & MSME',
  'Housing',
  'Welfare Benefits',
];

export const SchemeDiscoverySection: React.FC<SchemeDiscoverySectionProps> = ({
  onSelectSchemeClaim,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<'ALL' | 'CENTRAL' | 'STATE'>('ALL');
  const [selectedState, setSelectedState] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [similarSchemes, setSimilarSchemes] = useState<SchemeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedSummary, setParsedSummary] = useState<string | null>(null);

  // Selected scheme for detail modal
  const [activeModalScheme, setActiveModalScheme] = useState<SchemeItem | null>(null);

  // Fetch schemes from backend API
  const fetchSchemes = async (overrideQuery?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const q = overrideQuery !== undefined ? overrideQuery : searchQuery;
      const res = await schemeApi.discoverSchemes({
        query: q.trim(),
        category: selectedCategory !== 'All Categories' ? selectedCategory : undefined,
        jurisdiction: selectedJurisdiction !== 'ALL' ? selectedJurisdiction : undefined,
        state: selectedState || undefined,
        status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      });

      setSchemes(res.schemes || []);
      setSimilarSchemes(res.similarSchemes || []);
      if (res.parsedIntent?.rawIntentSummary && q.trim()) {
        setParsedSummary(res.parsedIntent.rawIntentSummary);
      } else {
        setParsedSummary(null);
      }
    } catch (err: any) {
      setError(err.message || 'Error discovering government schemes.');
    } finally {
      setIsLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSchemes();
  }, [selectedCategory, selectedJurisdiction, selectedState, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSchemes();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchQuery(suggestion);
    if (suggestion.toLowerCase().includes('maharashtra')) {
      setSelectedJurisdiction('STATE');
      setSelectedState('Maharashtra');
    }
    fetchSchemes(suggestion);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All Categories');
    setSelectedJurisdiction('ALL');
    setSelectedState('');
    setSelectedStatus('ALL');
    setParsedSummary(null);
  };

  const handleVerifyScheme = (scheme: SchemeItem) => {
    if (onSelectSchemeClaim) {
      const claim = `Under ${scheme.shortName || scheme.schemeName}, ${scheme.benefits}`;
      onSelectSchemeClaim(claim);
    }
  };

  return (
    <section
      id="schemes"
      aria-label="Smart Government Scheme Discovery"
      className="py-16 md:py-24 bg-gradient-to-b from-brand-bg-subtle via-white to-slate-50 border-b border-brand-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Section Header */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-blue bg-white px-3 py-1 rounded-md border border-brand-softblue-border shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-brand-blue" />
            <span>Smart Sovereign Discovery</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-brand-navy tracking-tight">
            Discover Government Schemes with Confidence
          </h2>

          <p className="text-brand-slate text-sm sm:text-base leading-relaxed">
            Search central and state welfare programs using natural language. All information is
            cross-referenced with official portals ending in <code className="font-mono text-brand-navy">.gov.in</code> and <code className="font-mono text-brand-navy">.nic.in</code>.
          </p>
        </div>

        {/* Natural Language Search Bar */}
        <div className="bg-white rounded-2xl shadow-xl shadow-brand-navy/5 border border-brand-border p-4 sm:p-5 space-y-4">
          <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-brand-slate absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Describe what you are looking for (e.g. 'Scholarship for college students', 'Maharashtra solar pump subsidy')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-brand-border bg-brand-bg-subtle/50 text-xs sm:text-sm text-brand-navy placeholder:text-brand-slate focus:bg-white focus:border-brand-blue focus:outline-none transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-3 rounded-xl bg-brand-blue hover:bg-brand-blue-hover text-white text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Discovering...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Search Schemes</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-brand-border/60">
            <span className="text-[11px] font-bold text-brand-slate uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Popular:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_SEARCH_SUGGESTIONS.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSuggestionClick(sug)}
                  className="px-2.5 py-1 rounded-lg bg-brand-bg-subtle hover:bg-brand-softblue hover:text-brand-blue border border-brand-border/70 text-[11px] font-medium text-brand-slate transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Jurisdiction Filter */}
              <div className="inline-flex rounded-lg border border-brand-border p-0.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJurisdiction('ALL');
                    setSelectedState('');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    selectedJurisdiction === 'ALL'
                      ? 'bg-white text-brand-blue shadow-2xs'
                      : 'text-brand-slate hover:text-brand-navy'
                  }`}
                >
                  All India
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJurisdiction('CENTRAL');
                    setSelectedState('');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                    selectedJurisdiction === 'CENTRAL'
                      ? 'bg-white text-brand-blue shadow-2xs'
                      : 'text-brand-slate hover:text-brand-navy'
                  }`}
                >
                  Central Only
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedJurisdiction('STATE');
                    setSelectedState('Maharashtra');
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors flex items-center gap-1 ${
                    selectedJurisdiction === 'STATE' && selectedState === 'Maharashtra'
                      ? 'bg-white text-brand-blue shadow-2xs'
                      : 'text-brand-slate hover:text-brand-navy'
                  }`}
                >
                  <MapPin className="w-3 h-3 text-brand-blue" />
                  <span>Maharashtra</span>
                </button>
              </div>

              {/* Category Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-brand-border bg-white text-xs font-semibold text-brand-navy focus:border-brand-blue focus:outline-none"
              >
                {CATEGORIES.map((cat, i) => (
                  <option key={i} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              {/* Status Dropdown */}
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-brand-border bg-white text-xs font-semibold text-brand-navy focus:border-brand-blue focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="CLOSED">Closed / Expired</option>
                <option value="DISCONTINUED">Discontinued</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs font-semibold text-brand-slate hover:text-brand-navy flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>

        {/* Parsed Intent Notice */}
        {parsedSummary && (
          <div className="p-3 rounded-xl bg-brand-softblue/70 border border-brand-softblue-border flex items-center gap-2 text-xs text-brand-navy animate-in fade-in">
            <Sparkles className="w-4 h-4 text-brand-blue shrink-0" />
            <span>
              <strong>Parsed Search Intent:</strong> {parsedSummary}
            </span>
          </div>
        )}

        {/* Error Notice */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Schemes Results Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-brand-slate">
            <span>
              Showing <strong className="text-brand-navy">{schemes.length}</strong> verified sovereign schemes
            </span>
            <span className="text-[11px] font-mono">
              Sovereign Repositories: myscheme.gov.in · mahadbt.maharashtra.gov.in · pib.gov.in
            </span>
          </div>

          {schemes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {schemes.map((scheme) => (
                <div
                  key={scheme.id}
                  className="bg-white rounded-2xl border border-brand-border p-5 flex flex-col justify-between hover:border-brand-blue hover:shadow-md transition-all duration-200 group"
                >
                  <div className="space-y-3.5">
                    {/* Top Row: Status & Jurisdiction */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                          scheme.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : scheme.status === 'UPCOMING'
                            ? 'bg-blue-100 text-blue-800'
                            : scheme.status === 'CLOSED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {scheme.status}
                      </span>

                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-brand-slate border border-slate-200">
                        {scheme.jurisdiction === 'CENTRAL' ? 'Central' : `State: ${scheme.state || 'State'}`}
                      </span>
                    </div>

                    {/* Scheme Name & Ministry */}
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-blue mb-0.5">
                        {scheme.category}
                      </div>
                      <h3 className="text-base font-bold text-brand-navy group-hover:text-brand-blue transition-colors leading-snug">
                        {scheme.schemeName}
                      </h3>
                      <div className="text-[11px] text-brand-slate flex items-center gap-1 mt-1 font-medium truncate">
                        <Landmark className="w-3 h-3 text-brand-blue shrink-0" />
                        <span className="truncate">{scheme.administeringMinistry}</span>
                      </div>
                    </div>

                    {/* Description Excerpt */}
                    <p className="text-xs text-brand-slate line-clamp-2 leading-relaxed">
                      {scheme.description}
                    </p>

                    {/* Benefits Highlight Box */}
                    <div className="p-3 rounded-xl bg-brand-bg-subtle border border-brand-border/60 text-xs text-brand-navy space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-slate block">
                        Verified Benefit:
                      </span>
                      <p className="font-semibold text-[11px] text-emerald-800 line-clamp-2">
                        {scheme.benefits}
                      </p>
                    </div>

                    {/* Key Eligibility Summary */}
                    {scheme.eligibilityConditions.length > 0 && (
                      <div className="text-[11px] text-brand-slate space-y-1">
                        <span className="font-bold text-brand-navy block">Eligibility Criteria:</span>
                        <p className="line-clamp-2 italic">
                          · {scheme.eligibilityConditions[0]}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-4 mt-4 border-t border-brand-border space-y-2">
                    <button
                      type="button"
                      onClick={() => setActiveModalScheme(scheme)}
                      className="w-full py-2 px-3 rounded-lg bg-brand-softblue hover:bg-brand-softblue-border text-brand-blue text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>View Guidelines & Roadmap</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <button
                        type="button"
                        onClick={() => handleVerifyScheme(scheme)}
                        className="text-brand-blue hover:text-brand-blue-hover font-semibold flex items-center gap-1"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        <span>Verify Claim</span>
                      </button>

                      <a
                        href={scheme.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-slate hover:text-brand-navy font-medium flex items-center gap-1"
                      >
                        <span>Official Portal</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="p-12 text-center rounded-2xl border border-brand-border bg-white space-y-3">
              <div className="w-12 h-12 rounded-full bg-brand-softblue text-brand-blue flex items-center justify-center mx-auto">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-brand-navy">
                No matching sovereign schemes found
              </h3>
              <p className="text-xs sm:text-sm text-brand-slate max-w-md mx-auto">
                We could not find an official government scheme matching your exact criteria. Try broadening your search or resetting filters.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-brand-blue text-white text-xs font-bold shadow-2xs hover:bg-brand-blue-hover transition-colors"
              >
                Reset Search Filters
              </button>
            </div>
          )}
        </div>

        {/* Similar Schemes Recommendation Section if any */}
        {similarSchemes.length > 0 && (
          <div className="p-5 rounded-2xl border border-brand-border bg-white space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h4 className="text-sm font-bold text-brand-navy">
                Related Government Programs
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {similarSchemes.map((sim) => (
                <div
                  key={sim.id}
                  onClick={() => setActiveModalScheme(sim)}
                  className="p-3 rounded-xl border border-brand-border bg-brand-bg-subtle/50 hover:bg-brand-softblue/40 cursor-pointer transition-colors space-y-1"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                    {sim.category}
                  </span>
                  <div className="text-xs font-bold text-brand-navy truncate">
                    {sim.schemeName}
                  </div>
                  <div className="text-[11px] text-brand-slate truncate">
                    {sim.administeringMinistry}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sovereign Source Hierarchy Notice */}
        <div className="p-4 rounded-xl border border-brand-border bg-white/70 text-xs text-brand-slate space-y-1 text-center">
          <span className="font-bold text-brand-navy">
            Authoritative Discovery Guarantee:
          </span>
          <p className="text-[11px] text-brand-slate max-w-2xl mx-auto">
            GovVerify AI aggregates directly from central and state government repositories (.gov.in, .nic.in, maharashtra.gov.in). We never accept third-party aggregators or unofficial blogs as scheme verification sources.
          </p>
        </div>
      </div>

      {/* Scheme Detail & Roadmap Modal */}
      <SchemeDetailModal
        scheme={activeModalScheme}
        isOpen={activeModalScheme !== null}
        onClose={() => setActiveModalScheme(null)}
        onVerifyClaim={onSelectSchemeClaim}
        onSelectScheme={async (schemeId) => {
          const match =
            schemes.find((s) => s.id === schemeId) ||
            similarSchemes.find((s) => s.id === schemeId);
          if (match) {
            setActiveModalScheme(match);
          } else {
            try {
              const fetched = await schemeApi.getSchemeDetails(schemeId);
              setActiveModalScheme(fetched);
            } catch {
              // Ignore
            }
          }
        }}
      />
    </section>
  );
};
