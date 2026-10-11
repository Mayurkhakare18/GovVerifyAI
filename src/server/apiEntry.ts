/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Vercel Serverless Function API Entrypoint
 * Bridges Express API routing to Vercel Serverless Function execution.
 * Handles edge proxy rewrites, URL normalization, CORS, and guarantees JSON responses.
 */

import express, { Request, Response, NextFunction } from 'express';
import { apiRouter } from './routes/api';

export const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS headers for production and staging deployments
app.use((req: Request, res: Response, next: NextFunction) => {
  const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || '*';
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Guest-Token');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Vercel Serverless Routing Normalization Middleware:
// When Vercel rewrites incoming requests (e.g. /api/(.*) -> /api/index.js),
// the edge layer rewrites req.url while preserving the original request path
// in 'x-matched-path', 'x-forwarded-uri', or 'x-vercel-matched-path'.
// This middleware restores the intended path so Express routing operates transparently.
app.use((req: Request, _res: Response, next: NextFunction) => {
  const matchedPath =
    (req.headers['x-matched-path'] as string) ||
    (req.headers['x-forwarded-uri'] as string) ||
    (req.headers['x-vercel-matched-path'] as string);

  if (
    matchedPath &&
    (req.url === '/' ||
      req.url === '/api' ||
      req.url === '/api/index.js' ||
      req.url.startsWith('/api/index.js'))
  ) {
    const queryIndex = req.url.indexOf('?');
    const query = queryIndex !== -1 ? req.url.substring(queryIndex) : '';
    const cleanMatched = matchedPath.split('?')[0];
    req.url = cleanMatched + (query && !cleanMatched.includes('?') ? query : '');
  }

  // Normalize any direct /api/index.js prefixes
  if (req.url.startsWith('/api/index.js')) {
    req.url = req.url.replace(/^\/api\/index\.js/, '/api');
  }

  next();
});

// Root API Discovery & Status Route (Returns HTTP 200 JSON)
app.get(['/', '/api'], (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'GovVerify AI API',
    status: 'online',
    version: '1.0.0',
    description: 'Civic Claim Verification & Evidence Intelligence Engine',
    endpoints: {
      health: '/api/health',
      authMe: '/api/v1/auth/me',
      verify: '/api/v1/verify',
      history: '/api/v1/history',
      sources: '/api/v1/sources',
      documents: '/api/v1/documents/extract',
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount router at both '/api' and '/' to ensure matching regardless of edge path stripping
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global 404 for unmatched API routes — ALWAYS return JSON, never HTML
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'ENDPOINT_NOT_FOUND',
    message: 'The requested API endpoint was not found.',
  });
});

// Global error handler — ALWAYS return JSON
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Vercel Serverless Error]', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal server error occurred.',
  });
});

// Default function handler for Vercel Node runtime
export default function handler(req: Request, res: Response) {
  return app(req, res);
}
