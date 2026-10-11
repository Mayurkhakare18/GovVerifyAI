/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Light Verification History
 * Displays citizen inquiry history with real-time text search, status filters,
 * citizen-friendly verdict badges, deletion controls, and direct report navigation.
 */

import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Clock,
  Trash2,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, Link } from '../../contexts/RouterContext';
import { getCitizenVerdict } from '../../utils/citizenVerdict';
import { fetchJsonOrThrow } from '../../utils/safeFetch';

interface HistoryRecord {
  id: string;
  original_claim: string;
  status: string;
  created_at: string;
  claims?: Array<{ id: string; claim_text: string }>;
  verification_results?: Array<{
    id: string;
    verdict: string;
    confidence: number;
    explanation: string;
  }>;
}

export const VerificationHistory: React.FC = () => {
  const { token } = useAuth();
  const { navigate } = useRouter();

  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }

      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }

      const json = await fetchJsonOrThrow<{
        data: HistoryRecord[];
        pagination: { total: number; totalPages: number };
      }>(`/api/v1/history?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let fetchedRecords: HistoryRecord[] = json.data || [];

      // Client-side verdict filter if specified
      if (verdictFilter !== 'ALL') {
        fetchedRecords = fetchedRecords.filter(
          (r) => r.verification_results?.[0]?.verdict === verdictFilter
        );
      }

      setRecords(fetchedRecords);
      setTotal(json.pagination?.total || 0);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Network error fetching history.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [page, statusFilter, verdictFilter, token]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchHistory();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this verification report from your history?')) {
      return;
    }

    setDeletingId(id);
    try {
      await fetchJsonOrThrow(`/api/v1/history/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Remove from list
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E4E7EC]">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF1FF] border border-[#D1E9FF] text-[#2457C5] text-xs font-bold mb-2">
            <History className="w-3.5 h-3.5 text-[#2457C5]" />
            <span>Audited Records Archive</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#182230] tracking-tight">
            Verification History
          </h1>
          <p className="text-xs sm:text-sm text-[#667085] mt-1 max-w-2xl">
            Access previous citizen audits, review evidence citations, or reopen individual reports.
          </p>
        </div>

        <Link
          href="/app/verify"
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-[#2457C5] hover:bg-[#1D46A6] rounded-xl shadow-xs transition-colors self-start sm:self-auto shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Verify a New Claim</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-[#E4E7EC] p-4 sm:p-5 shadow-xs space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row items-center gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Search history by claim keywords, scheme name, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-xs sm:text-sm bg-[#F7F9FC] border border-[#E4E7EC] rounded-xl text-[#182230] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#2457C5] focus:bg-white transition-all"
            />
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by verification status"
              className="px-3 py-2.5 text-xs bg-[#F7F9FC] border border-[#E4E7EC] rounded-xl text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#2457C5]"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PROCESSING">Processing</option>
              <option value="QUEUED">Queued</option>
              <option value="FAILED">Failed / Needs Retry</option>
            </select>

            {/* Citizen Verdict Filter */}
            <select
              value={verdictFilter}
              onChange={(e) => {
                setVerdictFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by finding"
              className="px-3 py-2.5 text-xs bg-[#F7F9FC] border border-[#E4E7EC] rounded-xl text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#2457C5]"
            >
              <option value="ALL">All Findings</option>
              <option value="SUPPORTED">Supported by evidence</option>
              <option value="PARTIALLY_SUPPORTED">Partly true</option>
              <option value="CONTRADICTED">Contradicts claim</option>
              <option value="INSUFFICIENT_EVIDENCE">Not enough evidence</option>
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

      {/* History Data Table Card */}
      <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-20 bg-[#F2F4F7] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-[#FEF3F2] text-[#B42318] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-xs text-[#B42318]">{error}</p>
            <button
              type="button"
              onClick={fetchHistory}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#E4E7EC] text-[#344054] hover:bg-[#F2F4F7]"
            >
              Retry
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="p-12 text-center space-y-3 max-w-sm mx-auto">
            <div className="w-12 h-12 mx-auto rounded-xl bg-[#F2F4F7] flex items-center justify-center text-[#667085]">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#182230]">No Reports Found</h3>
            <p className="text-xs text-[#667085]">
              No verification records match your active search filter. Clear filters or verify a new claim.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E4E7EC]">
            {records.map((item) => {
              const res = item.verification_results?.[0];
              const citizenVerdict = res ? getCitizenVerdict(res.verdict) : null;
              const formattedDate = new Date(item.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              return (
                <div
                  key={item.id}
                  className="p-5 hover:bg-[#F7F9FC] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
                  onClick={() => navigate(`/app/history/${item.id}`)}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {citizenVerdict ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${citizenVerdict.pillClass}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: citizenVerdict.dotColor }}
                          />
                          <span>{citizenVerdict.label}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#F2F4F7] text-[#475467] border border-[#EAECF0]">
                          <Clock className="w-3 h-3" />
                          <span>{item.status}</span>
                        </span>
                      )}

                      <span className="text-[11px] text-[#667085] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-[#182230] line-clamp-2">
                      {item.original_claim}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/app/history/${item.id}`}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-white hover:bg-[#F2F4F7] text-[#344054] border border-[#E4E7EC] flex items-center gap-1 transition-colors shadow-xs"
                    >
                      <span>Open Report</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#667085]" />
                    </Link>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(item.id, e)}
                      disabled={deletingId === item.id}
                      className="p-1.5 rounded-lg text-[#667085] hover:text-[#B42318] hover:bg-[#FEF3F2] border border-transparent hover:border-[#FECDCA] transition-colors"
                      title="Delete record from your history"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-[#E4E7EC] bg-[#F7F9FC] flex items-center justify-between">
            <span className="text-xs text-[#667085]">
              Showing page {page} of {totalPages} ({total} total records)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#E4E7EC] text-[#344054] hover:bg-[#F2F4F7] disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#E4E7EC] text-[#344054] hover:bg-[#F2F4F7] disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
