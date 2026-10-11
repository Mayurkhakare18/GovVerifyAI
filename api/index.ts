/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Vercel Serverless Function API Entrypoint
 * Bridges Express API routing to Vercel Serverless Function execution.
 */

import express, { Request, Response, NextFunction } from 'express';
import { apiRouter } from '../src/server/routes/api';

const app = express();

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

// Mount API router at /api and root / to support direct invocations and rewrites
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global 404 for unmatched API routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: 'ENDPOINT_NOT_FOUND',
    message: 'The requested API endpoint was not found.',
  });
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Vercel Serverless Error]', err);
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal server error occurred.',
  });
});

export default app;
