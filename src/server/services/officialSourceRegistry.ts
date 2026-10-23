/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Sovereign Official-Source Registry
 * Enforces strict government domain trust, source classification hierarchies,
 * safe hostname validation, and SSRF/lookalike domain protections.
 */

export type OfficialSourceClassification =
  | 'PRIMARY_LEGAL_RECORD'       // e-Gazette, statutory notifications, acts, official rules
  | 'OFFICIAL_FACT_CHECK'        // Published PIB Fact Check findings, ministry debunking alerts
  | 'OFFICIAL_PRESS_RELEASE'     // Press Information Bureau (PIB) releases, official ministry press releases
  | 'STATUTORY_REGULATORY'       // Apex statutory and regulatory directives (RBI, SEBI, IRDAI, EPFO, UIDAI)
  | 'OFFICIAL_ADMINISTRATIVE_PORTAL' // Central & State government portals (*.gov.in, *.nic.in)
  | 'UNTRUSTED_OR_SECONDARY';    // Non-governmental, commercial, social, or unverified secondary domain

export interface OfficialRegistryEntry {
  domain: string;
  name: string;
  issuingAuthority: string;
  classification: OfficialSourceClassification;
  authorityRationale: string;
  tier: 1 | 2 | 3 | 4;
  allowSubdomains?: boolean;
}

export interface UrlValidationResult {
  isValid: boolean;
  safeUrl?: string;
  hostname?: string;
  rejectionReason?: string;
  isOfficial: boolean;
  classification: OfficialSourceClassification;
  tier: 1 | 2 | 3 | 4;
  issuingAuthority?: string;
  authorityRationale?: string;
}

/**
 * Sovereign Indian Government Source Registry
 * Documented authoritative repositories with clear legal/administrative rationale.
 */
const DEFAULT_OFFICIAL_REGISTRY: OfficialRegistryEntry[] = [
  // 1. PRIMARY LEGAL & STATUTORY RECORDS
  {
    domain: 'egazette.gov.in',
    name: 'The Gazette of India (e-Gazette)',
    issuingAuthority: 'Department of Publication, Ministry of Housing and Urban Affairs',
    classification: 'PRIMARY_LEGAL_RECORD',
    authorityRationale: 'Official legal gazette of the Government of India publishing statutory notifications, acts, and orders.',
    tier: 1,
    allowSubdomains: true,
  },
  {
    domain: 'indiacode.nic.in',
    name: 'India Code Legislative Repository',
    issuingAuthority: 'Legislative Department, Ministry of Law and Justice',
    classification: 'PRIMARY_LEGAL_RECORD',
    authorityRationale: 'Official digital repository of all Central and State legislative enactments and subordinate rules.',
    tier: 1,
    allowSubdomains: true,
  },
  {
    domain: 'sci.gov.in',
    name: 'Supreme Court of India Official Repository',
    issuingAuthority: 'Supreme Court of India',
    classification: 'PRIMARY_LEGAL_RECORD',
    authorityRationale: 'Apex judicial authority of the Republic of India; primary source for binding judgments and orders.',
    tier: 2,
    allowSubdomains: true,
  },

  // 2. OFFICIAL FACT-CHECK REPOSITORIES
  {
    domain: 'factcheck.pib.gov.in',
    name: 'PIB Fact Check Unit',
    issuingAuthority: 'Press Information Bureau (PIB), Ministry of Information and Broadcasting',
    classification: 'OFFICIAL_FACT_CHECK',
    authorityRationale: 'Official nodal agency of the Government of India mandated to verify government-related viral claims.',
    tier: 1,
    allowSubdomains: true,
  },

  // 3. OFFICIAL PRESS RELEASES & NOTIFICATIONS
  {
    domain: 'pib.gov.in',
    name: 'Press Information Bureau (PIB)',
    issuingAuthority: 'Press Information Bureau, Ministry of Information and Broadcasting',
    classification: 'OFFICIAL_PRESS_RELEASE',
    authorityRationale: 'Official nodal communications agency disseminating government decisions, cabinet notices, and releases.',
    tier: 1,
    allowSubdomains: true,
  },

  // 4. APEX STATUTORY & REGULATORY DIRECTIVES
  {
    domain: 'rbi.org.in',
    name: 'Reserve Bank of India',
    issuingAuthority: 'Reserve Bank of India (RBI)',
    classification: 'STATUTORY_REGULATORY',
    authorityRationale: 'Central statutory banking regulator governing monetary policy, currency notifications, and banking circulars.',
    tier: 2,
    allowSubdomains: true,
  },
  {
    domain: 'sebi.gov.in',
    name: 'Securities and Exchange Board of India',
    issuingAuthority: 'Securities and Exchange Board of India (SEBI)',
    classification: 'STATUTORY_REGULATORY',
    authorityRationale: 'Statutory capital markets regulator issuing binding circulars, master directions, and fraud warnings.',
    tier: 2,
    allowSubdomains: true,
  },
  {
    domain: 'epfindia.gov.in',
    name: "Employees' Provident Fund Organisation",
    issuingAuthority: "Employees' Provident Fund Organisation (EPFO), Ministry of Labour and Employment",
    classification: 'STATUTORY_REGULATORY',
    authorityRationale: 'Statutory social security body administering pension, provident fund rules, and contribution circulars.',
    tier: 1,
    allowSubdomains: true,
  },
  {
    domain: 'uidai.gov.in',
    name: 'Unique Identification Authority of India',
    issuingAuthority: 'UIDAI, Ministry of Electronics and Information Technology',
    classification: 'STATUTORY_REGULATORY',
    authorityRationale: 'Statutory authority governing Aadhaar authentication regulations, fees, and identity guidelines.',
    tier: 1,
    allowSubdomains: true,
  },
  {
    domain: 'irdai.gov.in',
    name: 'Insurance Regulatory and Development Authority of India',
    issuingAuthority: 'IRDAI, Ministry of Finance',
    classification: 'STATUTORY_REGULATORY',
    authorityRationale: 'Statutory insurance regulatory body issuing directives, scheme guidelines, and policyholder circulars.',
    tier: 2,
    allowSubdomains: true,
  },
  {
    domain: 'pfrda.org.in',
    name: 'Pension Fund Regulatory and Development Authority',
    issuingAuthority: 'PFRDA, Ministry of Finance',
    classification: 'STATUTORY_REGULATORY',
    authorityRationale: 'Statutory pension regulator administering National Pension System (NPS) and APY scheme rules.',
    tier: 2,
    allowSubdomains: true,
  },

  // 5. NATIONAL PUBLIC BROADCASTERS & OFFICIAL NEWS AGENCIES
  {
    domain: 'ddnews.gov.in',
    name: 'DD News (Doordarshan)',
    issuingAuthority: 'Prasar Bharati / Ministry of Information and Broadcasting',
    classification: 'OFFICIAL_PRESS_RELEASE',
    authorityRationale: 'National public television broadcaster operating under Prasar Bharati.',
    tier: 3,
    allowSubdomains: true,
  },
  {
    domain: 'newsonair.gov.in',
    name: 'All India Radio (News on AIR)',
    issuingAuthority: 'Prasar Bharati / Ministry of Information and Broadcasting',
    classification: 'OFFICIAL_PRESS_RELEASE',
    authorityRationale: 'National public radio broadcaster operating under Prasar Bharati.',
    tier: 3,
    allowSubdomains: true,
  },
  {
    domain: 'airnews.gov.in',
    name: 'All India Radio News',
    issuingAuthority: 'Prasar Bharati / Ministry of Information and Broadcasting',
    classification: 'OFFICIAL_PRESS_RELEASE',
    authorityRationale: 'National public radio broadcasting network under Prasar Bharati.',
    tier: 3,
    allowSubdomains: true,
  },

  // 6. SOVEREIGN ADMINISTRATIVE & CITIZEN PORTALS
  {
    domain: 'india.gov.in',
    name: 'National Portal of India',
    issuingAuthority: 'National Informatics Centre (NIC), MeitY',
    classification: 'OFFICIAL_ADMINISTRATIVE_PORTAL',
    authorityRationale: 'Primary sovereign portal aggregating government schemes, ministry directories, and citizen services.',
    tier: 1,
    allowSubdomains: true,
  },
  {
    domain: 'mygov.in',
    name: 'MyGov India Citizen Engagement Portal',
    issuingAuthority: 'MyGov, Ministry of Electronics and Information Technology',
    classification: 'OFFICIAL_ADMINISTRATIVE_PORTAL',
    authorityRationale: 'Official citizen engagement platform publishing scheme updates and government infographics.',
    tier: 1,
    allowSubdomains: true,
  },
  {
    domain: 'pmkisan.gov.in',
    name: 'PM-KISAN Official Scheme Portal',
    issuingAuthority: 'Department of Agriculture & Farmers Welfare',
    classification: 'OFFICIAL_ADMINISTRATIVE_PORTAL',
    authorityRationale: 'Official nodal portal for Pradhan Mantri Kisan Samman Nidhi scheme operational guidelines.',
    tier: 1,
    allowSubdomains: true,
  },
  {
    domain: 'pmkusum.mnre.gov.in',
    name: 'PM-KUSUM Scheme Portal',
    issuingAuthority: 'Ministry of New and Renewable Energy (MNRE)',
    classification: 'OFFICIAL_ADMINISTRATIVE_PORTAL',
    authorityRationale: 'Official scheme website for Pradhan Mantri Kisan Urja Suraksha evam Utthaan Mahabhiyan.',
    tier: 1,
    allowSubdomains: true,
  },
  {
    domain: 'mnre.gov.in',
    name: 'Ministry of New and Renewable Energy',
    issuingAuthority: 'Ministry of New and Renewable Energy (MNRE)',
    classification: 'OFFICIAL_ADMINISTRATIVE_PORTAL',
    authorityRationale: 'Union ministry portal issuing solar scheme guidelines, subsidies, and advisory notices.',
    tier: 1,
    allowSubdomains: true,
  },
  {
    domain: 'incometax.gov.in',
    name: 'Income Tax Department e-Filing Portal',
    issuingAuthority: 'Central Board of Direct Taxes (CBDT), Ministry of Finance',
    classification: 'OFFICIAL_ADMINISTRATIVE_PORTAL',
    authorityRationale: 'Official revenue portal for statutory direct tax notifications, deadlines, and circulars.',
    tier: 1,
    allowSubdomains: true,
  },
  {
    domain: 'standupmitra.in',
    name: 'Stand-Up India Portal (SIDBI)',
    issuingAuthority: 'Small Industries Development Bank of India (SIDBI) / Ministry of Finance',
    classification: 'STATUTORY_REGULATORY',
    authorityRationale: 'Official nodal portal established under statutory mandate of Ministry of Finance for Stand-Up India entrepreneurship loans.',
    tier: 2,
    allowSubdomains: true,
  },
  {
    domain: 'mudra.org.in',
    name: 'Micro Units Development and Refinance Agency (MUDRA)',
    issuingAuthority: 'MUDRA / Department of Financial Services, Ministry of Finance',
    classification: 'STATUTORY_REGULATORY',
    authorityRationale: 'Statutory financial institution set up by Government of India for refinancing micro-enterprise loans under PMMY.',
    tier: 2,
    allowSubdomains: true,
  },
];

// Runtime mutable registry allowing runtime configuration updates
let registryEntries: OfficialRegistryEntry[] = [...DEFAULT_OFFICIAL_REGISTRY];

/**
 * Returns the currently active registry of official source entries.
 */
export function getOfficialRegistry(): OfficialRegistryEntry[] {
  return [...registryEntries];
}

/**
 * Registers or updates an official sovereign domain in the registry.
 */
export function registerOfficialDomain(entry: OfficialRegistryEntry): void {
  const normalizedDomain = entry.domain.trim().toLowerCase();
  const existingIdx = registryEntries.findIndex((e) => e.domain === normalizedDomain);
  if (existingIdx >= 0) {
    registryEntries[existingIdx] = { ...entry, domain: normalizedDomain };
  } else {
    registryEntries.push({ ...entry, domain: normalizedDomain });
  }
}

/**
 * Resets registry to default configuration (useful for test isolation).
 */
export function resetOfficialRegistry(): void {
  registryEntries = [...DEFAULT_OFFICIAL_REGISTRY];
}

/**
 * Returns a deduplicated array of domains optimized for Tavily search filtering (`include_domains`).
 */
export function getOfficialSearchDomains(): string[] {
  const baseDomains = [
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

  for (const entry of registryEntries) {
    if (!baseDomains.includes(entry.domain)) {
      baseDomains.push(entry.domain);
    }
  }

  return baseDomains;
}

/**
 * Evaluates whether a given IP address is private, loopback, link-local, or metadata address (SSRF guard).
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const trimmed = ip.trim().replace(/^\[|\]$/g, '');

  // IPv4 & Hostname Loopback
  if (
    trimmed === 'localhost' ||
    trimmed === '127.0.0.1' ||
    trimmed.startsWith('127.') ||
    trimmed === '0.0.0.0'
  ) {
    return true;
  }

  // IPv4 Private RFC1918 (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  if (
    trimmed.startsWith('10.') ||
    trimmed.startsWith('192.168.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(trimmed)
  ) {
    return true;
  }

  // Cloud Instance Metadata Service & Link-Local (169.254.0.0/16)
  if (trimmed.startsWith('169.254.') || trimmed === '169.254.169.254') {
    return true;
  }

  // Carrier-Grade NAT (100.64.0.0/10)
  if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(trimmed)) {
    return true;
  }

  // IPv6 Loopback, Link-Local, and Unique Local
  if (
    trimmed === '::1' ||
    trimmed === '::' ||
    trimmed.toLowerCase().startsWith('fe80:') ||
    trimmed.toLowerCase().startsWith('fc00:') ||
    trimmed.toLowerCase().startsWith('fd00:')
  ) {
    return true;
  }

  // Cloud metadata hostnames
  if (
    trimmed.includes('metadata.google.internal') ||
    trimmed.includes('metadata.internal')
  ) {
    return true;
  }

  return false;
}

/**
 * Validates a candidate URL against strict sovereign authority constraints:
 * - Scheme must be http or https
 * - Disallows credentials in URL (user:pass@host)
 * - Guards against SSRF (no loopback, private RFC1918, link-local, or cloud metadata IPs)
 * - Guards against lookalike domains (e.g. pib.gov.in.fraudulent-domain.com or fake-gov.in)
 * - Returns classified source category, authority rationale, and trust tier.
 */
export function validateAndClassifyUrl(rawUrl: string): UrlValidationResult {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    return {
      isValid: false,
      rejectionReason: 'URL is missing or empty',
      isOfficial: false,
      classification: 'UNTRUSTED_OR_SECONDARY',
      tier: 4,
    };
  }

  const trimmed = rawUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isValid: false,
      rejectionReason: 'Invalid URL syntax',
      isOfficial: false,
      classification: 'UNTRUSTED_OR_SECONDARY',
      tier: 4,
    };
  }

  // 1. Enforce HTTP/HTTPS scheme
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      rejectionReason: `Prohibited URL protocol: ${parsed.protocol}. Only http and https are permitted.`,
      isOfficial: false,
      classification: 'UNTRUSTED_OR_SECONDARY',
      tier: 4,
    };
  }

  // 2. Reject credentials in URL
  if (parsed.username || parsed.password) {
    return {
      isValid: false,
      rejectionReason: 'URL contains embedded authentication credentials.',
      isOfficial: false,
      classification: 'UNTRUSTED_OR_SECONDARY',
      tier: 4,
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 3. Reject SSRF targets (Private IPs, Link-Local, Cloud Metadata)
  if (isPrivateOrReservedIp(hostname)) {
    return {
      isValid: false,
      rejectionReason: 'URL resolves to a private, loopback, or cloud metadata IP address (SSRF prevention).',
      isOfficial: false,
      classification: 'UNTRUSTED_OR_SECONDARY',
      tier: 4,
    };
  }

  // 4. Reject Punycode / IDN homoglyph spoofing
  if (hostname.includes('xn--')) {
    return {
      isValid: false,
      rejectionReason: 'Internationalized domain names (Punycode) are not recognized as sovereign Indian government portals.',
      isOfficial: false,
      classification: 'UNTRUSTED_OR_SECONDARY',
      tier: 4,
    };
  }

  // 5. Look up against Official Registry Entries with boundary matching
  // Prevents deceptive subdomain attacks like "pib.gov.in.attacker.com"
  for (const entry of registryEntries) {
    const d = entry.domain.toLowerCase();
    const isExactMatch = hostname === d;
    const isSubdomainMatch = entry.allowSubdomains !== false && hostname.endsWith(`.${d}`);

    if (isExactMatch || isSubdomainMatch) {
      return {
        isValid: true,
        safeUrl: `${parsed.protocol}//${hostname}${parsed.pathname}${parsed.search}`,
        hostname,
        isOfficial: true,
        classification: entry.classification,
        tier: entry.tier,
        issuingAuthority: entry.issuingAuthority,
        authorityRationale: entry.authorityRationale,
      };
    }
  }

  // 6. Generic Sovereign Suffix Rule (*.gov.in, *.nic.in)
  // Strict boundary check: hostname MUST end with .gov.in or .nic.in
  const isGovIn = hostname.endsWith('.gov.in');
  const isNicIn = hostname.endsWith('.nic.in');

  if (isGovIn || isNicIn) {
    let classification: OfficialSourceClassification = 'OFFICIAL_ADMINISTRATIVE_PORTAL';
    let issuingAuthority = 'Government of India';
    let rationale = 'Official sovereign portal verified by National Informatics Centre (NIC) domain governance.';

    if (hostname.includes('pib.gov.in')) {
      classification = 'OFFICIAL_PRESS_RELEASE';
      issuingAuthority = 'Press Information Bureau (PIB), Ministry of Information and Broadcasting';
      rationale = 'Official nodal communications agency of the Government of India.';
    } else if (hostname.includes('egazette.gov.in')) {
      classification = 'PRIMARY_LEGAL_RECORD';
      issuingAuthority = 'The Gazette of India (Department of Publication)';
      rationale = 'Official legal gazette publishing statutory enactments and circulars.';
    }

    return {
      isValid: true,
      safeUrl: `${parsed.protocol}//${hostname}${parsed.pathname}${parsed.search}`,
      hostname,
      isOfficial: true,
      classification,
      tier: 1,
      issuingAuthority,
      authorityRationale: rationale,
    };
  }

  // 7. Non-governmental / Untrusted Domain (Tier 4)
  return {
    isValid: true, // syntactically valid URL, but untrusted for official evidence
    safeUrl: `${parsed.protocol}//${hostname}${parsed.pathname}${parsed.search}`,
    hostname,
    isOfficial: false,
    classification: 'UNTRUSTED_OR_SECONDARY',
    tier: 4,
    rejectionReason: 'Domain is not registered as an authoritative sovereign Indian government source.',
  };
}
