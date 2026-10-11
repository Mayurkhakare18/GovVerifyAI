/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { apiRouter } from './src/server/routes/api';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Basic security and parsing middleware
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // CORS middleware for API access
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Guest-Token');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Mount API Router at /api
  // Routes: /api/health and /api/v1/*
  app.use('/api', apiRouter);

  // Global API 404 handler for undefined /api routes
  app.use('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'ENDPOINT_NOT_FOUND',
      message: 'The requested API route does not exist.',
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const port = isProduction ? parseInt(process.env.PORT || '3000', 10) : 3000;

  if (!isProduction) {
    // Development mode: Mount Vite dev server middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log(`[GovVerify AI] Mounted Vite middleware in development mode`);
  } else {
    // Production mode: Serve static assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log(`[GovVerify AI] Serving production build from ${distPath}`);
  }

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Server Error]', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected internal server error occurred.',
    });
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`[GovVerify AI] Backend Server active on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('[GovVerify AI] Fatal server startup error:', err);
  process.exit(1);
});
