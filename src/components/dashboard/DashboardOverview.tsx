/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Light Dashboard Overview
 * Displays live account statistics, recent audits, citizen-friendly verdicts,
 * and a prominent "Verify with GovVerify AI" intake action.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  PlusCircle,
  RefreshCw,
  Search,
  ExternalLink,
  ChevronRight,
  Database,
  Sparkles,
  Shield,
  FileCheck2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter, Link } from '../../contexts/RouterContext';
import { getCitizenVerdict } from '../../utils/citizenVerdict';

interface VerificationRecord {
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

export const DashboardOverview: React.FC = () => {
  const { user, profile, token } = useAuth();
  const { navigate } = useRouter();

  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [quickClaim, setQuickClaim] = useState<string>('');

  const fetchDashboardData = async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/history?page=1&limit=20', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to retrieve verification activity.');
      }

      const json = await res.json();
      setRecords(json.data || []);
      setTotalCount(json.pagination?.total || 0);
    } catch (err: any) {
      setError(err.message || 'Network error fetching dashboard records.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [token]);

  // Genuine statistics derived directly from real user records
  const completedCount = records.filter((r) => r.status === 'COMPLETED').length;
  const supportedCount = records.filter(
    (r) => r.verification_results?.[0]?.verdict === 'SUPPORTED'
  ).length;
  const contradictedCount = records.filter(
    (r) => r.verification_results?.[0]?.verdict === 'CONTRADICTED'
  ).length;
  const insufficientCount = records.filter(
    (r) => r.verification_results?.[0]?.verdict === 'INSUFFICIENT_EVIDENCE'
  ).length;

  const displayName = profile?.display_name || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Citizen';

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickClaim.trim()) {
      navigate(`/app/verify?claim=${encodeURIComponent(quickClaim.trim())}`);
    } else {
      navigate('/app/verify');
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome & Hero Banner */}
      <div className="bg-white rounded-2xl border border-[#E4E7EC] p-6 sm:p-8 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF1FF] border border-[#D1E9FF] text-[#2457C5] text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-[#2457C5]" />
            <span>Sovereign Verification Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#182230] tracking-tight">
            Welcome, {displayName}
          </h1>
          <p className="text-sm text-[#667085] leading-relaxed">
            Verify statements and viral claims against official Indian government portals (.gov.in, .nic.in), official gazettes, and Press Information Bureau (PIB) fact checks.
          </p>
        </div>

        {/* Primary Action Button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <Link
            href="/app/verify"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#2457C5] hover:bg-[#1D46A6] text-white text-sm font-bold shadow-xs hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[#2457C5] focus:ring-offset-2"
          >
            <ShieldCheck className="w-4 h-4 text-white" />
            <span>Verify with GovVerify AI</span>
            <ArrowRight className="w-4 h-4 text-white/80" />
          </Link>
          <button
            type="button"
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-3 rounded-xl bg-white border border-[#E4E7EC] text-[#344054] hover:bg-[#F2F4F7] text-sm font-semibold transition-colors disabled:opacity-50"
            title="Refresh statistics"
          >
            <RefreshCw className={`w-4 h-4 text-[#667085] ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Intake Bar */}
      <div className="bg-white rounded-2xl border border-[#E4E7EC] p-4 shadow-xs">
        <form onSubmit={handleQuickSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#667085] absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Enter a claim or question to verify (e.g. Under PM-KISAN, do farmers receive Rs 6,000 annually?)..."
              value={quickClaim}
              onChange={(e) => setQuickClaim(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#F7F9FC] border border-[#E4E7EC] rounded-xl text-[#182230] placeholder-[#98A2B3] focus:outline-none focus:ring-2 focus:ring-[#2457C5] focus:bg-white transition-all"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 text-sm font-bold bg-[#2457C5] hover:bg-[#1D46A6] text-white rounded-xl transition-colors shadow-xs shrink-0"
          >
            Verify Claim
          </button>
        </form>
      </div>

      {/* Real Statistics Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Total Requests
            </span>
            <div className="text-2xl font-black text-[#182230]">{totalCount}</div>
            <p className="text-[11px] text-[#667085]">Permitted claims submitted</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#EAF1FF] text-[#2457C5] flex items-center justify-center shrink-0">
            <Database className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Completed Audits
            </span>
            <div className="text-2xl font-black text-[#182230]">{completedCount}</div>
            <p className="text-[11px] text-[#027A48]">Fully synthesized reports</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#ECFDF3] text-[#027A48] flex items-center justify-center shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Supported by Evidence
            </span>
            <div className="text-2xl font-black text-[#027A48]">{supportedCount}</div>
            <p className="text-[11px] text-[#667085]">Confirmed by gazettes</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#ECFDF3] text-[#027A48] flex items-center justify-center shrink-0">
            <FileCheck2 className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl border border-[#E4E7EC] p-5 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#667085] uppercase tracking-wider">
              Refuted / Needs Proof
            </span>
            <div className="text-2xl font-black text-[#B54708]">
              {contradictedCount + insufficientCount}
            </div>
            <p className="text-[11px] text-[#667085]">Refuted or unverified</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-[#FEF0C7] text-[#B54708] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Recent Verification Activity Card */}
      <div className="bg-white rounded-2xl border border-[#E4E7EC] shadow-xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-[#E4E7EC] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#182230]">Recent Verification Reports</h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Review recent inquiries, citizen verdicts, and grounded source records.
            </p>
          </div>

          <Link
            href="/app/history"
            className="text-xs font-bold text-[#2457C5] hover:text-[#1D46A6] flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>View Full History ({totalCount})</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Content Body */}
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[#F2F4F7] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-[#FEF3F2] text-[#B42318] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-xs text-[#B42318]">{error}</p>
            <button
              type="button"
              onClick={fetchDashboardData}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-[#E4E7EC] text-[#344054] hover:bg-[#F2F4F7]"
            >
              Retry
            </button>
          </div>
        ) : records.length === 0 ? (
          /* Proper Empty State for New Account */
          <div className="p-10 sm:p-12 text-center space-y-4 max-w-lg mx-auto">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#EAF1FF] text-[#2457C5] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[#182230]">No Verification Requests Yet</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                You haven't submitted any claims yet. Enter a statement, scheme rule, or viral message to audit it against official gazettes and portals.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2 text-left">
              <span className="text-[11px] font-bold text-[#667085] uppercase tracking-wider text-center">
                Try verifying one of these examples:
              </span>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/app/verify?claim=${encodeURIComponent(
                      'Under PM-KISAN, eligible farmers receive financial assistance of Rs 6,000 per year.'
                    )}`
                  )
                }
                className="p-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F9FC] hover:bg-[#EAF1FF] hover:border-[#D1E9FF] text-xs text-[#344054] hover:text-[#2457C5] transition-colors text-left"
              >
                🌾 "Under PM-KISAN, eligible farmers receive financial assistance of Rs 6,000 per year."
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/app/verify?claim=${encodeURIComponent(
                      'Ministry of Power announced that residential rooftop solar is completely free without registration.'
                    )}`
                  )
                }
                className="p-2.5 rounded-xl border border-[#E4E7EC] bg-[#F7F9FC] hover:bg-[#EAF1FF] hover:border-[#D1E9FF] text-xs text-[#344054] hover:text-[#2457C5] transition-colors text-left"
              >
                ⚡ "Ministry of Power announced that residential rooftop solar is completely free without registration."
              </button>
            </div>

            <div className="pt-2">
              <Link
                href="/app/verify"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#2457C5] hover:bg-[#1D46A6] rounded-xl shadow-xs transition-colors"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Start Your First Verification</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Records List Table */
          <div className="divide-y divide-[#E4E7EC]">
            {records.slice(0, 6).map((item) => {
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
                  className="p-4 sm:p-5 hover:bg-[#F7F9FC] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
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
                          <span>Processing</span>
                        </span>
                      )}

                      <span className="text-[11px] text-[#667085] flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formattedDate}</span>
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-[#182230] line-clamp-2">
                      {item.original_claim}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <Link
                      href={`/app/history/${item.id}`}
                      className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-[#E4E7EC] bg-white hover:bg-[#F2F4F7] text-[#344054] flex items-center gap-1.5 transition-colors shadow-xs"
                    >
                      <span>Open Report</span>
                      <ChevronRight className="w-3.5 h-3.5 text-[#667085]" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Citizen Trust & Methodology Card */}
      <div className="bg-[#EAF1FF] border border-[#D1E9FF] rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-white text-[#2457C5] flex items-center justify-center shrink-0 shadow-xs">
          <Shield className="w-5 h-5 text-[#2457C5]" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#182230]">How GovVerify AI Evaluates Information</h3>
          <p className="text-xs text-[#344054] leading-relaxed">
            Every verification is cross-referenced against authoritative sovereign Indian portals (.gov.in, .nic.in, Press Information Bureau) using real grounded source discovery. Candidate URLs or search summaries alone are never accepted as verified evidence. If official evidence is not available, we honestly declare it as inconclusive.
          </p>
        </div>
      </div>
    </div>
  );
};
