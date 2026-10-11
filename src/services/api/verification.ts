import { APP_CONFIG } from '../../config';
import { ClaimVerificationRequest, ClaimVerificationResponse, ApiStatusResponse } from './types';

import { resolveApiUrl } from '../../utils/apiUrl';

/**
 * Backend Verification Service Client.
 *
 * In Phase 2, this service connects directly to /api/v1/verify to persist claims
 * into PostgreSQL with a QUEUED status.
 */
class VerificationApiService {
  private get endpointUrl(): string {
    return resolveApiUrl('/api/v1/verify');
  }

  /**
   * Check whether the backend server is reachable.
   */
  public async checkHealth(): Promise<{ status: string; database: string }> {
    try {
      const res = await fetch(resolveApiUrl('/api/health'));
      if (!res.ok) {
        return { status: 'error', database: 'unavailable' };
      }
      return res.json();
    } catch {
      return { status: 'offline', database: 'unreachable' };
    }
  }

  /**
   * Submits a claim for verification to the Phase 2 backend.
   */
  public async submitClaim(
    request: ClaimVerificationRequest,
    authToken?: string
  ): Promise<{ id: string; status: string; originalClaim: string; createdAt: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const res = await fetch(this.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        claim: request.claimText,
        inputType: 'CLAIM',
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Verification submission failed.');
    }

    return data;
  }

  /**
   * Submits a claim extracted from an audited document with linked documentId.
   */
  public async submitDocumentClaim(
    claimText: string,
    documentId: string,
    authToken?: string,
    guestToken?: string
  ): Promise<{ id: string; guestToken?: string; status: string; originalClaim: string; createdAt: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    if (guestToken) headers['X-Guest-Token'] = guestToken;

    const res = await fetch(this.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        claim: claimText,
        inputType: 'DOCUMENT',
        documentId,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Verification submission failed.');
    }

    return data;
  }

  /**
   * Discovers authoritative Indian government sources for a claim using Gemini.
   */
  public async discoverSources(
    claimText: string,
    verificationRequestId?: string,
    authToken?: string,
    guestToken?: string
  ): Promise<{
    success: boolean;
    claim: string;
    searchQueries: string[];
    sourcesCount: number;
    sources: any[];
    evidence?: any[];
    discoveryMethod?: string;
  }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    if (guestToken) headers['X-Guest-Token'] = guestToken;

    const res = await fetch(resolveApiUrl('/api/v1/sources/discover'), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        claim: claimText,
        verificationRequestId,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to discover authoritative sources.');
    }

    return data;
  }

  /**
   * Retrieves full verification request record with claims, evidence, and sources.
   */
  public async getRequestDetails(
    id: string,
    authToken?: string,
    guestToken?: string
  ): Promise<any> {
    const headers: Record<string, string> = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    if (guestToken) headers['X-Guest-Token'] = guestToken;

    const res = await fetch(resolveApiUrl(`/api/v1/verify/${id}`), {
      headers,
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to load verification record.');
    }

    return data.data;
  }
}

export const verificationApi = new VerificationApiService();
