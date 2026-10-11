/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — API URL Resolution Utility
 * Supports both same-origin deployments (Vercel Serverless Functions)
 * and decoupled cross-origin backend deployments (e.g., Render, Railway, Fly.io).
 */

export function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const env = (typeof import.meta !== 'undefined' && (import.meta as any)?.env) || {};
  const base = env.VITE_API_BASE_URL ? String(env.VITE_API_BASE_URL).trim().replace(/\/+$/, '') : '';
  
  if (!base) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
