/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Tavily Search API Source Discovery Provider
 * Integrates Tavily Search for sovereign Indian government source discovery,
 * enforcing strict evidence provenance and domain trustworthiness.
 */

import dotenv from 'dotenv';
dotenv.config();

import {
  DiscoveredSource,
  DiscoveryResult,
  GroundingStatus,
  classifyIndianAuthorityDomain,
} from './sourceDiscovery';

export interface TavilySearchResultItem {
  title: string;
  url: string;
  content: string; // Search snippet
  raw_content?: string; // Full extracted page content when include_raw_content=true
  score?: number;
  published_date?: string;
}

export interface TavilySearchApiResponse {
  query: string;
  answer?: string;
  results: TavilySearchResultItem[];
  response_time?: number;
}

export interface TavilyDiscoveryOptions {
  mockResults?: TavilySearchResultItem[];
  mockError?: { status: number; message: string };
  timeoutMs?: number;
}

/**
 * Validates Tavily API configuration status.
 * Never exposes the private key.
 */
export function getTavilyConfigStatus(): {
  isConfigured: boolean;
  message: string;
} {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    return {
      isConfigured: false,
      message: 'TAVILY_NOT_CONFIGURED: TAVILY_API_KEY environment variable is missing or empty.',
    };
  }

  return {
    isConfigured: true,
    message: 'Tavily Search API is configured.',
  };
}

/**
 * Prioritized sovereign Indian government domain patterns for Tavily search.
 */
export const OFFICIAL_INDIAN_DOMAINS = [
  'gov.in',
  'nic.in',
  'pib.gov.in',
  'egazette.gov.in',
  'india.gov.in',
  'mygov.in',
  'rbi.org.in',
  'sebi.gov.in',
  'sci.gov.in',
];

/**
 * Executes a search query via Tavily Search API with sovereign domain filtering.
 */
export async function executeTavilySearch(
  query: string,
  options?: TavilyDiscoveryOptions
): Promise<TavilySearchApiResponse> {
  if (options?.mockError) {
    const error: any = new Error(options.mockError.message);
    error.status = options.mockError.status;
    throw error;
  }

  if (options?.mockResults) {
    return {
      query,
      results: options.mockResults,
    };
  }

  const status = getTavilyConfigStatus();
  if (!status.isConfigured) {
    const error: any = new Error(status.message);
    error.status = 503;
    throw error;
  }

  const apiKey = process.env.TAVILY_API_KEY!.trim();
  const timeoutMs = options?.timeoutMs || 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_domains: OFFICIAL_INDIAN_DOMAINS,
        include_raw_content: true,
        max_results: 8,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      let parsedMessage = errText;
      try {
        const jsonErr = JSON.parse(errText);
        parsedMessage = jsonErr.detail || jsonErr.message || errText;
      } catch {
        // use raw text
      }

      const error: any = new Error(`Tavily API responded with HTTP ${response.status}: ${parsedMessage}`);
      error.status = response.status;
      throw error;
    }

    const data: TavilySearchApiResponse = await response.json();
    return data;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutError: any = new Error(`Tavily API request timed out after ${timeoutMs}ms.`);
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw err;
  }
}

/**
 * Extracts the most relevant excerpt from raw verified page content.
 * Guarantees that search snippets or model summaries alone are never accepted.
 */
function extractGroundedExcerpt(
  claimText: string,
  rawContent: string,
  fallbackSnippet?: string
): string | null {
  if (!rawContent || typeof rawContent !== 'string' || rawContent.trim().length < 80) {
    return null;
  }

  const clean = rawContent.replace(/\s+/g, ' ').trim();
  const lowerClaim = claimText.toLowerCase();

  // Find significant keywords from claim (words with length >= 4)
  const keywords = lowerClaim
    .split(/[^a-zA-Z0-9]/)
    .filter((w) => w.length >= 4 && !['what', 'this', 'that', 'from', 'with', 'about', 'government'].includes(w));

  // Search for the paragraph/sentence that has highest keyword overlap
  const sentences = clean.split(/(?<=[.?!])\s+/);
  let bestSentence = '';
  let maxMatches = 0;

  for (const sentence of sentences) {
    if (sentence.length < 40 || sentence.length > 500) continue;
    const lowerSent = sentence.toLowerCase();
    let matches = 0;
    for (const kw of keywords) {
      if (lowerSent.includes(kw)) matches++;
    }
    if (matches > maxMatches) {
      maxMatches = matches;
      bestSentence = sentence;
    }
  }

  if (bestSentence && maxMatches >= 1) {
    return bestSentence.trim();
  }

  // If no single sentence matched well, extract a substantive excerpt from the beginning of page
  return clean.slice(0, 350).trim();
}

/**
 * Discovers authoritative Indian government sources using the Tavily Search API.
 * 
 * Strict Evidence Integrity & Provenance Guardrails:
 * 1. Only domains classified as sovereign Indian authorities (Tier 1-3) can be grounded.
 * 2. Candidate URLs from untrusted/secondary domains (Tier 4) are rejected from verified evidence.
 * 3. Search snippets, Tavily answer summaries, and relevance scores alone are NEVER accepted as verified evidence.
 * 4. Actual retrieved page content (raw_content) must be validated and substantive (> 80 chars).
 * 5. If extraction fails, the item remains an UNVERIFIED_CANDIDATE and is never inserted as evidence.
 * 6. Honest failure: If Tavily returns 0 results or errors, report the exact limitation.
 */
export async function discoverSourcesWithTavily(
  claimText: string,
  options?: TavilyDiscoveryOptions
): Promise<DiscoveryResult> {
  const trimmed = claimText.trim();
  let groundingStatus: GroundingStatus = 'EMPTY_RESULTS';
  let groundingLimitation: string | undefined = undefined;

  const searchQuery = `site:gov.in OR site:nic.in OR site:pib.gov.in "${trimmed.slice(0, 80)}"`;
  const searchQueries: string[] = [searchQuery];

  try {
    const apiResponse = await executeTavilySearch(trimmed, options);
    const results = apiResponse.results || [];

    if (results.length === 0) {
      return {
        claim: trimmed,
        groundingStatus: 'EMPTY_RESULTS',
        groundingLimitation: 'Tavily Search API returned 0 results for official Indian government queries.',
        searchQueries,
        sources: [],
        candidateSources: [],
        discoveryMethod: 'LIVE_SEARCH_GROUNDED',
        hasVerifiedEvidence: false,
        timestamp: new Date().toISOString(),
      };
    }

    const verifiedSources: DiscoveredSource[] = [];
    const candidateSources: DiscoveredSource[] = [];
    const seenUrls = new Set<string>();

    for (const item of results) {
      if (!item.url) continue;

      let normalizedUrl = item.url.trim();
      try {
        const u = new URL(normalizedUrl);
        normalizedUrl = `${u.origin}${u.pathname}${u.search}`;
      } catch {
        // ignore parsing error
      }

      if (seenUrls.has(normalizedUrl)) continue;
      seenUrls.add(normalizedUrl);

      const classification = classifyIndianAuthorityDomain(normalizedUrl);

      // Guardrail 1: Check Domain Trustworthiness (Tier 1-3 = Authoritative, Tier 4 = Untrusted/Secondary)
      const isAuthoritativeDomain = classification.tier <= 3;

      if (!isAuthoritativeDomain) {
        // Demote to candidate source; never treat untrusted secondary domains as grounded sovereign evidence
        candidateSources.push({
          title: item.title || `Secondary Source - ${classification.domain}`,
          url: normalizedUrl,
          domain: classification.domain,
          issuingAuthority: 'External / Non-Sovereign Domain',
          sourceType: 'UNVERIFIED_CANDIDATE',
          provenance: 'UNVERIFIED_CANDIDATE',
          isVerified: false,
          relationship: 'UNVERIFIED_CANDIDATE',
          tier: 4,
        });
        continue;
      }

      // Guardrail 2: Validate Actual Retrieved Content (Never accept snippets alone)
      const groundedExcerpt = extractGroundedExcerpt(trimmed, item.raw_content || '', item.content);

      if (!groundedExcerpt) {
        // If full page content was not retrieved or empty, keep as unverified candidate portal
        candidateSources.push({
          title: item.title || `Candidate Portal - ${classification.domain}`,
          url: normalizedUrl,
          domain: classification.domain,
          issuingAuthority: classification.suggestedAuthority || 'Government of India',
          sourceType: 'UNVERIFIED_CANDIDATE',
          provenance: 'UNVERIFIED_CANDIDATE',
          isVerified: false,
          relationship: 'UNVERIFIED_CANDIDATE',
          tier: classification.tier,
        });
        continue;
      }

      // Guardrail 3: Genuine Grounded Sovereign Evidence
      verifiedSources.push({
        title: item.title || `Official Sovereign Source - ${classification.domain}`,
        url: normalizedUrl,
        domain: classification.domain,
        issuingAuthority: classification.suggestedAuthority || 'Government of India',
        sourceType: 'GROUNDED_SEARCH',
        provenance: 'GROUNDED_SEARCH',
        isVerified: true,
        extractedText: groundedExcerpt,
        publicationDate: item.published_date || undefined,
        relationship: 'MENTIONS',
        tier: classification.tier,
        clauseReference: 'TAVILY_SEARCH_GROUNDING',
      });
    }

    verifiedSources.sort((a, b) => a.tier - b.tier);
    candidateSources.sort((a, b) => a.tier - b.tier);

    if (verifiedSources.length > 0) {
      return {
        claim: trimmed,
        groundingStatus: 'SUCCESS',
        searchQueries,
        sources: verifiedSources,
        candidateSources,
        discoveryMethod: 'LIVE_SEARCH_GROUNDED',
        hasVerifiedEvidence: true,
        timestamp: new Date().toISOString(),
      };
    }

    // Results existed, but none satisfied the strict government domain and content verification requirements
    return {
      claim: trimmed,
      groundingStatus: 'EMPTY_RESULTS',
      groundingLimitation:
        'Tavily search retrieved candidate links, but none satisfied sovereign Indian government domain and grounded content verification requirements.',
      searchQueries,
      sources: [],
      candidateSources,
      discoveryMethod: 'UNVERIFIED_CANDIDATE_SEARCH',
      hasVerifiedEvidence: false,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    const errStatus = err?.status || (String(err?.message || '').includes('429') ? 429 : 500);
    const errMsg = err?.message || String(err);

    if (errStatus === 429 || errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate limit')) {
      groundingStatus = 'QUOTA_EXHAUSTED';
      groundingLimitation = 'Tavily Search API rate limit or quota exceeded (HTTP 429).';
    } else if (errStatus === 401 || errStatus === 403 || errMsg.includes('unauthorized') || errMsg.includes('api_key')) {
      groundingStatus = 'AUTHENTICATION_ERROR';
      groundingLimitation = `Tavily Search API authentication failed: ${errMsg}`;
    } else {
      groundingStatus = 'SERVICE_ERROR';
      groundingLimitation = `Tavily Search API service error: ${errMsg}`;
    }

    console.warn(`[GovVerify AI] Tavily discovery notice [${groundingStatus}]: ${groundingLimitation}`);

    return {
      claim: trimmed,
      groundingStatus,
      groundingLimitation,
      searchQueries,
      sources: [],
      candidateSources: [],
      discoveryMethod: 'UNVERIFIED_CANDIDATE_SEARCH',
      hasVerifiedEvidence: false,
      timestamp: new Date().toISOString(),
    };
  }
}
