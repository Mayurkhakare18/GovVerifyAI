/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — PIB Fact Check Published Results Discovery Adapter
 * Discovers and parses authentic published fact-checks from the Press Information Bureau (PIB)
 * Fact Check Unit (factcheck.pib.gov.in, pib.gov.in/FactCheck).
 * 
 * Strict Integrity Guardrails:
 * 1. Only official published pages and official releases are retrieved.
 * 2. Never scrapes behind authentication or bypasses access controls.
 * 3. Matches citizen claims semantically and lexically before treating a result as relevant.
 * 4. Preserves original publication URL, headline, publication date, and checked claim.
 * 5. Clearly distinguishes a published PIB finding from GovVerify AI's own automated analysis.
 * 6. Never claims GovVerify AI is affiliated with or endorsed by PIB or any ministry.
 * 7. When no matching published check exists, reports honest absence with a portal reference link.
 */

import { executeTavilySearch, TavilyDiscoveryOptions } from './tavily';
import { validateAndClassifyUrl } from './officialSourceRegistry';

export interface PibFactCheckResult {
  hasOfficialFactCheck: boolean;
  factCheckUrl?: string;
  headline?: string;
  publishedDate?: string;
  officialFinding?: 'FAKE' | 'MISLEADING' | 'TRUE' | 'OFFICIAL_CLARIFICATION';
  officialSummary?: string;
  checkedClaimStatement?: string;
  officialAuthority: string;
  isOfficialPibRelease: boolean;
  disclaimer: string;
  portalReferenceUrl: string;
}

export const OFFICIAL_PIB_FACT_CHECK_PORTAL = 'https://factcheck.pib.gov.in';

export const PIB_NON_AFFILIATION_DISCLAIMER =
  'GovVerify AI is an independent automated verification system and is not affiliated with, authorized by, or endorsed by the Press Information Bureau (PIB) Fact Check Unit or any government ministry. The cited findings are official public notices published directly by sovereign authorities.';

/**
 * Parses official PIB finding tag from title or page text.
 */
function parsePibFinding(text: string): 'FAKE' | 'MISLEADING' | 'TRUE' | 'OFFICIAL_CLARIFICATION' {
  const lower = text.toLowerCase();
  if (
    lower.includes('fake') ||
    lower.includes('fraudulent') ||
    lower.includes('hoax') ||
    lower.includes('scam alert') ||
    lower.includes('no such order') ||
    lower.includes('false message')
  ) {
    return 'FAKE';
  }
  if (
    lower.includes('misleading') ||
    lower.includes('partially true') ||
    lower.includes('distorted')
  ) {
    return 'MISLEADING';
  }
  if (
    lower.includes('clarification') ||
    lower.includes('advisory') ||
    lower.includes('caution notice')
  ) {
    return 'OFFICIAL_CLARIFICATION';
  }
  return 'OFFICIAL_CLARIFICATION';
}

/**
 * Matches a citizen claim against official PIB Fact Check archives.
 */
export async function discoverPibFactCheck(
  claimText: string,
  options?: TavilyDiscoveryOptions
): Promise<PibFactCheckResult> {
  const trimmed = claimText.trim();
  const baseResponse: PibFactCheckResult = {
    hasOfficialFactCheck: false,
    officialAuthority: 'Press Information Bureau (PIB) Fact Check Unit, Government of India',
    isOfficialPibRelease: false,
    disclaimer: PIB_NON_AFFILIATION_DISCLAIMER,
    portalReferenceUrl: OFFICIAL_PIB_FACT_CHECK_PORTAL,
  };

  if (!trimmed || trimmed.length < 10) {
    return baseResponse;
  }

  // Extract core keywords from the claim (length >= 4)
  const stopWords = new Set([
    'what', 'this', 'that', 'from', 'with', 'about', 'government',
    'will', 'have', 'been', 'were', 'also', 'under', 'into', 'central', 'india'
  ]);
  const keywords = trimmed
    .toLowerCase()
    .split(/[^a-zA-Z0-9]/)
    .filter((w) => w.length >= 4 && !stopWords.has(w));

  if (keywords.length === 0) {
    return baseResponse;
  }

  // Targeted official PIB Fact Check search query
  const pibQuery = `site:pib.gov.in/FactCheck OR site:factcheck.pib.gov.in "${keywords.slice(0, 4).join(' ')}"`;

  try {
    const searchResponse = await executeTavilySearch(pibQuery, {
      ...options,
      timeoutMs: options?.timeoutMs || 8000,
    });

    const results = searchResponse.results || [];
    for (const item of results) {
      if (!item.url) continue;

      // Validate URL authenticity (must strictly belong to pib.gov.in / factcheck.pib.gov.in)
      const validation = validateAndClassifyUrl(item.url);
      if (!validation.isValid || !validation.isOfficial) {
        continue;
      }

      const domain = validation.hostname || '';
      const isPib = domain === 'pib.gov.in' || domain.endsWith('.pib.gov.in');
      const isFactCheckPath =
        domain.includes('factcheck') ||
        item.url.toLowerCase().includes('factcheck') ||
        item.title.toLowerCase().includes('fact check') ||
        (item.content || '').toLowerCase().includes('pib fact check');

      if (!isPib || !isFactCheckPath) {
        continue;
      }

      // Check lexical relevance between user claim and retrieved PIB fact check
      const combinedText = `${item.title} ${item.content || ''} ${item.raw_content || ''}`.toLowerCase();
      let matches = 0;
      for (const kw of keywords) {
        if (combinedText.includes(kw)) {
          matches++;
        }
      }

      // At least 2 significant keywords or >= 50% overlap must match to prevent false positives
      const requiredMatches = Math.min(2, Math.ceil(keywords.length * 0.4));
      if (matches >= requiredMatches) {
        const finding = parsePibFinding(combinedText);

        return {
          hasOfficialFactCheck: true,
          factCheckUrl: validation.safeUrl || item.url,
          headline: item.title,
          publishedDate: item.published_date || undefined,
          officialFinding: finding,
          officialSummary: (item.content || '').slice(0, 300).trim(),
          checkedClaimStatement: item.title.replace(/^PIB Fact Check:?\s*/i, '').trim(),
          officialAuthority: 'Press Information Bureau (PIB) Fact Check Unit, Government of India',
          isOfficialPibRelease: true,
          disclaimer: PIB_NON_AFFILIATION_DISCLAIMER,
          portalReferenceUrl: validation.safeUrl || item.url,
        };
      }
    }

    return baseResponse;
  } catch (err: any) {
    // On search failure or rate limit, report honest limitation without fabricating results
    console.warn('[GovVerify AI] PIB Fact Check discovery notice:', err.message || err);
    return baseResponse;
  }
}
