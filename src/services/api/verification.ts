import { APP_CONFIG } from '../../config';
import { ClaimVerificationRequest, ClaimVerificationResponse, ApiStatusResponse } from './types';
import { resolveApiUrl } from '../../utils/apiUrl';
import { safeFetchJson, fetchJsonOrThrow } from '../../utils/safeFetch';

/**
 * Backend Verification Service Client.
 *
 * Connects directly to /api/v1/verify to persist claims
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
      const res = await safeFetchJson<{ status: string; database: string }>('/api/health');
      if (!res.ok || !res.data) {
        return { status: 'error', database: 'unavailable' };
      }
      return res.data;
    } catch {
      return { status: 'offline', database: 'unreachable' };
    }
  }

  /**
   * Submits a claim for verification to the backend.
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

    return await fetchJsonOrThrow(this.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        claim: request.claimText,
        inputType: 'CLAIM',
      }),
    });
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

    return await fetchJsonOrThrow(this.endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        claim: claimText,
        inputType: 'DOCUMENT',
        documentId,
      }),
    });
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

    return await fetchJsonOrThrow('/api/v1/sources/discover', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        claim: claimText,
        verificationRequestId,
      }),
    });
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

    const data = await fetchJsonOrThrow<{ data: any }>(`/api/v1/verify/${id}`, {
      headers,
    });

    return data.data;
  }
}

export const verificationApi = new VerificationApiService();
