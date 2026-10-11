/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Light Sources & Evidence Directory
 * Displays authoritative government portals, gazettes, and grounded excerpts
 * with clear trust-quality indicators and search filtering.
 */

import React, { useState, useEffect } from 'react';
import {
  Database,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Building2,
  Calendar,
  FileText,
  Filter,
  RefreshCw,
  BadgeCheck,
  Shield,
  Info,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from '../../contexts/RouterContext';
import { getCitizenSourceTrustBadge } from '../../utils/citizenVerdict';

interface SourceItem {
  id: string;
  title: string;
  url: string;
  domain: string;
  issuing_authority?: string;
  source_type?: string;
  publication_date?: string;
  retrieved_at: string;
  created_at: string;
  evidence?: Array<{
    id: string;
    extracted_text: string;
    clause_reference?: string;
    verification_request_id?: string;
  }>;
}

export const SourcesAndEvidence: React.FC = () => {
  const { token } = useAuth();
  const [sources, setSources] = useState<SourceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [domainFilter, setDomainFilter] = useState<string>('ALL');

  const fetchSources = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: '50',
      });

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      if (domainFilter !== 'ALL') {
        params.set('domain', domainFilter);
      }

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/v1/sources?${params.toString()}`, { headers });
      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || 'Failed to fetch indexed sources.');
      }

      const json = await res.json();
      setSources(json.sources || []);
    } catch (err: any) {
      setError(err.message || 'Network error fetching sources.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [domainFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSources();
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E1E7EF]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EBF1FF] border border-[#D0E1FD] text-[#2457C5] text-xs font-bold mb-2">
            <Database className="w-3.5 h-3.5 text-[#2457C5]" />
            <span>Authoritative Source Repository</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#172B4D] tracking-tight">
            Sources & Evidence Bank
          </h1>
          <p className="text-xs sm:text-sm text-[#526176] mt-1 max-w-2xl">
            Audit indexed Indian government portals, gazettes, and retrieved text excerpts. Every grounded source is verified for official provenance.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSources}
          disabled={isLoading}
          className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-[#E1E7EF] hover:bg-[#F0F4F9] text-[#172B4D] transition-colors flex items-center gap-2 self-start sm:self-auto disabled:opacity-50 shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#526176] ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-[#E1E7EF] p-4 sm:p-5 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#526176] absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search by title, ministry (e.g. MNRE, Agriculture), or domain..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-[#F5F7FA] border border-[#E1E7EF] rounded-xl text-[#172B4D] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#2457C5] focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={domainFilter}
              onChange={(e) => setDomainFilter(e.target.value)}
              aria-label="Filter by domain pattern"
              className="px-3 py-2.5 text-xs bg-[#F5F7FA] border border-[#E1E7EF] rounded-xl text-[#172B4D] focus:outline-none focus:ring-2 focus:ring-[#2457C5] w-full sm:w-auto"
            >
              <option value="ALL">All Domains</option>
              <option value="gov.in">.gov.in (Government of India)</option>
              <option value="nic.in">.nic.in (National Informatics Centre)</option>
              <option value="pib.gov.in">pib.gov.in (Press Information Bureau)</option>
              <option value="mnre.gov.in">mnre.gov.in (Renewable Energy)</option>
              <option value="rbi.org.in">rbi.org.in (Reserve Bank)</option>
            </select>

            <button
              type="submit"
              className="px-4 py-2.5 text-xs font-bold bg-[#2457C5] hover:bg-[#1D46A6] text-white rounded-xl transition-colors shrink-0 shadow-xs"
            >
              Search
            </button>
          </div>
        </form>
      </div>

      {/* Sources Grid */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-white border border-[#E1E7EF] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 rounded-2xl bg-white border border-[#E1E7EF] text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-[#FEF3F2] text-[#B42318] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-xs text-[#B42318]">{error}</p>
            <button
              type="button"
              onClick={fetchSources}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#E1E7EF] text-[#172B4D]"
            >
              Retry
            </button>
          </div>
        ) : sources.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white border border-[#E1E7EF] text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-[#F0F4F9] flex items-center justify-center text-[#526176]">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#172B4D]">No Sources Matched</h3>
            <p className="text-xs text-[#526176] max-w-sm mx-auto">
              No authoritative sources matched your search or domain filter. Clear filters to view all indexed sources.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sources.map((src) => {
              const trustBadge = getCitizenSourceTrustBadge(src.domain, src.source_type);
              const evidenceList = src.evidence || [];

              return (
                <div
                  key={src.id}
                  className="p-5 rounded-2xl bg-white border border-[#E1E7EF] shadow-2xs flex flex-col justify-between space-y-4 hover:border-[#CBD5E1] transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${trustBadge.pillClass}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: trustBadge.dotColor }}
                          />
                          <span>{trustBadge.label}</span>
                        </span>

                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F0F4F9] text-[#526176]">
                          {src.domain}
                        </span>
                      </div>

                      {src.publication_date && (
                        <div className="text-[11px] text-[#526176] flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{src.publication_date}</span>
                        </div>
                      )}
                    </div>

                    <h3 className="text-sm font-bold text-[#172B4D] leading-snug">
                      {src.title}
                    </h3>

                    {src.issuing_authority && (
                      <div className="text-xs text-[#526176] flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-[#2457C5] shrink-0" />
                        <span className="truncate">{src.issuing_authority}</span>
                      </div>
                    )}

                    {evidenceList.length > 0 && (
                      <div className="pt-1 space-y-1.5">
                        <div className="text-[10px] font-bold text-[#526176] uppercase tracking-wider">
                          Retrieved Evidence Excerpt:
                        </div>
                        <blockquote className="text-xs text-[#172B4D] bg-[#F5F7FA] p-3 rounded-xl border border-[#E1E7EF] italic line-clamp-3">
                          "{evidenceList[0].extracted_text}"
                        </blockquote>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[#F0F4F9] flex items-center justify-between">
                    <span className="text-[10px] text-[#526176] font-mono">
                      Type: {src.source_type || 'GROUNDED_SEARCH'}
                    </span>

                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#2457C5] hover:text-[#1D46A6] font-bold inline-flex items-center gap-1 hover:underline"
                    >
                      <span>Open Official Portal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Grounding Principles Callout */}
        <div className="p-4 rounded-xl bg-white border border-[#E1E7EF] text-xs text-[#526176] space-y-1.5 shadow-2xs">
          <div className="font-bold text-[#172B4D] flex items-center gap-1.5">
            <Info className="w-4 h-4 text-[#2457C5]" />
            <span>Sovereign Source Grounding Principles</span>
          </div>
          <p className="leading-relaxed">
            GovVerify AI strictly validates source provenance. Merely having the word "government" in a title or search snippet is never treated as grounded evidence. Each source in this directory is grounded in primary sovereign Indian domains or apex regulatory institutions.
          </p>
        </div>
      </div>
    </div>
  );
};
