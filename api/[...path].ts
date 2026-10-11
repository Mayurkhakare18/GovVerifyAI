/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Vercel Catch-All Serverless Route Handler
 * Dispatches all /api/* subpath requests to the Express application.
 */

import { Request, Response } from 'express';
import { app } from './index';

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
