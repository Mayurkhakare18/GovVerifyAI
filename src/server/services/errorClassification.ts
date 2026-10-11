/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Operational Error Classification & Sanitization Service
 * Standardized failure taxonomy, provider error resolution, allowlist-based sanitization,
 * and retryability classification for sovereign verification pipelines.
 */

export const FAILURE_TAXONOMY = [
  'QUOTA_EXHAUSTED',
  'RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'DISCOVERY_FAILED',
  'NO_VERIFIED_SOURCES',
  'DATABASE_ERROR',
  'INVALID_REQUEST',
  'ANALYSIS_FAILED',
  'TIMEOUT',
  'UNKNOWN',
] as const;

export type FailureReason = (typeof FAILURE_TAXONOMY)[number];

export interface ClassifiedError {
  failureReason: FailureReason;
  provider: 'gemini' | 'tavily' | 'supabase' | 'internal' | 'unknown';
  httpStatus?: number;
  isRetryable: boolean;
  safeMessage: string;
  suggestedBackoffSeconds?: number;
  sanitizedDetails: Record<string, any>;
}

export interface ErrorClassificationContext {
  phase: 'DISCOVERY' | 'VERDICT' | 'DATABASE' | 'INTAKE' | 'DOCUMENT';
  provider?: string;
  requestId?: string;
  attemptNumber?: number;
  httpStatus?: number;
  headers?: Record<string, string | string[] | undefined>;
}

/**
 * Sensitive patterns that must NEVER be persisted or exposed in operational telemetry.
 */
const SENSITIVE_PATTERNS = [
  /api[-_]?key[=:\s]+[A-Za-z0-9_\-\.]{8,}/gi,
  /bearer\s+[A-Za-z0-9_\-\.]{15,}/gi,
  /service[-_]?role[=:\s]+[A-Za-z0-9_\-\.]{15,}/gi,
  /secret[=:\s]+[A-Za-z0-9_\-\.]{8,}/gi,
  /password[=:\s]+[^\s,;&]+/gi,
  /postgres(ql)?:\/\/[^\s]+/gi,
  /https?:\/\/[^\s]*token=[^\s&]+/gi,
  /select\s+.+\s+from\s+/gi,
  /insert\s+into\s+/gi,
  /update\s+.+\s+set\s+/gi,
  /delete\s+from\s+/gi,
];

/**
 * Allowlisted detail property keys permitted in sanitized operational telemetry.
 */
const ALLOWED_DETAIL_KEYS = new Set([
  'provider',
  'phase',
  'httpStatus',
  'errorCode',
  'attemptNumber',
  'isRetryable',
  'retryAfterSeconds',
  'durationMs',
  'groundingStatus',
  'sourcesEvaluated',
  'quotaResetTime',
]);

/**
 * Sanitizes arbitrary strings by removing sensitive tokens, credentials, and SQL statements.
 * Enforces a strict length bound of 200 characters.
 */
export function sanitizeMessage(raw: unknown, maxLength: number = 200): string {
  if (!raw) return 'Operation could not be completed.';
  let text = typeof raw === 'string' ? raw : String((raw as any)?.message || raw);

  // Redact known sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    text = text.replace(pattern, '[REDACTED]');
  }

  // Strip file system paths and stack traces
  text = text.replace(/(\/[a-zA-Z0-9_\-\.]+)+/g, '[PATH]');
  text = text.replace(/([a-zA-Z]:\\[a-zA-Z0-9_\-\.\\]+)/g, '[PATH]');
  text = text.replace(/at\s+([a-zA-Z0-9_<>.]+)\s+\([^)]+\)/g, '');
  text = text.replace(/\s{2,}/g, ' ').trim();

  if (text.length > maxLength) {
    return text.substring(0, maxLength - 3) + '...';
  }
  return text || 'Operation could not be completed.';
}

/**
 * Sanitizes operational telemetry details using an explicit allowlist and bounds.
 */
export function sanitizeOperationalDetails(
  details: Record<string, any> = {}
): Record<string, any> {
  const sanitized: Record<string, any> = {};

  for (const [key, val] of Object.entries(details)) {
    if (!ALLOWED_DETAIL_KEYS.has(key)) {
      continue;
    }

    if (typeof val === 'string') {
      sanitized[key] = sanitizeMessage(val, 100);
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      sanitized[key] = val;
    } else if (val === null || val === undefined) {
      sanitized[key] = null;
    }
  }

  return sanitized;
}

/**
 * Resolves standard HTTP Retry-After header values (seconds or HTTP date).
 */
export function parseRetryAfterHeader(
  headers?: Record<string, string | string[] | undefined>
): number | undefined {
  if (!headers) return undefined;

  const headerVal = headers['retry-after'] || headers['Retry-After'];
  if (!headerVal) return undefined;

  const valStr = Array.isArray(headerVal) ? headerVal[0] : headerVal;
  if (!valStr) return undefined;

  // Numeric seconds format
  const seconds = parseInt(valStr, 10);
  if (!isNaN(seconds) && seconds > 0 && seconds <= 86400) {
    return seconds;
  }

  // HTTP Date format
  const parsedDate = Date.parse(valStr);
  if (!isNaN(parsedDate)) {
    const diffSec = Math.ceil((parsedDate - Date.now()) / 1000);
    if (diffSec > 0 && diffSec <= 86400) {
      return diffSec;
    }
  }

  return undefined;
}

/**
 * Centralized error classifier for all GovVerify AI operational failures.
 */
export function classifyError(
  err: unknown,
  context: ErrorClassificationContext
): ClassifiedError {
  const errorObj = err as any;
  const message = (errorObj?.message || String(err || '')).toLowerCase();
  const explicitStatus = context.httpStatus || errorObj?.status || errorObj?.statusCode;
  const provider = (context.provider || 'internal') as ClassifiedError['provider'];
  const retryAfter = parseRetryAfterHeader(context.headers);

  // 1. RATE LIMIT & QUOTA EXHAUSTION (HTTP 429)
  if (explicitStatus === 429 || message.includes('429') || message.includes('quota') || message.includes('rate limit')) {
    const isDailyQuota =
      message.includes('resource_exhausted') ||
      message.includes('daily') ||
      message.includes('monthly') ||
      message.includes('quota exceeded');

    if (isDailyQuota) {
      return {
        failureReason: 'QUOTA_EXHAUSTED',
        provider,
        httpStatus: 429,
        isRetryable: false, // Daily quota cannot be resolved by immediate retries
        suggestedBackoffSeconds: 3600 * 6, // Defer to long backoff
        safeMessage: 'Provider verification quota limit was reached. Immediate retries deferred.',
        sanitizedDetails: sanitizeOperationalDetails({
          provider,
          phase: context.phase,
          httpStatus: 429,
          errorCode: 'QUOTA_EXHAUSTED',
          attemptNumber: context.attemptNumber || 1,
          isRetryable: false,
          retryAfterSeconds: retryAfter || 3600 * 6,
        }),
      };
    }

    return {
      failureReason: 'RATE_LIMITED',
      provider,
      httpStatus: 429,
      isRetryable: true,
      suggestedBackoffSeconds: retryAfter || 30,
      safeMessage: 'Verification search rate limit encountered. Safe backoff scheduled.',
      sanitizedDetails: sanitizeOperationalDetails({
        provider,
        phase: context.phase,
        httpStatus: 429,
        errorCode: 'RATE_LIMITED',
        attemptNumber: context.attemptNumber || 1,
        isRetryable: true,
        retryAfterSeconds: retryAfter || 30,
      }),
    };
  }

  // 2. TIMEOUT
  if (
    message.includes('timeout') ||
    message.includes('etimedout') ||
    message.includes('abort') ||
    message.includes('deadline exceeded')
  ) {
    return {
      failureReason: 'TIMEOUT',
      provider,
      httpStatus: 504,
      isRetryable: true,
      suggestedBackoffSeconds: 15,
      safeMessage: 'Sovereign endpoint verification check timed out.',
      sanitizedDetails: sanitizeOperationalDetails({
        provider,
        phase: context.phase,
        httpStatus: 504,
        errorCode: 'TIMEOUT',
        attemptNumber: context.attemptNumber || 1,
        isRetryable: true,
      }),
    };
  }

  // 3. PROVIDER UNAVAILABLE (502 / 503 / 504 / Service Unavailable)
  if (
    explicitStatus === 502 ||
    explicitStatus === 503 ||
    explicitStatus === 504 ||
    message.includes('unavailable') ||
    message.includes('service error') ||
    message.includes('econnrefused') ||
    message.includes('econnreset')
  ) {
    return {
      failureReason: 'PROVIDER_UNAVAILABLE',
      provider,
      httpStatus: explicitStatus || 503,
      isRetryable: true,
      suggestedBackoffSeconds: 20,
      safeMessage: 'Sovereign search gateway was temporarily unavailable.',
      sanitizedDetails: sanitizeOperationalDetails({
        provider,
        phase: context.phase,
        httpStatus: explicitStatus || 503,
        errorCode: 'PROVIDER_UNAVAILABLE',
        attemptNumber: context.attemptNumber || 1,
        isRetryable: true,
      }),
    };
  }

  // 4. INVALID CREDENTIALS / FORBIDDEN / BAD REQUEST (Non-retryable)
  if (
    explicitStatus === 401 ||
    explicitStatus === 403 ||
    message.includes('unauthorized') ||
    message.includes('forbidden') ||
    message.includes('invalid api key') ||
    message.includes('unconfigured')
  ) {
    return {
      failureReason: 'PROVIDER_UNAVAILABLE',
      provider,
      httpStatus: explicitStatus || 403,
      isRetryable: false,
      safeMessage: 'Search provider credentials are not configured or rejected.',
      sanitizedDetails: sanitizeOperationalDetails({
        provider,
        phase: context.phase,
        httpStatus: explicitStatus || 403,
        errorCode: 'CREDENTIALS_REJECTED',
        attemptNumber: context.attemptNumber || 1,
        isRetryable: false,
      }),
    };
  }

  // 5. DATABASE ERROR
  if (
    context.phase === 'DATABASE' ||
    message.includes('postgres') ||
    message.includes('supabase') ||
    message.includes('relation') ||
    message.includes('connection refused')
  ) {
    return {
      failureReason: 'DATABASE_ERROR',
      provider: 'supabase',
      isRetryable: true,
      suggestedBackoffSeconds: 10,
      safeMessage: 'Database connection or query error encountered.',
      sanitizedDetails: sanitizeOperationalDetails({
        provider: 'supabase',
        phase: context.phase,
        errorCode: 'DATABASE_ERROR',
        attemptNumber: context.attemptNumber || 1,
        isRetryable: true,
      }),
    };
  }

  // 6. INVALID REQUEST INPUT
  if (
    explicitStatus === 400 ||
    message.includes('invalid_id') ||
    message.includes('no claim text') ||
    message.includes('validation error')
  ) {
    return {
      failureReason: 'INVALID_REQUEST',
      provider: 'internal',
      httpStatus: 400,
      isRetryable: false,
      safeMessage: 'Verification request statement or parameters were invalid.',
      sanitizedDetails: sanitizeOperationalDetails({
        provider: 'internal',
        phase: context.phase,
        httpStatus: 400,
        errorCode: 'INVALID_REQUEST',
        attemptNumber: context.attemptNumber || 1,
        isRetryable: false,
      }),
    };
  }

  // 7. ANALYSIS FAILED
  if (context.phase === 'VERDICT') {
    return {
      failureReason: 'ANALYSIS_FAILED',
      provider: 'internal',
      isRetryable: false,
      safeMessage: 'Verdict synthesis analysis encountered an evaluation error.',
      sanitizedDetails: sanitizeOperationalDetails({
        provider: 'internal',
        phase: 'VERDICT',
        errorCode: 'ANALYSIS_FAILED',
        attemptNumber: context.attemptNumber || 1,
        isRetryable: false,
      }),
    };
  }

  // 8. DISCOVERY FAILED
  if (context.phase === 'DISCOVERY') {
    return {
      failureReason: 'DISCOVERY_FAILED',
      provider,
      isRetryable: true,
      suggestedBackoffSeconds: 15,
      safeMessage: 'Sovereign portal search discovery encountered an issue.',
      sanitizedDetails: sanitizeOperationalDetails({
        provider,
        phase: 'DISCOVERY',
        errorCode: 'DISCOVERY_FAILED',
        attemptNumber: context.attemptNumber || 1,
        isRetryable: true,
      }),
    };
  }

  // 9. UNKNOWN FALLBACK
  return {
    failureReason: 'UNKNOWN',
    provider: 'unknown',
    isRetryable: false,
    safeMessage: 'An unexpected operational failure occurred during verification.',
    sanitizedDetails: sanitizeOperationalDetails({
      provider: 'unknown',
      phase: context.phase,
      errorCode: 'UNKNOWN',
      attemptNumber: context.attemptNumber || 1,
      isRetryable: false,
    }),
  };
}

/**
 * Checks whether a given failure taxonomy code qualifies for automated retry.
 */
export function isRetryableFailure(reason: FailureReason): boolean {
  switch (reason) {
    case 'RATE_LIMITED':
    case 'PROVIDER_UNAVAILABLE':
    case 'TIMEOUT':
    case 'DATABASE_ERROR':
    case 'DISCOVERY_FAILED':
      return true;
    case 'QUOTA_EXHAUSTED':
    case 'NO_VERIFIED_SOURCES':
    case 'INVALID_REQUEST':
    case 'ANALYSIS_FAILED':
    case 'UNKNOWN':
    default:
      return false;
  }
}
