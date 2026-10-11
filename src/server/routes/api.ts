/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import {
  getServerSupabase,
  getSupabaseConfigStatus,
  validateUserToken,
} from '../supabase';
import { getGeminiConfigStatus } from '../services/gemini';
import { getTavilyConfigStatus } from '../services/tavily';
import {
  discoverAuthoritativeSources,
  discoverAndPersistSourcesForRequest,
  DiscoveryProvider,
  getActiveDiscoveryProvider,
} from '../services/sourceDiscovery';
import {
  analyzeAndPersistVerdictForRequest,
  decomposeClaimIntoSubclaims,
  evaluateEvidenceForSubclaims,
} from '../services/verdictAnalysis';
import {
  getOrGenerateActionGuidance,
  evaluateEligibilityAnswers,
} from '../services/actionGuidance';
import multer from 'multer';
import {
  extractClaimsFromDocument,
  validateFileSignature,
  inspectPdfPageCount,
  MAX_FILE_SIZE_BYTES,
  MAX_PDF_PAGE_COUNT,
} from '../services/documentExtraction';
import { enqueueVerificationJob } from '../queue/jobQueue';
import { persistRequestTelemetry } from '../services/telemetry';

export const apiRouter = Router();

// In-memory upload middleware enforcing 10MB file limit
const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

function handleSingleFileUpload(fieldName: string) {
  const upload = uploadMiddleware.single(fieldName);
  return (req: Request, res: Response, next: NextFunction) => {
    upload(req, res, (err: any) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'FILE_TOO_LARGE',
            message: 'File size exceeds maximum allowable limit of 10 MB.',
          });
        }
        return res.status(400).json({
          error: 'FILE_UPLOAD_ERROR',
          message: err.message || 'Error parsing multipart file upload.',
        });
      }
      next();
    });
  };
}

// ==============================================================================
// In-Memory Rate Limiter (No external redis dependency required)
// ==============================================================================
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitRecord>();

function rateLimiter(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
    const key = `${req.path}:${ip}`;
    const now = Date.now();

    const record = rateLimitStore.get(key);
    if (!record || now > record.resetTime) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= limit) {
      return res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please wait before submitting again.',
        retryAfterMs: record.resetTime - now,
      });
    }

    record.count += 1;
    next();
  };
}

// Clean up stale rate limits every 5 minutes
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

// ==============================================================================
// Authentication Middleware
// ==============================================================================
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: 'Authorization header with Bearer token is required.',
      });
    }

    const user = await validateUserToken(authHeader);
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Provided session token is invalid, expired, or revoked.',
      });
    }

    // Attach user to request
    (req as any).user = user;
    next();
  } catch (err: any) {
    return res.status(503).json({
      error: 'AUTH_SERVICE_UNAVAILABLE',
      message: err.message || 'Authentication service is unavailable.',
    });
  }
}

// Optional Auth (for endpoints that can serve both guests and authenticated users)
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const user = await validateUserToken(authHeader);
      if (user) {
        (req as any).user = user;
      }
    }
  } catch {
    // Ignore error for optional auth
  }
  next();
}

// UUID validation helper
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

// ==============================================================================
// 1. HEALTH CHECK: GET /api/health
// ==============================================================================
apiRouter.get('/health', async (_req: Request, res: Response) => {
  const status = getSupabaseConfigStatus();

  if (!status.isConfigured) {
    return res.status(200).json({
      status: 'unconfigured',
      database: 'unconfigured',
      version: 'phase-2',
      timestamp: new Date().toISOString(),
      details: {
        configured: false,
        message: status.message,
      },
    });
  }

  try {
    const supabase = getServerSupabase();
    // Perform a lightweight ping query
    const { error } = await supabase
      .from('verification_requests')
      .select('count', { count: 'exact', head: true });

    if (error) {
      return res.status(503).json({
        status: 'degraded',
        database: 'disconnected',
        version: 'phase-2',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }

    const tavilyStatus = getTavilyConfigStatus();
    const geminiStatus = getGeminiConfigStatus();
    const activeProvider = getActiveDiscoveryProvider();

    return res.status(200).json({
      status: 'healthy',
      database: 'connected',
      version: 'phase-2',
      timestamp: new Date().toISOString(),
      engine: 'Supabase PostgreSQL',
      discovery: {
        tavilyConfigured: tavilyStatus.isConfigured,
        geminiConfigured: geminiStatus.isConfigured,
        activeProvider,
      },
    });
  } catch (err: any) {
    return res.status(503).json({
      status: 'degraded',
      database: 'error',
      version: 'phase-2',
      timestamp: new Date().toISOString(),
      error: err.message || 'Database connection error',
    });
  }
});

// ==============================================================================
// 2. AUTH IDENTITY: GET /api/v1/auth/me
// ==============================================================================
apiRouter.get('/v1/auth/me', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const supabase = getServerSupabase();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      // Ignore not found, but log other database errors
      return res.status(500).json({
        error: 'PROFILE_FETCH_FAILED',
        message: error.message,
      });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        emailConfirmedAt: user.email_confirmed_at,
        lastSignInAt: user.last_sign_in_at,
      },
      profile: profile || {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
        preferred_language: 'English',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message,
    });
  }
});

// ==============================================================================
// 2.1 AUTH CONFIRMATION: POST /api/v1/auth/confirm-email
// Confirms an unconfirmed user's email using admin privileges
// ==============================================================================
apiRouter.post('/v1/auth/confirm-email', rateLimiter(10, 60 * 1000), async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({
      error: 'INVALID_INPUT',
      message: 'A valid email address is required.',
    });
  }

  try {
    const supabase = getServerSupabase();
    // Search for user in Supabase Auth
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      return res.status(500).json({
        error: 'ADMIN_AUTH_ERROR',
        message: error.message,
      });
    }

    const targetUser = data.users.find(
      (u) => u.email?.toLowerCase() === email.trim().toLowerCase()
    );

    if (!targetUser) {
      return res.status(404).json({
        error: 'USER_NOT_FOUND',
        message: `No registered account found with email: ${email.trim()}`,
      });
    }

    if (targetUser.email_confirmed_at) {
      return res.status(200).json({
        success: true,
        message: 'Email is already confirmed.',
        alreadyConfirmed: true,
      });
    }

    const { error: confirmError } = await supabase.auth.admin.updateUserById(targetUser.id, {
      email_confirm: true,
    });

    if (confirmError) {
      return res.status(500).json({
        error: 'CONFIRMATION_FAILED',
        message: confirmError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Email confirmed successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message,
    });
  }
});

// ==============================================================================
// 3. GET PROFILE: GET /api/v1/profile
// ==============================================================================
apiRouter.get('/v1/profile', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const supabase = getServerSupabase();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: error.message,
      });
    }

    return res.status(200).json({
      profile: profile || {
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email?.split('@')[0],
        preferred_language: 'English',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message,
    });
  }
});

// ==============================================================================
// 4. UPDATE PROFILE: PATCH /api/v1/profile
// ==============================================================================
apiRouter.patch('/v1/profile', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { display_name, preferred_language } = req.body;

  // Validation
  const updates: Record<string, any> = {};

  if (display_name !== undefined) {
    if (typeof display_name !== 'string' || display_name.trim().length > 60) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Display name must be a string under 60 characters.',
      });
    }
    updates.display_name = display_name.trim();
  }

  if (preferred_language !== undefined) {
    if (typeof preferred_language !== 'string' || preferred_language.trim().length > 30) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Preferred language must be a valid language string under 30 characters.',
      });
    }
    updates.preferred_language = preferred_language.trim();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({
      error: 'NO_CHANGES',
      message: 'No valid permitted fields provided for update (display_name, preferred_language).',
    });
  }

  try {
    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return res.status(500).json({
        error: 'PROFILE_UPDATE_FAILED',
        message: error.message,
      });
    }

    return res.status(200).json({
      profile: data,
      message: 'Profile updated successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message,
    });
  }
});

// ==============================================================================
// 5. SUBMIT VERIFICATION REQUEST: POST /api/v1/verify
// ==============================================================================
apiRouter.post(
  '/v1/verify',
  rateLimiter(20, 60 * 1000), // 20 requests per minute
  optionalAuth,
  async (req: Request, res: Response) => {
    const { claim, inputType = 'CLAIM', documentId } = req.body;
    const user = (req as any).user;

    // Check configuration
    const configStatus = getSupabaseConfigStatus();
    if (!configStatus.isConfigured) {
      return res.status(503).json({
        error: 'DATABASE_UNCONFIGURED',
        message:
          'Supabase database is not configured. Please supply SUPABASE_URL and SUPABASE_SECRET_KEY in the environment to persist verification requests.',
      });
    }

    // Validation
    if (!claim || typeof claim !== 'string') {
      return res.status(400).json({
        error: 'INVALID_CLAIM',
        message: 'Claim text is required and must be a string.',
      });
    }

    const trimmedClaim = claim.trim();
    if (trimmedClaim.length < 10) {
      return res.status(400).json({
        error: 'CLAIM_TOO_SHORT',
        message: 'Claim must be at least 10 characters long with verifiable details.',
      });
    }

    if (trimmedClaim.length > 2500) {
      return res.status(400).json({
        error: 'CLAIM_TOO_LONG',
        message: 'Claim exceeds maximum allowable length of 2500 characters.',
      });
    }

    if (inputType !== 'CLAIM' && inputType !== 'DOCUMENT') {
      return res.status(400).json({
        error: 'INVALID_INPUT_TYPE',
        message: "inputType must be 'CLAIM' or 'DOCUMENT'.",
      });
    }

    try {
      const supabase = getServerSupabase();

      // Validate referenced document ownership if documentId is provided
      let validatedDocumentId: string | null = null;
      if (documentId) {
        if (typeof documentId !== 'string' || !isValidUuid(documentId)) {
          return res.status(400).json({
            error: 'INVALID_DOCUMENT_ID',
            message: 'The provided documentId is not a valid UUID.',
          });
        }

        const { data: docRecord, error: docError } = await supabase
          .from('documents')
          .select('id, user_id, guest_session_token')
          .eq('id', documentId)
          .single();

        if (docError || !docRecord) {
          return res.status(404).json({
            error: 'DOCUMENT_NOT_FOUND',
            message: 'Referenced document not found or has expired.',
          });
        }

        // Ownership authorization check
        if (docRecord.user_id) {
          if (!user || user.id !== docRecord.user_id) {
            return res.status(403).json({
              error: 'FORBIDDEN',
              message: 'You do not have permission to verify claims linked to this document.',
            });
          }
        } else if (docRecord.guest_session_token) {
          const providedGuestToken =
            (req.headers['x-guest-token'] as string) ||
            req.body.guestToken ||
            (req.query.token as string);

          if (!providedGuestToken || providedGuestToken !== docRecord.guest_session_token) {
            return res.status(403).json({
              error: 'FORBIDDEN',
              message: 'A matching guest authorization token is required to verify claims from this document.',
            });
          }
        }

        validatedDocumentId = docRecord.id;
      }

      // 1. Generate secure guest session token if request is unauthenticated
      const guestSessionToken = !user ? randomBytes(32).toString('hex') : null;

      // 2. Create verification request
      const insertPayload: any = {
        user_id: user ? user.id : null,
        guest_session_token: guestSessionToken,
        input_type: validatedDocumentId ? 'DOCUMENT' : inputType,
        original_claim: trimmedClaim,
        status: 'QUEUED',
      };
      if (validatedDocumentId) {
        insertPayload.document_id = validatedDocumentId;
      }

      const { data: requestRecord, error: requestError } = await supabase
        .from('verification_requests')
        .insert(insertPayload)
        .select()
        .single();

      if (requestError || !requestRecord) {
        return res.status(500).json({
          error: 'PERSISTENCE_FAILED',
          message: requestError ? requestError.message : 'Failed to create verification request.',
        });
      }

      // 3. Insert primary atomic claim record
      const { error: claimError } = await supabase.from('claims').insert({
        verification_request_id: requestRecord.id,
        claim_text: trimmedClaim,
        claim_type: 'FACTUAL_ASSERTION',
      });

      if (claimError) {
        console.error('Warning: Failed to create atomic claim row:', claimError.message);
      }

      // If discovery provider is configured and discovery / verdict is requested
      const activeProvider = getActiveDiscoveryProvider(req.body.provider);
      const isProviderConfigured =
        activeProvider === 'tavily'
          ? getTavilyConfigStatus().isConfigured
          : getGeminiConfigStatus().isConfigured;
      let verdictResult: any = null;

      const discoveryOptions = {
        provider: req.body.provider,
        ...(req.body.discoveryOptions || {}),
      };

      if (isProviderConfigured && req.body.syncDiscover === true) {
        try {
          const discoveryResult = await discoverAndPersistSourcesForRequest(
            requestRecord.id,
            discoveryOptions
          );
          const shouldRunVerdict =
            req.body.syncVerdict === true ||
            (req.body.syncVerdict !== false && req.body.autoVerdict !== false);

          if (
            (discoveryResult && discoveryResult.hasVerifiedEvidence && shouldRunVerdict) ||
            req.body.syncVerdict === true
          ) {
            verdictResult = await analyzeAndPersistVerdictForRequest(requestRecord.id);
          }
        } catch (discErr: any) {
          console.warn('[GovVerify AI] Synchronous discovery/verdict warning:', discErr.message);
        }
      } else if (req.body.skipDiscovery !== true) {
        if (isProviderConfigured) {
          // Durable asynchronous background processing via persistent queue
          await enqueueVerificationJob(requestRecord.id, 'FULL_VERIFICATION', {
            maxAttempts: 3,
          });
        } else {
          // Record explicit telemetry when search provider is unconfigured
          await persistRequestTelemetry(requestRecord.id, {
            failureReason: 'PROVIDER_UNAVAILABLE',
            failureDetails: {
              provider: activeProvider,
              message: `${activeProvider} search integration is not configured.`,
            },
          });
        }
      }

      // Initial return status is strictly QUEUED unless synchronous verdict was requested and completed
      return res.status(201).json({
        id: requestRecord.id,
        guestToken: guestSessionToken,
        status: verdictResult ? 'COMPLETED' : 'QUEUED',
        inputType: requestRecord.input_type,
        documentId: requestRecord.document_id || null,
        originalClaim: requestRecord.original_claim,
        createdAt: requestRecord.created_at,
        isPersisted: true,
        verdict: verdictResult?.analysis?.verdict,
        confidence: verdictResult?.analysis?.confidence,
        summaryExplanation: verdictResult?.analysis?.summaryExplanation,
        subclaims: verdictResult?.analysis?.subclaims,
        citations: verdictResult?.analysis?.citations,
        message: verdictResult
          ? 'Verification completed with authoritative sovereign Indian sources.'
          : 'Verification request successfully queued in database. In Phase 3 Step 1, sovereign source discovery identifies official .gov.in portals while analytical verdicts remain pending Step 2.',
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'DATABASE_ERROR',
        message: err.message || 'Error communicating with Supabase database.',
      });
    }
  }
);

// ==============================================================================
// 6. GET VERIFICATION HISTORY: GET /api/v1/history
// ==============================================================================
apiRouter.get('/v1/history', requireAuth, async (req: Request, res: Response) => {
  const user = (req as any).user;
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
  const offset = (page - 1) * limit;

  try {
    const supabase = getServerSupabase();

    // Query requests with total count and optional filters
    let query = supabase
      .from('verification_requests')
      .select('*, claims(*), verification_results(*)', { count: 'exact' })
      .eq('user_id', user.id);

    const statusFilter = (req.query.status as string)?.trim().toUpperCase();
    if (statusFilter && statusFilter !== 'ALL') {
      query = query.eq('status', statusFilter);
    }

    const searchFilter = (req.query.search as string)?.trim();
    if (searchFilter) {
      query = query.ilike('original_claim', `%${searchFilter}%`);
    }

    const { data: requests, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({
        error: 'HISTORY_FETCH_FAILED',
        message: error.message,
      });
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      data: requests || [],
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message,
    });
  }
});

// ==============================================================================
// 7. GET SPECIFIC VERIFICATION REQUEST: GET /api/v1/verify/:id
// ==============================================================================
apiRouter.get('/v1/verify/:id', optionalAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (!isValidUuid(id)) {
    return res.status(400).json({
      error: 'INVALID_ID',
      message: 'The requested verification request ID is not a valid UUID.',
    });
  }

  try {
    const supabase = getServerSupabase();

    const { data: requestRecord, error: requestError } = await supabase
      .from('verification_requests')
      .select('*, claims(*), evidence(*, sources(*)), verification_results(*)')
      .eq('id', id)
      .single();

    if (requestError || !requestRecord) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Verification request not found.',
      });
    }

    // Ownership Authorization Check:
    // Case 1: Authenticated user owned record
    if (requestRecord.user_id) {
      if (!user || user.id !== requestRecord.user_id) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message: 'You do not have permission to view this verification record.',
        });
      }
    } else {
      // Case 2: Guest / Unauthenticated submission
      // To prevent UUID enumeration or guessing attacks across guest submissions,
      // require the matching guest token passed via X-Guest-Token header or query param.
      const providedGuestToken =
        (req.headers['x-guest-token'] as string) || (req.query.token as string);

      if (
        requestRecord.guest_session_token &&
        (!providedGuestToken || providedGuestToken !== requestRecord.guest_session_token)
      ) {
        return res.status(403).json({
          error: 'FORBIDDEN',
          message:
            'Access denied. A valid guest authorization token (X-Guest-Token header or token parameter) is required to view this submission.',
        });
      }
    }

    return res.status(200).json({
      data: requestRecord,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message,
    });
  }
});

// ==============================================================================
// 8. DELETE VERIFICATION REQUEST: DELETE /api/v1/history/:id
// ==============================================================================
apiRouter.delete('/v1/history/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = (req as any).user;

  if (!isValidUuid(id)) {
    return res.status(400).json({
      error: 'INVALID_ID',
      message: 'The requested ID is not a valid UUID.',
    });
  }

  try {
    const supabase = getServerSupabase();

    // 1. Verify existence and ownership
    const { data: existing, error: checkError } = await supabase
      .from('verification_requests')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Verification request not found.',
      });
    }

    if (existing.user_id !== user.id) {
      return res.status(403).json({
        error: 'FORBIDDEN',
        message: 'You can only delete verification requests owned by your account.',
      });
    }

    // 2. Delete the record (foreign keys cascade to claims, evidence, results)
    const { error: deleteError } = await supabase
      .from('verification_requests')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      return res.status(500).json({
        error: 'DELETE_FAILED',
        message: deleteError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Verification request and all associated records have been permanently deleted.',
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message,
    });
  }
});

// ==============================================================================
// 9. PHASE 3 STEP 1: GEMINI SOVEREIGN SOURCE DISCOVERY ENDPOINTS
// ==============================================================================

/**
 * POST /api/v1/sources/discover
 * Discovers authoritative Indian government sources (.gov.in, .nic.in, pib.gov.in)
 * for a claim statement using Google Gemini.
 */
apiRouter.post(
  '/v1/sources/discover',
  rateLimiter(20, 60 * 1000),
  optionalAuth,
  async (req: Request, res: Response) => {
    const { claim, claimText, verificationRequestId, provider } = req.body;
    const targetClaim = (claim || claimText || '').trim();
    const user = (req as any).user;

    const requestedProvider = provider as DiscoveryProvider | undefined;
    const activeProvider = getActiveDiscoveryProvider(requestedProvider);

    if (activeProvider === 'tavily') {
      const tavilyStatus = getTavilyConfigStatus();
      if (!tavilyStatus.isConfigured) {
        return res.status(503).json({
          error: 'TAVILY_UNCONFIGURED',
          message: 'Tavily Search API integration is not configured. TAVILY_API_KEY is required in the environment.',
        });
      }
    } else {
      const geminiStatus = getGeminiConfigStatus();
      if (!geminiStatus.isConfigured) {
        return res.status(503).json({
          error: 'GEMINI_UNCONFIGURED',
          message: 'Google Gemini integration is not configured. GEMINI_API_KEY is required in the environment.',
        });
      }
    }

    if (!targetClaim || targetClaim.length < 10) {
      return res.status(400).json({
        error: 'INVALID_CLAIM',
        message: 'Claim text is required and must be at least 10 characters long.',
      });
    }

    if (targetClaim.length > 2500) {
      return res.status(400).json({
        error: 'CLAIM_TOO_LONG',
        message: 'Claim exceeds maximum allowable length of 2500 characters.',
      });
    }

    try {
      // If a verificationRequestId is provided, verify authorization and persist discovered sources to DB
      if (verificationRequestId) {
        if (!isValidUuid(verificationRequestId)) {
          return res.status(400).json({
            error: 'INVALID_ID',
            message: 'verificationRequestId must be a valid UUID.',
          });
        }

        const supabase = getServerSupabase();
        const { data: requestRecord, error: reqError } = await supabase
          .from('verification_requests')
          .select('id, user_id, guest_session_token')
          .eq('id', verificationRequestId)
          .single();

        if (reqError || !requestRecord) {
          return res.status(404).json({
            error: 'NOT_FOUND',
            message: 'Verification request not found.',
          });
        }

        // Ownership Check:
        if (requestRecord.user_id) {
          if (!user || user.id !== requestRecord.user_id) {
            return res.status(403).json({
              error: 'FORBIDDEN',
              message: 'You do not have permission to attach discovered sources to this request.',
            });
          }
        } else if (requestRecord.guest_session_token) {
          const providedGuestToken =
            (req.headers['x-guest-token'] as string) || (req.query.token as string);
          if (!providedGuestToken || providedGuestToken !== requestRecord.guest_session_token) {
            return res.status(403).json({
              error: 'FORBIDDEN',
              message: 'Valid guest authorization token required.',
            });
          }
        }

        const persistenceResult = await discoverAndPersistSourcesForRequest(verificationRequestId, {
          provider: requestedProvider,
        });
        return res.status(200).json({
          success: persistenceResult.hasVerifiedEvidence,
          requestId: verificationRequestId,
          status: persistenceResult.status,
          groundingStatus: persistenceResult.groundingStatus,
          groundingLimitation: persistenceResult.groundingLimitation,
          hasVerifiedEvidence: persistenceResult.hasVerifiedEvidence,
          provider: activeProvider,
          sourcesCount: persistenceResult.sourcesCount,
          sources: persistenceResult.sources,
          evidence: persistenceResult.evidence,
          candidateSources: persistenceResult.candidateSources,
          searchQueries: persistenceResult.searchQueries,
          message: persistenceResult.hasVerifiedEvidence
            ? 'Authoritative Indian government sources discovered and persisted to database.'
            : persistenceResult.groundingLimitation || 'No verified evidence retrieved.',
        });
      }

      // Ad-hoc standalone source discovery
      const discovery = await discoverAuthoritativeSources(targetClaim, {
        provider: requestedProvider,
      });
      return res.status(200).json({
        success: discovery.hasVerifiedEvidence,
        claim: discovery.claim,
        groundingStatus: discovery.groundingStatus,
        groundingLimitation: discovery.groundingLimitation,
        hasVerifiedEvidence: discovery.hasVerifiedEvidence,
        provider: discovery.provider || activeProvider,
        searchQueries: discovery.searchQueries,
        discoveryMethod: discovery.discoveryMethod,
        sourcesCount: discovery.sources.length,
        sources: discovery.sources,
        candidateSources: discovery.candidateSources,
        timestamp: discovery.timestamp,
        message: discovery.hasVerifiedEvidence
          ? 'Discovered authoritative sovereign Indian government sources.'
          : discovery.groundingLimitation || 'Live search grounding unavailable. Candidate portals are unverified.',
      });
    } catch (err: any) {
      console.error('[GovVerify AI] Error during source discovery:', err);
      return res.status(500).json({
        error: 'SOURCE_DISCOVERY_FAILED',
        message: err.message || 'An error occurred during source discovery.',
      });
    }
  }
);

/**
 * POST /api/v1/verify/:id/discover
 * Triggers and awaits source discovery for a specific verification request ID.
 */
apiRouter.post(
  '/v1/verify/:id/discover',
  rateLimiter(20, 60 * 1000),
  optionalAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { provider } = req.body;
    const user = (req as any).user;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'The requested ID is not a valid UUID.',
      });
    }

    const requestedProvider = provider as DiscoveryProvider | undefined;
    const activeProvider = getActiveDiscoveryProvider(requestedProvider);

    if (activeProvider === 'tavily') {
      const tavilyStatus = getTavilyConfigStatus();
      if (!tavilyStatus.isConfigured) {
        return res.status(503).json({
          error: 'TAVILY_UNCONFIGURED',
          message: 'Tavily Search API integration is not configured. TAVILY_API_KEY is required.',
        });
      }
    } else {
      const geminiStatus = getGeminiConfigStatus();
      if (!geminiStatus.isConfigured) {
        return res.status(503).json({
          error: 'GEMINI_UNCONFIGURED',
          message: 'Google Gemini integration is not configured. GEMINI_API_KEY is required.',
        });
      }
    }

    try {
      const supabase = getServerSupabase();
      const { data: requestRecord, error: reqError } = await supabase
        .from('verification_requests')
        .select('id, user_id, guest_session_token')
        .eq('id', id)
        .single();

      if (reqError || !requestRecord) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Verification request not found.',
        });
      }

      // Ownership authorization check
      if (requestRecord.user_id) {
        if (!user || user.id !== requestRecord.user_id) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'You do not have permission to trigger discovery for this request.',
          });
        }
      } else if (requestRecord.guest_session_token) {
        const providedGuestToken =
          (req.headers['x-guest-token'] as string) || (req.query.token as string);
        if (!providedGuestToken || providedGuestToken !== requestRecord.guest_session_token) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Valid guest authorization token required.',
          });
        }
      }

      const result = await discoverAndPersistSourcesForRequest(id, {
        provider: requestedProvider,
      });
      return res.status(200).json({
        success: result.hasVerifiedEvidence,
        requestId: id,
        status: result.status,
        groundingStatus: result.groundingStatus,
        groundingLimitation: result.groundingLimitation,
        hasVerifiedEvidence: result.hasVerifiedEvidence,
        provider: activeProvider,
        sourcesCount: result.sourcesCount,
        sources: result.sources,
        evidence: result.evidence,
        candidateSources: result.candidateSources,
        searchQueries: result.searchQueries,
        message: result.hasVerifiedEvidence
          ? 'Official Indian government sources discovered and evidence linked in database.'
          : result.groundingLimitation || 'Discovery could not obtain verified grounded evidence.',
      });
    } catch (err: any) {
      console.error('[GovVerify AI] Error during request discovery:', err);
      return res.status(500).json({
        error: 'DISCOVERY_FAILED',
        message: err.message || 'Error discovering sources for request.',
      });
    }
  }
);

/**
 * GET /api/v1/sources
 * Retrieves authoritative sources indexed in public.sources.
 */
apiRouter.get('/v1/sources', optionalAuth, async (req: Request, res: Response) => {
  try {
    const config = getSupabaseConfigStatus();
    if (!config.isConfigured) {
      return res.status(503).json({
        error: 'DATABASE_UNCONFIGURED',
        message: config.message,
      });
    }

    const supabase = getServerSupabase();
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
    const domain = ((req.query.domain as string) || '').trim();
    const search = ((req.query.search as string) || '').trim();

    let query = supabase
      .from('sources')
      .select('*, evidence(id, extracted_text, clause_reference, verification_request_id)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (domain) {
      query = query.ilike('domain', `%${domain}%`);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,domain.ilike.%${search}%,issuing_authority.ilike.%${search}%`);
    }

    const { data: sources, error } = await query;
    if (error) {
      return res.status(500).json({
        error: 'SOURCES_QUERY_FAILED',
        message: error.message,
      });
    }

    return res.status(200).json({
      sources: sources || [],
      count: sources?.length || 0,
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: err.message,
    });
  }
});

/**
 * POST /api/v1/verify/:id/verdict
 * Evaluates verified evidence and generates a structured verdict for the request.
 */
apiRouter.post(
  '/v1/verify/:id/verdict',
  rateLimiter(20, 60 * 1000),
  optionalAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'The requested ID is not a valid UUID.',
      });
    }

    try {
      const supabase = getServerSupabase();
      const { data: requestRecord, error: reqError } = await supabase
        .from('verification_requests')
        .select('id, user_id, guest_session_token, status')
        .eq('id', id)
        .single();

      if (reqError || !requestRecord) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Verification request not found.',
        });
      }

      // Ownership authorization check
      if (requestRecord.user_id) {
        if (!user || user.id !== requestRecord.user_id) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'You do not have permission to trigger verdict analysis for this request.',
          });
        }
      } else if (requestRecord.guest_session_token) {
        const providedGuestToken =
          (req.headers['x-guest-token'] as string) || (req.query.token as string);
        if (!providedGuestToken || providedGuestToken !== requestRecord.guest_session_token) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Valid guest authorization token required.',
          });
        }
      }

      // If requested or if no evidence exists yet and request is not already completed
      const geminiStatus = getGeminiConfigStatus();
      if (
        (requestRecord.status !== 'COMPLETED' || req.body?.forceReanalyze === true) &&
        req.body?.autoDiscover !== false &&
        geminiStatus.isConfigured
      ) {
        const { data: evidenceList } = await supabase
          .from('evidence')
          .select('id')
          .eq('verification_request_id', id);

        if (!evidenceList || evidenceList.length === 0) {
          try {
            await discoverAndPersistSourcesForRequest(id);
          } catch (discErr: any) {
            console.warn('[GovVerify AI] Auto-discovery warning before verdict:', discErr.message);
          }
        }
      }

      const result = await analyzeAndPersistVerdictForRequest(id, {
        mockSubclaims: req.body?.mockSubclaims,
        forceModelFailure: req.body?.forceModelFailure,
        simulatedModelOutput: req.body?.simulatedModelOutput,
        forceReanalyze: req.body?.forceReanalyze,
      });

      return res.status(200).json({
        success: true,
        requestId: id,
        status: result.status,
        verdict: result.analysis.verdict,
        confidence: result.analysis.confidence,
        summaryExplanation: result.analysis.summaryExplanation,
        subclaims: result.analysis.subclaims,
        citations: result.analysis.citations,
        evidenceCount: result.analysis.evidenceCount,
        verifiedSourcesCount: result.analysis.verifiedSourcesCount,
        limitation: result.analysis.limitation,
        completedAt: result.analysis.completedAt,
        persistedResult: result.persistedResult,
      });
    } catch (err: any) {
      console.error('[GovVerify AI] Error during verdict generation:', err);
      return res.status(500).json({
        error: 'VERDICT_ANALYSIS_FAILED',
        message: err.message || 'An error occurred during verdict generation.',
      });
    }
  }
);

/**
 * GET /api/v1/verify/:id/action-guidance
 * Retrieves or generates "Verify & Take Action" guidance for a verification request.
 */
apiRouter.get(
  '/v1/verify/:id/action-guidance',
  rateLimiter(30, 60 * 1000),
  optionalAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'The requested ID is not a valid UUID.',
      });
    }

    try {
      const supabase = getServerSupabase();
      const { data: requestRecord, error: reqError } = await supabase
        .from('verification_requests')
        .select('id, user_id, guest_session_token')
        .eq('id', id)
        .single();

      if (reqError || !requestRecord) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Verification request not found.',
        });
      }

      // Ownership authorization check
      if (requestRecord.user_id) {
        if (!user || user.id !== requestRecord.user_id) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'You do not have permission to access action guidance for this request.',
          });
        }
      } else if (requestRecord.guest_session_token) {
        const providedGuestToken =
          (req.headers['x-guest-token'] as string) || (req.query.token as string);
        if (!providedGuestToken || providedGuestToken !== requestRecord.guest_session_token) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Valid guest authorization token required.',
          });
        }
      }

      const guidance = await getOrGenerateActionGuidance(id);
      return res.status(200).json({
        success: true,
        data: guidance,
      });
    } catch (err: any) {
      console.error('[GovVerify AI] Action guidance error:', err);
      return res.status(500).json({
        error: 'ACTION_GUIDANCE_FAILED',
        message: err.message || 'Failed to generate action guidance.',
      });
    }
  }
);

/**
 * POST /api/v1/verify/:id/action-guidance
 * Generates or regenerates "Verify & Take Action" guidance for a verification request.
 */
apiRouter.post(
  '/v1/verify/:id/action-guidance',
  rateLimiter(20, 60 * 1000),
  optionalAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'The requested ID is not a valid UUID.',
      });
    }

    try {
      const supabase = getServerSupabase();
      const { data: requestRecord, error: reqError } = await supabase
        .from('verification_requests')
        .select('id, user_id, guest_session_token')
        .eq('id', id)
        .single();

      if (reqError || !requestRecord) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Verification request not found.',
        });
      }

      // Ownership authorization check
      if (requestRecord.user_id) {
        if (!user || user.id !== requestRecord.user_id) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'You do not have permission to access action guidance for this request.',
          });
        }
      } else if (requestRecord.guest_session_token) {
        const providedGuestToken =
          (req.headers['x-guest-token'] as string) || (req.query.token as string);
        if (!providedGuestToken || providedGuestToken !== requestRecord.guest_session_token) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Valid guest authorization token required.',
          });
        }
      }

      const guidance = await getOrGenerateActionGuidance(id);
      return res.status(200).json({
        success: true,
        data: guidance,
      });
    } catch (err: any) {
      console.error('[GovVerify AI] Action guidance generation error:', err);
      return res.status(500).json({
        error: 'ACTION_GUIDANCE_FAILED',
        message: err.message || 'Failed to generate action guidance.',
      });
    }
  }
);

/**
 * POST /api/v1/verify/:id/action-guidance/evaluate-eligibility
 * Evaluates citizen eligibility questionnaire answers against documented criteria
 * without persisting private personal identification details.
 */
apiRouter.post(
  '/v1/verify/:id/action-guidance/evaluate-eligibility',
  rateLimiter(30, 60 * 1000),
  optionalAuth,
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { answers } = req.body;
    const user = (req as any).user;

    if (!isValidUuid(id)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'The requested ID is not a valid UUID.',
      });
    }

    try {
      const supabase = getServerSupabase();
      const { data: requestRecord, error: reqError } = await supabase
        .from('verification_requests')
        .select('id, user_id, guest_session_token')
        .eq('id', id)
        .single();

      if (reqError || !requestRecord) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Verification request not found.',
        });
      }

      // Ownership authorization check
      if (requestRecord.user_id) {
        if (!user || user.id !== requestRecord.user_id) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'You do not have permission to evaluate eligibility for this record.',
          });
        }
      } else if (requestRecord.guest_session_token) {
        const providedGuestToken =
          (req.headers['x-guest-token'] as string) || (req.query.token as string);
        if (!providedGuestToken || providedGuestToken !== requestRecord.guest_session_token) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Valid guest authorization token required.',
          });
        }
      }

      const guidance = await getOrGenerateActionGuidance(id);
      const evaluation = evaluateEligibilityAnswers(
        guidance.eligibilityCriteria || [],
        answers || {}
      );

      return res.status(200).json({
        success: true,
        evaluation,
      });
    } catch (err: any) {
      console.error('[GovVerify AI] Eligibility evaluation error:', err);
      return res.status(500).json({
        error: 'EVALUATION_FAILED',
        message: err.message || 'Failed to evaluate eligibility criteria.',
      });
    }
  }
);

// ==============================================================================
// 12. DOCUMENT EXTRACTION & LIFECYCLE ENDPOINTS
// ==============================================================================

/**
 * POST /api/v1/documents/extract
 * Ingests an uploaded image (PNG, JPEG, WebP) or PDF (<= 10MB, <= 5 pages)
 * into memory, validates file signatures, redacts sensitive personal data,
 * and extracts atomic testable factual claims using Gemini Flash multimodal capabilities.
 */
apiRouter.post(
  '/v1/documents/extract',
  rateLimiter(10, 60 * 1000), // 10 uploads per minute per IP
  handleSingleFileUpload('file'),
  optionalAuth,
  async (req: Request, res: Response) => {
    const file = req.file;
    const user = (req as any).user;

    if (!file || !file.buffer || file.buffer.length === 0) {
      return res.status(400).json({
        error: 'NO_FILE_PROVIDED',
        message: 'A file must be provided in the "file" field of the multipart form.',
      });
    }

    if (file.buffer.length > MAX_FILE_SIZE_BYTES) {
      return res.status(413).json({
        error: 'FILE_TOO_LARGE',
        message: 'File size exceeds maximum allowable limit of 10 MB.',
      });
    }

    // 1. Validate file signature against declared MIME type
    const safeExt = file.originalname && file.originalname.includes('.')
      ? file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase()
      : '(none)';
    console.log('[GovVerify Doc Route] Document extraction request received:', {
      extension: safeExt,
      declaredMime: file.mimetype || '(none)',
      fileSizeBytes: file.buffer.length,
    });

    const sigCheck = validateFileSignature(file.buffer, file.mimetype, file.originalname);
    if (!sigCheck.isValid) {
      return res.status(400).json({
        error: 'INVALID_FILE_SIGNATURE',
        message: sigCheck.error || 'Invalid or unsupported file format.',
      });
    }

    // 2. Validate PDF page count
    let detectedPageCount = 1;
    if (sigCheck.detectedMime === 'application/pdf') {
      const pageCheck = inspectPdfPageCount(file.buffer);
      if (!pageCheck.isWithinLimit) {
        return res.status(400).json({
          error: 'PAGE_LIMIT_EXCEEDED',
          message: pageCheck.error || `PDF exceeds maximum allowed page count of ${MAX_PDF_PAGE_COUNT} pages.`,
        });
      }
      detectedPageCount = pageCheck.pageCount;
    }

    // 3. Establish guest session token if unauthenticated
    let guestSessionToken: string | null = null;
    if (!user) {
      const providedGuestToken = req.headers['x-guest-token'] as string;
      guestSessionToken =
        providedGuestToken && providedGuestToken.length >= 32
          ? providedGuestToken
          : randomBytes(32).toString('hex');
    }

    try {
      // 4. Extract text and candidate claims using Gemini Flash
      let extractionOptions: any = undefined;
      if (req.body?.options) {
        try {
          extractionOptions =
            typeof req.body.options === 'string'
              ? JSON.parse(req.body.options)
              : req.body.options;
        } catch {
          // ignore
        }
      }

      const extractionResult = await extractClaimsFromDocument(
        file.buffer,
        sigCheck.detectedMime!,
        file.originalname || 'document',
        extractionOptions
      );

      // Dereference buffer immediately to avoid memory retention
      (file as any).buffer = null;

      // 5. Persist document metadata in Supabase (if configured)
      const configStatus = getSupabaseConfigStatus();
      let documentId: string = randomBytes(16).toString('hex'); // Fallback if DB offline
      let expiresAt: string = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      if (configStatus.isConfigured) {
        const supabase = getServerSupabase();
        const { data: docRecord, error: docError } = await supabase
          .from('documents')
          .insert({
            user_id: user ? user.id : null,
            guest_session_token: guestSessionToken,
            file_name: extractionResult.fileName,
            file_type: extractionResult.mimeType,
            file_size_bytes: extractionResult.fileSizeBytes,
            sha256_hash: extractionResult.sha256Hash,
            extracted_text: extractionResult.extractedTextPreview,
            status: extractionResult.status,
            page_count: extractionResult.pageCount || detectedPageCount,
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (docError || !docRecord) {
          console.warn('[GovVerify AI] Document metadata persistence warning:', docError?.message);
        } else {
          documentId = docRecord.id;
          expiresAt = docRecord.expires_at || expiresAt;
        }
      }

      return res.status(201).json({
        documentId,
        status: extractionResult.status,
        fileName: extractionResult.fileName,
        fileType: extractionResult.mimeType,
        fileSizeBytes: extractionResult.fileSizeBytes,
        pageCount: extractionResult.pageCount || detectedPageCount,
        sha256Hash: extractionResult.sha256Hash,
        extractedTextPreview: extractionResult.extractedTextPreview,
        candidateClaims: extractionResult.candidateClaims,
        warnings: extractionResult.warnings,
        guestToken: guestSessionToken,
        expiresAt,
        message:
          extractionResult.status === 'SUCCESS'
            ? 'Document processed successfully. Review and select factual claims before verifying.'
            : extractionResult.status === 'UNREADABLE_DOCUMENT'
            ? 'The document could not be read clearly. Please upload a clearer copy or enter the claim manually.'
            : 'No verifiable factual policy claims were identified in this document.',
      });
    } catch (err: any) {
      if (file) (file as any).buffer = null;

      const statusCode = err.status || 500;
      const errorCode =
        statusCode === 429
          ? 'PROVIDER_QUOTA_EXHAUSTED'
          : statusCode === 504
          ? 'EXTRACTION_TIMEOUT'
          : statusCode === 400
          ? 'BAD_REQUEST'
          : 'EXTRACTION_FAILED';

      return res.status(statusCode).json({
        error: errorCode,
        message: err.message || 'An error occurred during document extraction.',
      });
    }
  }
);

/**
 * GET /api/v1/documents/:documentId
 * Retrieves sanitized document metadata and redacted extraction preview (protected by ownership).
 */
apiRouter.get(
  '/v1/documents/:documentId',
  optionalAuth,
  async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const user = (req as any).user;

    if (!isValidUuid(documentId)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'The requested document ID is not a valid UUID.',
      });
    }

    const configStatus = getSupabaseConfigStatus();
    if (!configStatus.isConfigured) {
      return res.status(503).json({
        error: 'DATABASE_UNCONFIGURED',
        message: 'Database is not configured.',
      });
    }

    try {
      const supabase = getServerSupabase();
      const { data: docRecord, error: fetchError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (fetchError || !docRecord) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Document record not found.',
        });
      }

      // Ownership authorization check
      if (docRecord.user_id) {
        if (!user || user.id !== docRecord.user_id) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'You do not have permission to view this document.',
          });
        }
      } else if (docRecord.guest_session_token) {
        const providedGuestToken =
          (req.headers['x-guest-token'] as string) || (req.query.token as string);
        if (!providedGuestToken || providedGuestToken !== docRecord.guest_session_token) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Valid guest authorization token required.',
          });
        }
      }

      // Omit private guest session token from output
      const { guest_session_token, ...safeDoc } = docRecord;
      return res.status(200).json({ data: safeDoc });
    } catch (err: any) {
      return res.status(500).json({
        error: 'SERVER_ERROR',
        message: err.message,
      });
    }
  }
);

/**
 * DELETE /api/v1/documents/:documentId
 * Securely deletes document metadata and extracted text upon citizen request.
 * Verification requests linked to this document retain their verified audit trail
 * with document reference set to unlinked (ON DELETE SET NULL).
 */
apiRouter.delete(
  '/v1/documents/:documentId',
  rateLimiter(20, 60 * 1000),
  optionalAuth,
  async (req: Request, res: Response) => {
    const { documentId } = req.params;
    const user = (req as any).user;

    if (!isValidUuid(documentId)) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'The requested document ID is not a valid UUID.',
      });
    }

    const configStatus = getSupabaseConfigStatus();
    if (!configStatus.isConfigured) {
      return res.status(503).json({
        error: 'DATABASE_UNCONFIGURED',
        message: 'Database is not configured to perform document deletions.',
      });
    }

    try {
      const supabase = getServerSupabase();

      // 1. Fetch document to verify ownership
      const { data: docRecord, error: fetchError } = await supabase
        .from('documents')
        .select('id, user_id, guest_session_token')
        .eq('id', documentId)
        .single();

      if (fetchError || !docRecord) {
        return res.status(404).json({
          error: 'NOT_FOUND',
          message: 'Document record not found or already deleted.',
        });
      }

      // 2. Ownership authorization check
      if (docRecord.user_id) {
        if (!user || user.id !== docRecord.user_id) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'You do not have permission to delete this document.',
          });
        }
      } else if (docRecord.guest_session_token) {
        const providedGuestToken =
          (req.headers['x-guest-token'] as string) || (req.query.token as string);
        if (!providedGuestToken || providedGuestToken !== docRecord.guest_session_token) {
          return res.status(403).json({
            error: 'FORBIDDEN',
            message: 'A matching guest authorization token is required to delete this document.',
          });
        }
      }

      // 3. Delete the document record
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        return res.status(500).json({
          error: 'DELETE_FAILED',
          message: deleteError.message,
        });
      }

      return res.status(200).json({
        success: true,
        message:
          'Document metadata and extracted text have been permanently deleted. Any verification requests previously created from this document retain their verified audit history with document linkage unlinked.',
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'SERVER_ERROR',
        message: err.message,
      });
    }
  }
);



