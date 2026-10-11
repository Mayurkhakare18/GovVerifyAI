/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Type } from '@google/genai';
import { getGeminiClient, GEMINI_FLASH_MODEL, getGeminiConfigStatus } from './gemini';
import { getServerSupabase } from '../supabase';
import {
  discoverSourcesWithTavily,
  getTavilyConfigStatus,
  TavilyDiscoveryOptions,
} from './tavily';
import { classifyError, FailureReason } from './errorClassification';
import { persistRequestTelemetry } from './telemetry';

export type SourceProvenance = 'GROUNDED_SEARCH' | 'UNVERIFIED_CANDIDATE';

export type GroundingStatus =
  | 'SUCCESS'
  | 'QUOTA_EXHAUSTED'
  | 'AUTHENTICATION_ERROR'
  | 'SERVICE_ERROR'
  | 'EMPTY_RESULTS';

export type DiscoveryProvider = 'tavily' | 'gemini' | 'auto';

export interface DiscoveredSource {
  title: string;
  url: string;
  domain: string;
  issuingAuthority: string;
  sourceType: string;
  provenance: SourceProvenance;
  isVerified: boolean;
  publicationDate?: string;
  extractedText?: string;
  relationship?: 'SUPPORTS' | 'REFUTES' | 'MENTIONS' | 'OFFICIAL_CONFIRMATION' | 'UNVERIFIED_CANDIDATE' | 'UNASSESSED';
  tier: 1 | 2 | 3 | 4;
  clauseReference?: string;
  pageNumber?: number;
}

export interface DiscoveryResult {
  claim: string;
  groundingStatus: GroundingStatus;
  groundingLimitation?: string;
  searchQueries: string[];
  sources: DiscoveredSource[]; // ONLY verified grounded sources
  candidateSources: DiscoveredSource[]; // Unverified candidate suggestions
  discoveryMethod: 'LIVE_SEARCH_GROUNDED' | 'UNVERIFIED_CANDIDATE_SEARCH';
  hasVerifiedEvidence: boolean;
  provider?: 'tavily' | 'gemini';
  timestamp: string;
}

export interface DiscoveryOptions {
  provider?: DiscoveryProvider;
  mockGroundingChunks?: Array<{
    web: {
      uri: string;
      title?: string;
    };
  }>;
  mockGroundingSupports?: Array<{
    groundingChunkIndices: number[];
    segment: { text: string };
  }>;
  mockWebSearchQueries?: string[];
  forceGroundingError?: { status: number; message: string };
  tavilyOptions?: TavilyDiscoveryOptions;
}

/**
 * Resolves the active source discovery provider according to configuration and available credentials.
 */
export function getActiveDiscoveryProvider(preferred?: DiscoveryProvider): 'tavily' | 'gemini' {
  if (preferred && preferred !== 'auto') {
    return preferred;
  }

  const envProvider = (process.env.DISCOVERY_PROVIDER || 'auto').trim().toLowerCase();
  if (envProvider === 'tavily') return 'tavily';
  if (envProvider === 'gemini') return 'gemini';

  // Auto mode: If TAVILY_API_KEY is configured, prioritize Tavily; otherwise fallback to Gemini
  const tavilyConfig = getTavilyConfigStatus();
  if (tavilyConfig.isConfigured) {
    return 'tavily';
  }

  return 'gemini';
}

/**
 * Classifies domain into authoritative trust tiers prioritizing sovereign Indian government infrastructure.
 */
export function classifyIndianAuthorityDomain(rawUrl: string): {
  domain: string;
  tier: 1 | 2 | 3 | 4;
  suggestedAuthority?: string;
} {
  let hostname = '';
  try {
    const parsed = new URL(rawUrl);
    hostname = parsed.hostname.toLowerCase();
  } catch {
    // If not a valid full URL, attempt string normalization
    hostname = rawUrl.replace(/^https?:\/\//i, '').split('/')[0].toLowerCase();
  }

  // Tier 2: Apex Statutory & Regulatory Institutions (RBI, SEBI, UGC, NTA, High Courts)
  if (
    hostname === 'rbi.org.in' ||
    hostname.endsWith('.rbi.org.in') ||
    hostname === 'sebi.gov.in' ||
    hostname.endsWith('.sebi.gov.in') ||
    hostname === 'sci.gov.in' ||
    hostname.endsWith('.sci.gov.in') ||
    hostname === 'nta.ac.in' ||
    hostname.endsWith('.nta.ac.in') ||
    hostname === 'ugc.ac.in' ||
    hostname.endsWith('.ugc.ac.in') ||
    hostname === 'pfrda.org.in' ||
    hostname.endsWith('.pfrda.org.in')
  ) {
    let suggestedAuthority = 'Statutory Authority / Regulatory Body';
    if (hostname.includes('rbi.org.in')) suggestedAuthority = 'Reserve Bank of India (RBI)';
    if (hostname.includes('sebi')) suggestedAuthority = 'Securities and Exchange Board of India (SEBI)';
    if (hostname.includes('sci')) suggestedAuthority = 'Supreme Court of India';

    return { domain: hostname, tier: 2, suggestedAuthority };
  }

  // Tier 3: National Public Broadcasters & Official News Agencies (DD News, AIR)
  if (
    hostname.includes('ddnews.gov.in') ||
    hostname.includes('newsonair.gov.in') ||
    hostname.includes('airnews')
  ) {
    return { domain: hostname, tier: 3, suggestedAuthority: 'National Public Broadcaster / Prasar Bharati' };
  }

  // Tier 1: Sovereign Indian Government Portals (.gov.in, .nic.in, egazette.gov.in, pib.gov.in)
  if (
    hostname.endsWith('.gov.in') ||
    hostname.endsWith('.nic.in') ||
    hostname === 'india.gov.in' ||
    hostname === 'mygov.in' ||
    hostname.endsWith('.mygov.in')
  ) {
    let suggestedAuthority = 'Government of India';
    if (hostname.includes('pib.gov.in')) {
      suggestedAuthority = 'Press Information Bureau (PIB), Government of India';
    } else if (hostname.includes('mnre.gov.in')) {
      suggestedAuthority = 'Ministry of New and Renewable Energy (MNRE)';
    } else if (hostname.includes('pmkisan.gov.in') || hostname.includes('agricoop.nic.in')) {
      suggestedAuthority = 'Ministry of Agriculture & Farmers Welfare';
    } else if (hostname.includes('egazette.gov.in')) {
      suggestedAuthority = 'The Gazette of India (Department of Publication)';
    } else if (hostname.includes('incometax.gov.in')) {
      suggestedAuthority = 'Income Tax Department, Ministry of Finance';
    } else if (hostname.includes('epfindia.gov.in')) {
      suggestedAuthority = 'Employees\' Provident Fund Organisation (EPFO)';
    } else if (hostname.includes('uidai.gov.in')) {
      suggestedAuthority = 'Unique Identification Authority of India (UIDAI)';
    }

    return { domain: hostname, tier: 1, suggestedAuthority };
  }

  // Tier 4: Other / Secondary Web Reference
  return { domain: hostname, tier: 4 };
}

/**
 * Discovers authoritative Indian government sources for a claim using Gemini.
 *
 * Strict Provenance Rules (Phase 3 Step 1.5):
 * 1. Live Google Search grounding returns verified sources with isVerified = true, provenance = 'GROUNDED_SEARCH'.
 * 2. If grounding fails (quota 429, auth, error) or returns 0 chunks, groundingStatus records the exact limitation.
 * 3. Fallback generates candidate search queries and candidate portals marked provenance = 'UNVERIFIED_CANDIDATE',
 *    isVerified = false, with NO fabricated excerpts and NO assigned SUPPORTS/REFUTES relationships.
 * 4. Fallback candidate URLs are NEVER normalized into homepages and claimed to support the claim.
 */
export async function discoverAuthoritativeSources(
  claimText: string,
  options?: DiscoveryOptions
): Promise<DiscoveryResult> {
  const trimmed = claimText.trim();

  // Route to Tavily provider if selected or configured, unless Gemini mocks are provided
  const activeProvider = getActiveDiscoveryProvider(options?.provider);
  const isGeminiMock = Boolean(options?.mockGroundingChunks || options?.forceGroundingError || options?.mockWebSearchQueries);

  if (activeProvider === 'tavily' && !isGeminiMock) {
    const tavilyResult = await discoverSourcesWithTavily(trimmed, options?.tavilyOptions);
    return {
      ...tavilyResult,
      provider: 'tavily',
    };
  }

  let gemini: any = null;
  const geminiConfig = getGeminiConfigStatus();
  if (geminiConfig.isConfigured) {
    try {
      gemini = getGeminiClient();
    } catch {
      gemini = null;
    }
  }

  let groundingChunks: any[] | undefined = undefined;
  let groundingSupports: any[] | undefined = undefined;
  let webQueries: string[] = [];
  let modelText = '';
  let groundingStatus: GroundingStatus = 'EMPTY_RESULTS';
  let groundingLimitation: string | undefined = undefined;

  // Step 1: Check test overrides or attempt live Google Search Grounding
  if (options?.forceGroundingError) {
    const status = options.forceGroundingError.status;
    if (status === 429) {
      groundingStatus = 'QUOTA_EXHAUSTED';
      groundingLimitation =
        'Live Google Search grounding unavailable due to API quota exhaustion (HTTP 429 RESOURCE_EXHAUSTED). Model generated unverified candidate queries and portals; no live web evidence was retrieved.';
    } else if (status === 401 || status === 403) {
      groundingStatus = 'AUTHENTICATION_ERROR';
      groundingLimitation = `Google Search grounding authentication failed with HTTP ${status}.`;
    } else {
      groundingStatus = 'SERVICE_ERROR';
      groundingLimitation = `Google Search grounding failed: ${options.forceGroundingError.message}.`;
    }
  } else if (options?.mockGroundingChunks) {
    groundingChunks = options.mockGroundingChunks;
    groundingSupports = options.mockGroundingSupports;
    webQueries = options.mockWebSearchQueries || [`site:gov.in ${trimmed.slice(0, 60)}`];
    groundingStatus = 'SUCCESS';
  } else {
    try {
      if (!gemini) {
        throw new Error(geminiConfig.message);
      }

      const searchResponse = await gemini.models.generateContent({
        model: GEMINI_FLASH_MODEL,
        contents: `You are GovVerify AI Sovereign Source Finder.
Identify the official Indian government sources (.gov.in, .nic.in, pib.gov.in, official gazettes, nodal ministries)
that specifically address the following claim:
"${trimmed}"

Focus exclusively on authoritative Indian government notifications, press releases, scheme guidelines, or gazettes.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const groundingMeta = searchResponse.candidates?.[0]?.groundingMetadata;
      groundingChunks = groundingMeta?.groundingChunks;
      groundingSupports = (groundingMeta as any)?.groundingSupports;
      webQueries = groundingMeta?.webSearchQueries || [];
      modelText = searchResponse.text || '';

      if (groundingChunks && groundingChunks.length > 0) {
        groundingStatus = 'SUCCESS';
      } else {
        groundingStatus = 'EMPTY_RESULTS';
        groundingLimitation = 'Live Google Search grounding returned 0 grounded sources for this query.';
      }
    } catch (searchErr: any) {
      const errMsg = String(searchErr?.message || searchErr);
      const errStatus =
        searchErr?.status ||
        (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') ? 429 : 500);

      if (errStatus === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
        groundingStatus = 'QUOTA_EXHAUSTED';
        groundingLimitation =
          'Live Google Search grounding unavailable due to API quota exhaustion (HTTP 429 RESOURCE_EXHAUSTED). Model generated unverified candidate queries and portals; no live web evidence was retrieved.';
      } else if (errStatus === 401 || errStatus === 403) {
        groundingStatus = 'AUTHENTICATION_ERROR';
        groundingLimitation = `Live Google Search grounding authentication error (${errStatus}).`;
      } else {
        groundingStatus = 'SERVICE_ERROR';
        groundingLimitation = `Live Google Search grounding service error: ${errMsg}`;
      }

      console.warn(`[GovVerify AI] Live Google Search grounding notice [${groundingStatus}]: ${groundingLimitation}`);
    }
  }

  // Step 2: If live search grounding succeeded with real chunks, return verified grounded sources
  if (groundingStatus === 'SUCCESS' && groundingChunks && groundingChunks.length > 0) {
    const verifiedSources: DiscoveredSource[] = [];
    const seenUrls = new Set<string>();

    for (let i = 0; i < groundingChunks.length; i++) {
      const chunk = groundingChunks[i];
      const web = (chunk as any)?.web;
      if (!web || !web.uri) continue;

      const normalizedUrl = web.uri.trim();
      if (seenUrls.has(normalizedUrl)) continue;
      seenUrls.add(normalizedUrl);

      const classification = classifyIndianAuthorityDomain(normalizedUrl);
      const title = web.title || `Official Source - ${classification.domain}`;

      // Extract real supported excerpt if model linked this chunk in groundingSupports
      let extractedText = '';
      if (Array.isArray(groundingSupports)) {
        const matchingSupport = groundingSupports.find(
          (sup: any) => Array.isArray(sup.groundingChunkIndices) && sup.groundingChunkIndices.includes(i)
        );
        if (matchingSupport?.segment?.text) {
          extractedText = matchingSupport.segment.text.trim();
        }
      }
      if (!extractedText && modelText) {
        extractedText = modelText.slice(0, 300).trim();
      }
      if (!extractedText) {
        extractedText = `Grounded source reference identified from official search results for statement: "${trimmed.slice(0, 150)}..."`;
      }

      verifiedSources.push({
        title,
        url: normalizedUrl,
        domain: classification.domain,
        issuingAuthority: classification.suggestedAuthority || 'Government of India',
        sourceType: 'GROUNDED_SEARCH',
        provenance: 'GROUNDED_SEARCH',
        isVerified: true,
        extractedText,
        relationship: 'MENTIONS',
        tier: classification.tier,
        clauseReference: 'GOOGLE_SEARCH_GROUNDING',
      });
    }

    verifiedSources.sort((a, b) => a.tier - b.tier);

    if (verifiedSources.length > 0) {
      return {
        claim: trimmed,
        groundingStatus: 'SUCCESS',
        searchQueries: webQueries.length > 0 ? webQueries : [`site:gov.in ${trimmed.slice(0, 60)}`],
        sources: verifiedSources,
        candidateSources: [],
        discoveryMethod: 'LIVE_SEARCH_GROUNDED',
        hasVerifiedEvidence: true,
        timestamp: new Date().toISOString(),
      };
    }
  }

  // Step 3: Structured Sovereign Fallback when live search grounding is unavailable
  // HARDENED NON-NEGOTIABLE RULES:
  // - Formulate targeted search queries and identify official candidate portals.
  // - Candidates are strictly UNVERIFIED_CANDIDATE, isVerified: false.
  // - Do NOT fabricate excerpts or assign SUPPORTS/REFUTES.
  // - Do NOT represent candidates as verified sources.
  try {
    const fallbackPrompt = `You are GovVerify AI Sovereign Source Finder.
Live search grounding is unavailable. Formulate targeted search queries and identify candidate official Indian government nodal bodies and portals that govern the following claim:

CLAIM:
"${trimmed}"

Requirements:
1. Provide targeted search queries with Indian government domain filters (e.g., site:pib.gov.in, site:pmkusum.mnre.gov.in).
2. Identify candidate sovereign portals and nodal authorities (e.g., MNRE, Ministry of Agriculture, PIB Fact Check).
3. Do NOT generate simulated or guessed article excerpts.
4. Do NOT make claims of SUPPORTS or REFUTES.`;

    const structuredResponse = await gemini.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents: fallbackPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            searchQueries: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Targeted search queries crafted for Indian government portals',
            },
            candidatePortals: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  portalName: { type: Type.STRING },
                  domain: { type: Type.STRING },
                  issuingAuthority: { type: Type.STRING },
                  tier: {
                    type: Type.INTEGER,
                    description: '1 for sovereign .gov.in/.nic.in, 2 for statutory bodies, 3 for public media',
                  },
                },
                required: ['portalName', 'domain', 'issuingAuthority'],
              },
            },
          },
          required: ['searchQueries', 'candidatePortals'],
        },
      },
    });

    const parsed = JSON.parse(structuredResponse.text || '{}');
    const rawPortals = Array.isArray(parsed.candidatePortals) ? parsed.candidatePortals : [];

    const candidateSources: DiscoveredSource[] = rawPortals.map((p: any) => {
      const classification = classifyIndianAuthorityDomain(p.domain || 'gov.in');
      const safeUrl = `https://${classification.domain}`;

      return {
        title: p.portalName || `Candidate Portal - ${classification.domain}`,
        url: safeUrl,
        domain: classification.domain,
        issuingAuthority: p.issuingAuthority || classification.suggestedAuthority || 'Government of India',
        sourceType: 'UNVERIFIED_CANDIDATE',
        provenance: 'UNVERIFIED_CANDIDATE',
        isVerified: false,
        relationship: 'UNVERIFIED_CANDIDATE',
        tier: (p.tier as 1 | 2 | 3 | 4) || classification.tier,
      };
    });

    candidateSources.sort((a, b) => a.tier - b.tier);

    return {
      claim: trimmed,
      groundingStatus,
      groundingLimitation:
        groundingLimitation ||
        'Live Google Search grounding unavailable. Model generated unverified candidate queries and portals; no live web evidence was retrieved.',
      searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [`site:gov.in ${trimmed.slice(0, 50)}`],
      sources: [], // STRICT: 0 verified sources when grounding failed
      candidateSources,
      discoveryMethod: 'UNVERIFIED_CANDIDATE_SEARCH',
      hasVerifiedEvidence: false,
      timestamp: new Date().toISOString(),
    };
  } catch (fallbackErr: any) {
    console.warn('[GovVerify AI] Fallback candidate model call notice:', fallbackErr.message || fallbackErr);
    
    // Deterministic sovereign authority heuristic fallback when model generation is rate-limited
    const lowerClaim = trimmed.toLowerCase();
    const heuristicCandidates: DiscoveredSource[] = [];

    if (lowerClaim.includes('kusum') || lowerClaim.includes('solar') || lowerClaim.includes('mnre')) {
      heuristicCandidates.push({
        title: 'Candidate Portal - PM-KUSUM Official Portal',
        url: 'https://pmkusum.mnre.gov.in',
        domain: 'pmkusum.mnre.gov.in',
        issuingAuthority: 'Ministry of New and Renewable Energy (MNRE)',
        sourceType: 'UNVERIFIED_CANDIDATE',
        provenance: 'UNVERIFIED_CANDIDATE',
        isVerified: false,
        relationship: 'UNVERIFIED_CANDIDATE',
        tier: 1,
      });
      heuristicCandidates.push({
        title: 'Candidate Portal - Ministry of New and Renewable Energy',
        url: 'https://mnre.gov.in',
        domain: 'mnre.gov.in',
        issuingAuthority: 'Ministry of New and Renewable Energy (MNRE)',
        sourceType: 'UNVERIFIED_CANDIDATE',
        provenance: 'UNVERIFIED_CANDIDATE',
        isVerified: false,
        relationship: 'UNVERIFIED_CANDIDATE',
        tier: 1,
      });
    }

    if (lowerClaim.includes('kisan') || lowerClaim.includes('farmer') || lowerClaim.includes('agriculture')) {
      heuristicCandidates.push({
        title: 'Candidate Portal - PM-KISAN Official Portal',
        url: 'https://pmkisan.gov.in',
        domain: 'pmkisan.gov.in',
        issuingAuthority: 'Ministry of Agriculture & Farmers Welfare',
        sourceType: 'UNVERIFIED_CANDIDATE',
        provenance: 'UNVERIFIED_CANDIDATE',
        isVerified: false,
        relationship: 'UNVERIFIED_CANDIDATE',
        tier: 1,
      });
    }

    if (lowerClaim.includes('rbi') || lowerClaim.includes('bank') || lowerClaim.includes('repo')) {
      heuristicCandidates.push({
        title: 'Candidate Portal - Reserve Bank of India',
        url: 'https://rbi.org.in',
        domain: 'rbi.org.in',
        issuingAuthority: 'Reserve Bank of India (RBI)',
        sourceType: 'UNVERIFIED_CANDIDATE',
        provenance: 'UNVERIFIED_CANDIDATE',
        isVerified: false,
        relationship: 'UNVERIFIED_CANDIDATE',
        tier: 2,
      });
    }

    // Always include PIB central candidate portal
    heuristicCandidates.push({
      title: 'Candidate Portal - Press Information Bureau (PIB)',
      url: 'https://pib.gov.in',
      domain: 'pib.gov.in',
      issuingAuthority: 'Press Information Bureau (PIB), Government of India',
      sourceType: 'UNVERIFIED_CANDIDATE',
      provenance: 'UNVERIFIED_CANDIDATE',
      isVerified: false,
      relationship: 'UNVERIFIED_CANDIDATE',
      tier: 1,
    });

    const heuristicQueries = [
      `site:pib.gov.in "${trimmed.slice(0, 40)}"`,
      `site:gov.in "${trimmed.slice(0, 40)}"`,
    ];

    return {
      claim: trimmed,
      groundingStatus,
      groundingLimitation:
        groundingLimitation ||
        `Live Google Search grounding unavailable (${fallbackErr.message || 'Error'}). Candidate portals identified via sovereign domain mapping.`,
      searchQueries: heuristicQueries,
      sources: [],
      candidateSources: heuristicCandidates,
      discoveryMethod: 'UNVERIFIED_CANDIDATE_SEARCH',
      hasVerifiedEvidence: false,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Discovers sources for an existing verification request and persists them to Supabase
 * in public.sources and public.evidence.
 *
 * Strict Provenance Rules (Phase 3 Step 1.5):
 * 1. ONLY verified grounded sources and excerpts are persisted to public.evidence!
 * 2. Unverified candidates are NEVER inserted into public.evidence.
 * 3. If discovery yields no verified evidence (e.g. Quota Exhaustion 429), the request
 *    transitions to status 'FAILED' and does NOT remain in 'PROCESSING'.
 * 4. Strictly zero writes to public.verification_results.
 */
export async function discoverAndPersistSourcesForRequest(
  verificationRequestId: string,
  options?: DiscoveryOptions
): Promise<{
  requestRecord: any;
  status: 'PROCESSING' | 'FAILED' | 'QUEUED';
  hasVerifiedEvidence: boolean;
  groundingStatus: GroundingStatus;
  groundingLimitation?: string;
  sourcesCount: number;
  sources: any[];
  evidence: any[];
  candidateSources: any[];
  searchQueries: string[];
}> {
  const supabase = getServerSupabase();

  // 1. Fetch request and associated claim
  const { data: request, error: reqError } = await supabase
    .from('verification_requests')
    .select('*, claims(*)')
    .eq('id', verificationRequestId)
    .single();

  if (reqError || !request) {
    throw new Error(`Verification request not found: ${reqError?.message || verificationRequestId}`);
  }

  const claimText = request.original_claim || request.claims?.[0]?.claim_text || '';
  if (!claimText) {
    await supabase
      .from('verification_requests')
      .update({ status: 'QUEUED', updated_at: new Date().toISOString() })
      .eq('id', verificationRequestId);
    throw new Error('No claim text found on verification request.');
  }

  const primaryClaimId = request.claims?.[0]?.id || null;

  // 2. Temporarily set status to PROCESSING while discovery executes
  await persistRequestTelemetry(verificationRequestId, {
    status: 'PROCESSING',
    lastAttemptAt: new Date().toISOString(),
  });

  const activeProvider = getActiveDiscoveryProvider(options?.provider);

  try {
    const discovery = await discoverAuthoritativeSources(claimText, options);

    // CASE 1: Live Grounded Evidence Discovered!
    if (discovery.hasVerifiedEvidence && discovery.sources.length > 0) {
      const persistedSources: any[] = [];
      const persistedEvidence: any[] = [];

      for (const src of discovery.sources) {
        let sourceRecordId: string | null = null;

        const { data: existingSource } = await supabase
          .from('sources')
          .select('id')
          .eq('url', src.url)
          .maybeSingle();

        if (existingSource) {
          sourceRecordId = existingSource.id;
        } else {
          const { data: newSource, error: srcError } = await supabase
            .from('sources')
            .insert({
              title: src.title,
              url: src.url,
              domain: src.domain,
              issuing_authority: src.issuingAuthority,
              source_type: 'GROUNDED_SEARCH',
              publication_date: src.publicationDate || null,
            })
            .select()
            .single();

          if (!srcError && newSource) {
            sourceRecordId = newSource.id;
          }
        }

        if (sourceRecordId) {
          persistedSources.push({ ...src, id: sourceRecordId });

          // Idempotency guard: Avoid inserting duplicate evidence for the same source
          const { data: existingEv } = await supabase
            .from('evidence')
            .select('id, sources(*)')
            .eq('verification_request_id', verificationRequestId)
            .eq('source_id', sourceRecordId)
            .maybeSingle();

          if (existingEv) {
            persistedEvidence.push(existingEv);
          } else {
            const { data: evidenceRecord, error: evError } = await supabase
              .from('evidence')
              .insert({
                verification_request_id: verificationRequestId,
                claim_id: primaryClaimId,
                source_id: sourceRecordId,
                extracted_text: src.extractedText,
                relationship: src.relationship || 'MENTIONS',
                clause_reference: src.clauseReference || 'GOOGLE_SEARCH_GROUNDING',
                page_number: src.pageNumber || null,
              })
              .select('*, sources(*)')
              .single();

            if (!evError && evidenceRecord) {
              persistedEvidence.push(evidenceRecord);
            }
          }
        }
      }

      // Verified evidence persisted -> Record grounding status and keep status PROCESSING
      await persistRequestTelemetry(verificationRequestId, {
        status: 'PROCESSING',
        groundingStatus: discovery.groundingStatus,
        failureReason: null,
        failureDetails: null,
      });

      return {
        requestRecord: { ...request, status: 'PROCESSING' },
        status: 'PROCESSING',
        hasVerifiedEvidence: true,
        groundingStatus: discovery.groundingStatus,
        groundingLimitation: discovery.groundingLimitation,
        sourcesCount: persistedSources.length,
        sources: persistedSources,
        evidence: persistedEvidence,
        candidateSources: [],
        searchQueries: discovery.searchQueries,
      };
    }

    // CASE 2: No Verified Evidence Discovered (e.g. Quota Exhaustion 429, Error, or Empty)!
    // Classify error and record sanitized telemetry
    let failureReason: FailureReason = 'NO_VERIFIED_SOURCES';
    if (discovery.groundingStatus === 'QUOTA_EXHAUSTED') {
      failureReason = 'QUOTA_EXHAUSTED';
    } else if (discovery.groundingStatus === 'SERVICE_ERROR') {
      failureReason = 'PROVIDER_UNAVAILABLE';
    } else if (discovery.groundingStatus === 'EMPTY_RESULTS') {
      failureReason = 'NO_VERIFIED_SOURCES';
    }

    const classified = classifyError(
      new Error(discovery.groundingLimitation || 'No authoritative verified evidence found'),
      {
        phase: 'DISCOVERY',
        provider: activeProvider,
      }
    );

    const finalReason = discovery.groundingStatus === 'QUOTA_EXHAUSTED' ? 'QUOTA_EXHAUSTED' : failureReason;

    await persistRequestTelemetry(verificationRequestId, {
      status: 'FAILED',
      failureReason: finalReason,
      failureDetails: classified.sanitizedDetails,
      groundingStatus: discovery.groundingStatus,
    });

    return {
      requestRecord: { ...request, status: 'FAILED' },
      status: 'FAILED',
      hasVerifiedEvidence: false,
      groundingStatus: discovery.groundingStatus,
      groundingLimitation: discovery.groundingLimitation,
      sourcesCount: 0,
      sources: [],
      evidence: [],
      candidateSources: discovery.candidateSources,
      searchQueries: discovery.searchQueries,
    };
  } catch (err: any) {
    const classified = classifyError(err, { phase: 'DISCOVERY', provider: activeProvider });
    await persistRequestTelemetry(verificationRequestId, {
      status: 'FAILED',
      failureReason: classified.failureReason,
      failureDetails: classified.sanitizedDetails,
    });
    throw err;
  }
}
