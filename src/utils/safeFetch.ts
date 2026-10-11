/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Safe API Fetch & Error Sanitization Utility
 * Resilient against non-JSON error payloads, Vercel edge 404/500 responses,
 * and content-type mismatches to prevent syntax parsing exceptions.
 */

import { resolveApiUrl } from './apiUrl';

export interface SafeFetchResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

/**
 * Safely executes a fetch request to the GovVerify API.
 * 
 * Guarantees:
 * 1. Automatic API URL resolution using resolveApiUrl.
 * 2. Strict Content-Type inspection before parsing JSON.
 * 3. Graceful handling of non-JSON responses (HTML/text 404s, 500s from Vercel edge/lambdas).
 * 4. Never throws SyntaxError: Unexpected token '<' or 'T'.
 * 5. Sanitized, informative error strings that don't leak internal traces.
 */
export async function safeFetchJson<T = any>(
  input: string,
  init?: RequestInit
): Promise<SafeFetchResponse<T>> {
  const resolvedUrl = resolveApiUrl(input);

  let res: Response;
  try {
    res = await fetch(resolvedUrl, init);
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: `Network error: Unable to connect to verification service (${err?.message || 'Connection failed'}). Please check your connection.`,
    };
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  const isJson = contentType.includes('application/json');

  if (isJson) {
    try {
      const data = await res.json();
      if (!res.ok) {
        const errorMsg =
          data?.message ||
          data?.error ||
          `API request failed with status ${res.status}.`;
        return {
          ok: false,
          status: res.status,
          data,
          error: errorMsg,
        };
      }
      return {
        ok: true,
        status: res.status,
        data,
        error: null,
      };
    } catch {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: `Invalid response: Expected JSON from server but received malformed payload (HTTP ${res.status}).`,
      };
    }
  }

  // Non-JSON response received (e.g., Vercel edge routing 404/500, HTML gateway error)
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    // Ignore text reading failure
  }

  const cleanPreview = rawText.trim().replace(/\s+/g, ' ').slice(0, 120);

  let sanitizedError = `Server returned non-JSON response (HTTP ${res.status}).`;
  if (res.status === 404) {
    sanitizedError = `API endpoint not found (HTTP 404). Please ensure the API serverless route is deployed and configured.`;
  } else if (res.status === 500) {
    sanitizedError = `API internal error (HTTP 500). Serverless execution failed. Please check server logs.`;
  } else if (res.status === 502 || res.status === 503 || res.status === 504) {
    sanitizedError = `API gateway unavailable (HTTP ${res.status}). The verification backend is temporarily unreachable.`;
  }

  // Append safe preview if it contains useful hints without leaking HTML DOM
  if (cleanPreview && !cleanPreview.startsWith('<!DOCTYPE') && !cleanPreview.startsWith('<html') && !cleanPreview.includes('<body')) {
    sanitizedError += ` Server message: ${cleanPreview}`;
  }

  return {
    ok: false,
    status: res.status,
    data: null,
    error: sanitizedError,
  };
}

/**
 * Convenience wrapper that throws an Error if the API request fails,
 * while guaranteeing the thrown error message is clean and sanitized (never a SyntaxError).
 */
export async function fetchJsonOrThrow<T = any>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const result = await safeFetchJson<T>(input, init);
  if (!result.ok) {
    throw new Error(result.error || `Request failed with HTTP status ${result.status}.`);
  }
  return result.data as T;
}
