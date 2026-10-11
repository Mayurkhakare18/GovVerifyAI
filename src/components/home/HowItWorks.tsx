import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Search,
  Scale,
  CheckCircle2,
  Info,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  ExternalLink,
  ShieldAlert,
  Check,
  X,
  FileCheck2,
  Database,
  Building2,
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface StageData {
  id: number;
  number: string;
  title: string;
  shortLabel: string;
  description: string;
  subtext: string;
  icon: React.ElementType;
  tag: string;
}

export const HowItWorks: React.FC = () => {
  const [activeStage, setActiveStage] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [cycleProgress, setCycleProgress] = useState<number>(0);
  const [verdictDemoIndex, setVerdictDemoIndex] = useState<number>(0);

  const stageDurationMs = 4500;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stages: StageData[] = [
    {
      id: 0,
      number: '01',
      title: 'Enter a Claim',
      shortLabel: 'Ingest & Parse',
      description:
        'Submit a public claim, paste a circulating WhatsApp/social message, or upload an official circular PDF for analysis.',
      subtext: 'Sanitizes inputs, extracts core assertions, and formats structured query parameters.',
      icon: FileText,
      tag: 'Input Ingestion',
    },
    {
      id: 1,
      number: '02',
      title: 'Find Authoritative Sources',
      shortLabel: 'Source Retrieval',
      description:
        'The retrieval engine queries sovereign repositories: Gazette of India, PIB releases, and .gov.in ministry portals.',
      subtext: 'Strictly excludes unverified blogs, promotional websites, and speculative social media threads.',
      icon: Search,
      tag: 'Sovereign Repositories',
    },
    {
      id: 2,
      number: '03',
      title: 'Compare the Evidence',
      shortLabel: 'Evidence Cross-Check',
      description:
        'The system deconstructs the claim into atomic assertions and cross-checks each directly against retrieved official clauses.',
      subtext: 'Distinguishes genuine evidentiary support, numeric discrepancies, and fraudulent links.',
      icon: Scale,
      tag: 'Clause Decomposition',
    },
    {
      id: 3,
      number: '04',
      title: 'Review the Verdict',
      shortLabel: 'Auditable Report',
      description:
        'Receive an explainable outcome (Supported, Partially Supported, Contradicted, or Insufficient Evidence) with citations.',
      subtext: 'Includes circular reference numbers, publication dates, and sovereign gazette URLs.',
      icon: CheckCircle2,
      tag: 'Transparent Verdict',
    },
  ];

  // Demo verdicts for Stage 4 demonstration
  const verdictOptions = [
    {
      label: 'CONTRADICTED',
      sublabel: 'Notice contains fabricated subsidy figures',
      color: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeColor: 'bg-rose-600 text-white',
      icon: X,
      source: 'Gazette DL-E-08032024-21943 (Clause 4.2)',
    },
    {
      label: 'SUPPORTED',
      sublabel: 'Fully matches official Ministry notification',
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeColor: 'bg-emerald-600 text-white',
      icon: Check,
      source: 'PIB Press Release Delhi ID: 2018821',
    },
    {
      label: 'PARTIALLY SUPPORTED',
      sublabel: 'Scheme exists, but dates or amounts differ',
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeColor: 'bg-amber-600 text-white',
      icon: Info,
      source: 'MoHUA Circular No. 19/2024-AMRUT',
    },
    {
      label: 'INSUFFICIENT EVIDENCE',
      sublabel: 'No sovereign record found; verification pending',
      color: 'bg-slate-100 text-slate-700 border-slate-200',
      badgeColor: 'bg-slate-600 text-white',
      icon: Search,
      source: 'Pending Sovereign Archive Indexing',
    },
  ];

  // Continuous pipeline animation timer
  useEffect(() => {
    if (!isPlaying) return;

    const intervalStep = 50;
    const increment = (intervalStep / stageDurationMs) * 100;

    progressTimerRef.current = setInterval(() => {
      setCycleProgress((prev) => {
        if (prev >= 100) {
          setActiveStage((current) => (current + 1) % stages.length);
          return 0;
        }
        return prev + increment;
      });
    }, intervalStep);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying, stages.length]);

  const handleStageSelect = (index: number) => {
    setActiveStage(index);
    setCycleProgress(0);
  };

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleReset = () => {
    setActiveStage(0);
    setCycleProgress(0);
    setIsPlaying(true);
  };

  return (
    <section
      id="how-it-works"
      aria-label="How GovVerify AI Works: Verification Pipeline"
      className="py-16 md:py-24 bg-white border-b border-brand-border relative overflow-hidden"
    >
      {/* Decorative background grid pattern for technical credibility */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none bg-[radial-gradient(#10264A_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-brand-blue bg-brand-softblue px-3 py-1.5 rounded-md border border-brand-softblue-border shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-brand-blue animate-pulse" aria-hidden="true" />
            <span>Continuous Verification Pipeline</span>
          </div>

          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-brand-navy tracking-tight">
            How GovVerify AI Evaluates Information
          </h2>

          <p className="text-brand-slate text-sm sm:text-base leading-relaxed">
            An auditable, four-stage analytical pipeline that ingests public claims, queries sovereign digital gazettes, decomposes assertions against official clauses, and generates evidence-backed outcomes.
          </p>
        </div>

        {/* Pipeline Control Toolbar */}
        <div className="mb-8 p-3.5 bg-brand-bg-subtle rounded-xl border border-brand-border flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTogglePlay}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-brand-navy text-xs font-semibold rounded-lg border border-brand-border shadow-2xs transition-all"
              aria-label={isPlaying ? 'Pause pipeline animation' : 'Play pipeline animation'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-brand-blue fill-brand-blue" aria-hidden="true" />
                  <span>Pause Flow</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-brand-green fill-brand-green" aria-hidden="true" />
                  <span>Resume Flow</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-brand-slate text-xs font-medium rounded-lg border border-brand-border shadow-2xs transition-all"
              title="Reset to Stage 01"
              aria-label="Reset to Stage 01"
            >
              <RotateCcw className="w-3.5 h-3.5 text-brand-slate-light" aria-hidden="true" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <div className="h-4 w-px bg-brand-border mx-1" aria-hidden="true" />

            <div className="flex items-center gap-1 text-[11px] font-medium text-brand-slate">
              <span className="text-brand-slate-light">Live Status:</span>
              <span className="font-semibold text-brand-blue">
                Stage {stages[activeStage].number} ({stages[activeStage].shortLabel})
              </span>
            </div>
          </div>

          {/* Quick Stage Jump Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {stages.map((stage, idx) => {
              const isSelected = activeStage === idx;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => handleStageSelect(idx)}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-brand-blue text-white shadow-2xs'
                      : 'bg-white text-brand-slate hover:text-brand-navy border border-brand-border'
                  }`}
                  aria-pressed={isSelected}
                  aria-label={`Jump to stage ${stage.number}: ${stage.title}`}
                >
                  <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-brand-slate-light'}`}>
                    {stage.number}
                  </span>
                  <span>{stage.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* DESKTOP PIPELINE FLOWCHART (Horizontal Connected View)     */}
        {/* ======================================================== */}
        <div className="hidden lg:block relative mb-12">
          {/* Continuous SVG Flow Conduit connecting all 4 stages */}
          <div className="relative w-full mb-8 pt-4">
            <svg
              className="w-full h-12 overflow-visible"
              viewBox="0 0 1000 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              {/* Background Conduit Pipe */}
              <path
                d="M 125 24 L 875 24"
                stroke="#E4E7EC"
                strokeWidth="4"
                strokeLinecap="round"
              />

              {/* Animated Dashed Flow Line */}
              <path
                d="M 125 24 L 875 24"
                stroke="#93C5FD"
                strokeWidth="3"
                strokeDasharray="6 6"
                className="animate-pipeline-flow"
              />

              {/* Progress Highlight Line from start to current active stage */}
              <path
                d={`M 125 24 L ${
                  125 + (activeStage + cycleProgress / 100) * 250 > 875
                    ? 875
                    : 125 + (activeStage + cycleProgress / 100) * 250
                } 24`}
                stroke="#175CD3"
                strokeWidth="4"
                strokeLinecap="round"
                className="transition-all duration-100"
              />

              {/* Stage Junction Nodes (01, 02, 03, 04) */}
              {[125, 375, 625, 875].map((cx, idx) => {
                const isActive = activeStage === idx;
                const isPassed = activeStage > idx;

                return (
                  <g key={idx} className="cursor-pointer" onClick={() => handleStageSelect(idx)}>
                    {/* Outer halo for active stage */}
                    {isActive && (
                      <circle
                        cx={cx}
                        cy="24"
                        r="18"
                        fill="#EFF6FF"
                        stroke="#93C5FD"
                        strokeWidth="1.5"
                        className="animate-pulse"
                      />
                    )}

                    {/* Node Core Circle */}
                    <circle
                      cx={cx}
                      cy="24"
                      r="12"
                      fill={isActive ? '#175CD3' : isPassed ? '#159B62' : '#FFFFFF'}
                      stroke={isActive ? '#175CD3' : isPassed ? '#159B62' : '#CBD5E1'}
                      strokeWidth="2.5"
                    />

                    {/* Inner Node Indicator */}
                    {isPassed ? (
                      <path
                        d={`M ${cx - 4} 24 L ${cx - 1} 27 L ${cx + 5} 21`}
                        stroke="#FFFFFF"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : (
                      <circle
                        cx={cx}
                        cy="24"
                        r="3.5"
                        fill={isActive ? '#FFFFFF' : '#94A3B8'}
                      />
                    )}
                  </g>
                );
              })}

              {/* Traveling Glowing Data Packet */}
              {isPlaying && (
                <g
                  transform={`translate(${
                    125 + (activeStage + cycleProgress / 100) * 250 > 875
                      ? 875
                      : 125 + (activeStage + cycleProgress / 100) * 250
                  }, 24)`}
                >
                  <circle r="7" fill="#175CD3" className="animate-ping opacity-60" />
                  <circle r="5" fill="#2563EB" stroke="#FFFFFF" strokeWidth="1.5" />
                </g>
              )}
            </svg>

            {/* Stage Junction Labels directly below nodes */}
            <div className="grid grid-cols-4 text-center mt-1">
              {stages.map((stage, idx) => (
                <div
                  key={stage.id}
                  onClick={() => handleStageSelect(idx)}
                  className="cursor-pointer px-2"
                >
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider block transition-colors ${
                      activeStage === idx
                        ? 'text-brand-blue'
                        : activeStage > idx
                        ? 'text-brand-green'
                        : 'text-brand-slate-light'
                    }`}
                  >
                    Stage {stage.number}
                  </span>
                  <span
                    className={`text-xs font-semibold block transition-colors ${
                      activeStage === idx ? 'text-brand-navy font-bold' : 'text-brand-slate'
                    }`}
                  >
                    {stage.shortLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 4 Connected Interactive Stage Cards */}
          <div className="grid grid-cols-4 gap-5">
            {stages.map((stage, idx) => {
              const Icon = stage.icon;
              const isActive = activeStage === idx;
              const isPassed = activeStage > idx;

              return (
                <div
                  key={stage.id}
                  onClick={() => handleStageSelect(idx)}
                  className={`relative cursor-pointer rounded-xl border p-5 flex flex-col justify-between transition-all duration-300 ${
                    isActive
                      ? 'bg-white border-brand-blue shadow-md ring-2 ring-brand-blue/15 scale-[1.01]'
                      : isPassed
                      ? 'bg-slate-50/70 border-brand-border hover:border-brand-softblue-border hover:bg-white'
                      : 'bg-white border-brand-border hover:border-slate-300 opacity-90'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleStageSelect(idx);
                    }
                  }}
                  aria-label={`Inspect Stage ${stage.number}: ${stage.title}`}
                >
                  {/* Top Bar: Icon + Stage Tag */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div
                        className={`w-11 h-11 rounded-lg flex items-center justify-center border transition-all ${
                          isActive
                            ? 'bg-brand-blue text-white border-brand-blue shadow-xs'
                            : isPassed
                            ? 'bg-emerald-50 text-brand-green border-emerald-200'
                            : 'bg-brand-softblue text-brand-blue border-brand-softblue-border'
                        }`}
                      >
                        <Icon className="w-5 h-5 stroke-[2.2]" aria-hidden="true" />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-xs font-bold font-mono px-2 py-0.5 rounded border ${
                            isActive
                              ? 'bg-brand-softblue text-brand-blue border-brand-softblue-border'
                              : 'bg-slate-100 text-brand-slate-light border-slate-200'
                          }`}
                        >
                          {stage.number}
                        </span>
                        {isActive && (
                          <span className="w-2 h-2 rounded-full bg-brand-blue animate-ping" />
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-slate-light">
                        {stage.tag}
                      </div>
                      <h3
                        className={`text-base font-bold transition-colors ${
                          isActive ? 'text-brand-blue' : 'text-brand-navy'
                        }`}
                      >
                        {stage.title}
                      </h3>
                    </div>

                    <p className="text-xs text-brand-slate leading-relaxed mb-4">
                      {stage.description}
                    </p>

                    {/* MICRO-VISUALIZATION COMPONENT SPECIFIC TO EACH STAGE */}
                    <div className="mb-4 rounded-lg bg-brand-bg-subtle p-3 border border-brand-border text-left">
                      {idx === 0 && (
                        /* Stage 1 Visual: Raw Claim Extraction */
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-semibold text-brand-slate-light">
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3 text-brand-blue" />
                              Incoming Claim Payload
                            </span>
                            <span className="text-brand-blue font-mono">#CLM-8092</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-brand-border text-[11px] text-brand-navy font-mono line-clamp-2 leading-tight">
                            "Under PM-KUSUM 2025, 90% upfront solar pump subsidy released via WhatsApp link."
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-brand-slate-light">
                            <span className="px-1.5 py-0.5 bg-blue-50 text-brand-blue rounded border border-blue-100 font-semibold">
                              Context: Subsidies
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-100 text-brand-slate rounded border border-slate-200">
                              Format: Text / PDF
                            </span>
                          </div>
                        </div>
                      )}

                      {idx === 1 && (
                        /* Stage 2 Visual: Sovereign Repository Scanning */
                        <div className="space-y-1.5 relative overflow-hidden">
                          {isActive && (
                            <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-brand-blue to-transparent animate-scan-beam pointer-events-none" />
                          )}
                          <div className="text-[10px] font-semibold text-brand-slate-light flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Database className="w-3 h-3 text-brand-blue" />
                              Sovereign Registries
                            </span>
                            <span className="text-emerald-700 font-mono text-[9px] font-bold">● 3 Queried</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between p-1 bg-white rounded border border-brand-border text-[10px]">
                              <span className="font-semibold text-brand-navy truncate">egazette.gov.in</span>
                              <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-medium">Extraordinary</span>
                            </div>
                            <div className="flex items-center justify-between p-1 bg-white rounded border border-brand-border text-[10px]">
                              <span className="font-semibold text-brand-navy truncate">pib.gov.in</span>
                              <span className="text-[9px] text-brand-blue bg-blue-50 px-1 py-0.2 rounded font-medium">Fact Check</span>
                            </div>
                            <div className="flex items-center justify-between p-1 bg-white rounded border border-brand-border text-[10px]">
                              <span className="font-semibold text-brand-navy truncate">mnre.gov.in</span>
                              <span className="text-[9px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-medium">Circular 32/24</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {idx === 2 && (
                        /* Stage 3 Visual: Atomic Clause Decomposition */
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-semibold text-brand-slate-light flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Scale className="w-3 h-3 text-brand-blue" />
                              Assertion vs Clause
                            </span>
                            <span className="text-brand-blue font-mono text-[9px]">3 Clauses</span>
                          </div>
                          <div className="space-y-1 text-[10px]">
                            <div className="p-1 bg-white rounded border border-rose-200 bg-rose-50/40 flex items-center justify-between">
                              <span className="truncate text-rose-950 font-medium">90% Subsidy Claim</span>
                              <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1 rounded shrink-0">Contradicted</span>
                            </div>
                            <div className="p-1 bg-white rounded border border-rose-200 bg-rose-50/40 flex items-center justify-between">
                              <span className="truncate text-rose-950 font-medium">WhatsApp Link</span>
                              <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1 rounded shrink-0">Fraud Vector</span>
                            </div>
                            <div className="p-1 bg-white rounded border border-emerald-200 bg-emerald-50/40 flex items-center justify-between">
                              <span className="truncate text-emerald-950 font-medium">Scheme Active 2025</span>
                              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1 rounded shrink-0">Supported</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {idx === 3 && (
                        /* Stage 4 Visual: Assembled Verdict Card */
                        <div className="space-y-2">
                          <div className="text-[10px] font-semibold text-brand-slate-light flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <FileCheck2 className="w-3 h-3 text-brand-green" />
                              Assembled Report
                            </span>
                            <span className="text-brand-slate-light text-[9px] italic">Illustration</span>
                          </div>
                          <div className="p-1.5 rounded bg-white border border-rose-200 shadow-2xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] font-black text-rose-700 uppercase tracking-wide">
                                Contradicted Notice
                              </span>
                              <span className="text-[8px] bg-rose-100 text-rose-800 font-bold px-1 rounded">
                                Audited
                              </span>
                            </div>
                            <div className="text-[9px] text-brand-slate leading-tight line-clamp-2">
                              Max subsidy capped at 60% (30% central + 30% state). Unofficial WhatsApp vectors flagged.
                            </div>
                          </div>
                          <div className="text-[9px] text-brand-slate-light font-mono truncate">
                            Ref: DL-E-08032024-21943
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Subtext Footnote inside card */}
                  <div className="pt-3 border-t border-brand-border text-[11px] text-brand-slate-light font-medium">
                    {stage.subtext}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ======================================================== */}
        {/* MOBILE & TABLET PIPELINE FLOWCHART (Vertical Connected)   */}
        {/* ======================================================== */}
        <div className="lg:hidden space-y-6 mb-12">
          {stages.map((stage, idx) => {
            const Icon = stage.icon;
            const isActive = activeStage === idx;
            const isPassed = activeStage > idx;

            return (
              <div key={stage.id} className="relative">
                {/* Connecting vertical line to next stage */}
                {idx < stages.length - 1 && (
                  <div
                    className="absolute left-6 top-14 bottom-[-24px] w-0.5 bg-brand-border z-0"
                    aria-hidden="true"
                  >
                    {/* Animated vertical pulse */}
                    {activeStage === idx && isPlaying && (
                      <div className="w-full h-1/2 bg-brand-blue animate-pulse" />
                    )}
                  </div>
                )}

                <div
                  onClick={() => handleStageSelect(idx)}
                  className={`relative z-10 cursor-pointer rounded-xl border p-5 transition-all ${
                    isActive
                      ? 'bg-white border-brand-blue shadow-md ring-2 ring-brand-blue/15'
                      : isPassed
                      ? 'bg-slate-50 border-brand-border'
                      : 'bg-white border-brand-border'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleStageSelect(idx);
                    }
                  }}
                  aria-label={`Stage ${stage.number}: ${stage.title}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Node Badge */}
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                        isActive
                          ? 'bg-brand-blue text-white border-brand-blue shadow-xs'
                          : isPassed
                          ? 'bg-emerald-50 text-brand-green border-emerald-200'
                          : 'bg-brand-softblue text-brand-blue border-brand-softblue-border'
                      }`}
                    >
                      <Icon className="w-5 h-5 stroke-[2.2]" aria-hidden="true" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue bg-brand-softblue px-2 py-0.5 rounded border border-brand-softblue-border">
                          Stage {stage.number}
                        </span>
                        <span className="text-[10px] font-semibold text-brand-slate-light">
                          {stage.tag}
                        </span>
                      </div>

                      <h3
                        className={`text-base font-bold mb-1.5 ${
                          isActive ? 'text-brand-blue' : 'text-brand-navy'
                        }`}
                      >
                        {stage.title}
                      </h3>

                      <p className="text-xs text-brand-slate leading-relaxed mb-3">
                        {stage.description}
                      </p>

                      <div className="text-[11px] text-brand-slate-light bg-brand-bg-subtle p-2.5 rounded-lg border border-brand-border">
                        <span className="font-semibold text-brand-navy">Pipeline detail: </span>
                        {stage.subtext}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ======================================================== */}
        {/* DETAILED ACTIVE STAGE DEEP-DIVE INSPECTOR PANEL          */}
        {/* ======================================================== */}
        <div className="bg-brand-bg-subtle rounded-2xl border border-brand-border p-5 sm:p-6 mb-10 shadow-2xs">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-brand-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-blue text-white flex items-center justify-center font-bold text-sm shadow-2xs">
                {stages[activeStage].number}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-brand-navy">
                    Active Architecture Stage: {stages[activeStage].title}
                  </h4>
                  <span className="text-[10px] font-semibold text-brand-blue bg-white px-2 py-0.5 rounded border border-brand-softblue-border">
                    {stages[activeStage].tag}
                  </span>
                </div>
                <p className="text-xs text-brand-slate mt-0.5">
                  Visual representation of the internal verification data flow
                </p>
              </div>
            </div>

            {/* Stage Selector Dots */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-brand-slate-light font-medium mr-1 hidden sm:inline">
                Inspect Stage:
              </span>
              {stages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleStageSelect(i)}
                  className={`w-7 h-7 rounded-md text-xs font-bold transition-all ${
                    activeStage === i
                      ? 'bg-brand-blue text-white shadow-2xs'
                      : 'bg-white text-brand-slate hover:bg-slate-100 border border-brand-border'
                  }`}
                  aria-label={`Inspect Stage ${i + 1}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Content Details Based on Active Stage */}
          <div className="pt-5">
            {activeStage === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-xl border border-brand-border">
                  <div className="text-xs font-bold text-brand-navy mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand-blue" />
                    Input Sanitization
                  </div>
                  <p className="text-xs text-brand-slate leading-relaxed">
                    Strips prompt injection payloads, normalizes Unicode scripts (Devanagari, Latin), and limits input token bounds.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-brand-border">
                  <div className="text-xs font-bold text-brand-navy mb-1 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-brand-blue" />
                    Entity & Scheme Extraction
                  </div>
                  <p className="text-xs text-brand-slate leading-relaxed">
                    Identifies mentioned schemes (e.g., PM-KUSUM, PMAY, PM-Kisan) and dates to build structured search vectors.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-brand-border">
                  <div className="text-xs font-bold text-brand-navy mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-brand-blue" />
                    Circular PDF OCR Support
                  </div>
                  <p className="text-xs text-brand-slate leading-relaxed">
                    Extracts circular reference IDs, issuing ministry seals, and publication dates from uploaded notifications.
                  </p>
                </div>
              </div>
            )}

            {activeStage === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-xl border border-brand-border">
                  <div className="text-xs font-bold text-brand-navy mb-1 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-brand-blue" />
                    The Gazette of India
                  </div>
                  <p className="text-xs text-brand-slate leading-relaxed">
                    Primary sovereign legal record. Every central scheme rule, amendment, and subsidy budget is published here.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-brand-border">
                  <div className="text-xs font-bold text-brand-navy mb-1 flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-brand-blue" />
                    PIB Fact Check Archive
                  </div>
                  <p className="text-xs text-brand-slate leading-relaxed">
                    Official Press Information Bureau clarifications regarding circulating scams, forged letters, and fake circulars.
                  </p>
                </div>
                <div className="p-4 bg-white rounded-xl border border-brand-border">
                  <div className="text-xs font-bold text-brand-navy mb-1 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-brand-green" />
                    Zero Third-Party Dependency
                  </div>
                  <p className="text-xs text-brand-slate leading-relaxed">
                    Strict domain whitelist: only .gov.in, .nic.in, and official sovereign digital portals are admitted as sources.
                  </p>
                </div>
              </div>
            )}

            {activeStage === 2 && (
              <div className="space-y-3">
                <div className="p-4 bg-white rounded-xl border border-brand-border">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                    <div className="text-xs font-bold text-brand-navy flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-brand-blue" />
                      Atomic Claim Decomposition Matrix (Demonstration Example)
                    </div>
                    <span className="text-[10px] font-semibold text-brand-slate-light bg-brand-bg-subtle px-2 py-0.5 rounded border border-brand-border">
                      3 Claim Clauses Analyzed
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-rose-900">Claim Assertion:</span>{" "}
                        <span className="text-rose-950 font-medium">"Beneficiaries receive 90% direct bank subsidy"</span>
                        <div className="text-[11px] text-brand-slate mt-0.5">
                          Official Gazette Clause 4.2 establishes subsidy cap at 30% Central + 30% State (60% total).
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold uppercase shrink-0">
                        Contradicted
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-rose-200 bg-rose-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-rose-900">Claim Assertion:</span>{" "}
                        <span className="text-rose-950 font-medium">"Submit Aadhaar & banking details via WhatsApp registration bot"</span>
                        <div className="text-[11px] text-brand-slate mt-0.5">
                          Clause 8.1 prohibits third-party or messaging intake; strictly state DISCOM portal only.
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold uppercase shrink-0">
                        Fraud Vector
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                      <div>
                        <span className="font-bold text-emerald-900">Claim Assertion:</span>{" "}
                        <span className="text-emerald-950 font-medium">"Scheme is currently accepting applications through FY 2025-26"</span>
                        <div className="text-[11px] text-brand-slate mt-0.5">
                          Confirmed by Ministry circular 32/2024 extension notification through 31 March 2026.
                        </div>
                      </div>
                      <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold uppercase shrink-0">
                        Supported
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeStage === 3 && (
              <div className="space-y-4">
                <div className="p-4 bg-white rounded-xl border border-brand-border">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                    <div>
                      <div className="text-xs font-bold text-brand-navy flex items-center gap-1.5">
                        <FileCheck2 className="w-3.5 h-3.5 text-brand-green" />
                        Explore the 4 Standard Outcome Categories
                      </div>
                      <p className="text-[11px] text-brand-slate">
                        GovVerify AI never issues arbitrary answers; each outcome corresponds to an evidence standard.
                      </p>
                    </div>

                    {/* Verdict Category Selector Tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto">
                      {verdictOptions.map((opt, vIdx) => (
                        <button
                          key={vIdx}
                          type="button"
                          onClick={() => setVerdictDemoIndex(vIdx)}
                          className={`text-[11px] px-2.5 py-1 rounded-md font-bold transition-all ${
                            verdictDemoIndex === vIdx
                              ? 'bg-brand-navy text-white shadow-2xs'
                              : 'bg-slate-100 text-brand-slate hover:bg-slate-200'
                          }`}
                        >
                          {opt.label.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Verdict Demo Card */}
                  {(() => {
                    const currentVerdict = verdictOptions[verdictDemoIndex];
                    const VerdictIcon = currentVerdict.icon;
                    return (
                      <div className={`p-4 rounded-xl border ${currentVerdict.color} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`}>
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${currentVerdict.badgeColor} shrink-0 mt-0.5 shadow-2xs`}>
                            <VerdictIcon className="w-4 h-4" aria-hidden="true" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-black tracking-wide uppercase">
                                {currentVerdict.label}
                              </span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-white/80 border border-current font-semibold">
                                Evidence Standard
                              </span>
                            </div>
                            <div className="text-xs font-medium mt-1">
                              {currentVerdict.sublabel}
                            </div>
                            <div className="text-[11px] opacity-80 mt-1 flex items-center gap-1 font-mono">
                              <span>Source Citation:</span>
                              <span className="underline">{currentVerdict.source}</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                            Audit Trail
                          </span>
                          <span className="text-xs font-bold text-brand-navy font-mono">
                            SHA256 Signed
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Civic Technical Honesty Notice */}
        <div className="p-4.5 rounded-xl border border-brand-border bg-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="p-1.5 rounded-md bg-brand-softblue text-brand-blue shrink-0 mt-0.5 border border-brand-softblue-border">
              <Info className="w-4 h-4" aria-hidden="true" />
            </div>
            <div className="text-xs sm:text-sm text-brand-navy">
              <span className="font-bold">Pipeline Architecture Demonstration:</span> This flowchart illustrates the four-stage verification protocol implemented for GovVerify AI. In Phase 1, client-side validation and structured input parsing are active; sovereign source connectors and LLM clause decomposition link live in Phase 2.
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="#principles"
              className="text-xs font-bold text-brand-blue hover:text-brand-blue-hover flex items-center gap-1 group whitespace-nowrap"
            >
              <span>Verification Principles</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
