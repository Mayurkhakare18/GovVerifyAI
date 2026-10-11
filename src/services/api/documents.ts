import { APP_CONFIG } from '../../config';
import {
  DocumentVerificationRequest,
  DocumentVerificationResponse,
  DocumentExtractionApiResponse,
} from './types';

const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

import { resolveApiUrl } from '../../utils/apiUrl';
import { fetchJsonOrThrow } from '../../utils/safeFetch';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

/**
 * Document Ingestion & Parsing Service Client.
 * Connects to /api/v1/documents/extract and /api/v1/documents/:id.
 */
class DocumentApiService {
  private get endpointUrl(): string {
    return resolveApiUrl('/api/v1/documents');
  }

  public isParserReady(): boolean {
    return true;
  }

  /**
   * Submits a document or image for server-side validation and factual claim extraction.
   */
  public async extractDocument(
    file: File,
    authToken?: string,
    guestToken?: string
  ): Promise<DocumentExtractionApiResponse> {
    const validation = this.validateDocumentFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid file.');
    }

    const safeExt = file.name && file.name.includes('.')
      ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      : '(none)';
    console.log('[GovVerify Doc Client] Submitting document for extraction:', {
      extension: safeExt,
      declaredMime: file.type || '(empty)',
      fileSizeBytes: file.size,
    });

    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (guestToken) {
      headers['X-Guest-Token'] = guestToken;
    }

    return await fetchJsonOrThrow<DocumentExtractionApiResponse>(
      `${this.endpointUrl}/extract`,
      {
        method: 'POST',
        headers,
        body: formData,
      }
    );
  }

  /**
   * Deletes an uploaded document metadata and its extracted text.
   */
  public async deleteDocument(
    documentId: string,
    authToken?: string,
    guestToken?: string
  ): Promise<{ success: boolean; message: string }> {
    const headers: Record<string, string> = {};
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    if (guestToken) {
      headers['X-Guest-Token'] = guestToken;
    }

    return await fetchJsonOrThrow<{ success: boolean; message: string }>(
      `${this.endpointUrl}/${documentId}`,
      {
        method: 'DELETE',
        headers,
      }
    );
  }

  /**
   * Backward-compatible helper for legacy Phase 1 callers.
   */
  public async uploadDocument(
    request: DocumentVerificationRequest
  ): Promise<DocumentVerificationResponse> {
    const result = await this.extractDocument(request.file);
    return {
      documentId: result.documentId,
      fileName: result.fileName,
      extractedClaimsCount: result.candidateClaims.length,
      extractedClaims: result.candidateClaims.map((c) => c.claimText),
    };
  }

  /**
   * General document file validator for PDF, PNG, JPEG, and WebP.
   * Logs only safe diagnostic metadata (never file contents or personal information).
   * Does not classify files solely based on extension.
   */
  public validateDocumentFile(file: File): { isValid: boolean; error?: string } {
    if (!file) {
      return { isValid: false, error: 'No file selected.' };
    }

    const safeExt = file.name && file.name.includes('.')
      ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      : '(none)';
    const mimeType = (file.type || '').trim().toLowerCase();

    // Log safe diagnostic metadata only
    console.log('[GovVerify Doc Client] Validating document:', {
      extension: safeExt,
      declaredMime: mimeType || '(empty)',
      fileSizeBytes: file.size,
    });

    if (file.size === 0) {
      return {
        isValid: false,
        error: 'The selected file is empty (0 bytes). Please choose a valid document.',
      };
    }

    if (file.size > APP_CONFIG.limits.maxFileSizeBytes) {
      return {
        isValid: false,
        error: `File size exceeds the limit of ${APP_CONFIG.limits.maxFileSizeDisplay}. Selected file is ${(
          file.size /
          (1024 * 1024)
        ).toFixed(2)} MB.`,
      };
    }

    // Explicitly reject SVG files due to script-execution risks
    if (
      mimeType === 'image/svg+xml' ||
      mimeType === 'image/svg' ||
      safeExt === '.svg'
    ) {
      return {
        isValid: false,
        error: 'SVG files are strictly disallowed due to script-execution risks. Please upload a PNG, JPG, WebP, or PDF document.',
      };
    }

    // Explicitly reject HTML and script files
    if (
      mimeType === 'text/html' ||
      mimeType === 'text/javascript' ||
      mimeType === 'application/xhtml+xml' ||
      safeExt === '.html' ||
      safeExt === '.htm' ||
      safeExt === '.js'
    ) {
      return {
        isValid: false,
        error: 'HTML and script files are strictly disallowed. Please upload a PNG, JPG, WebP, or PDF document.',
      };
    }

    const hasValidExtension = ALLOWED_EXTENSIONS.includes(safeExt);
    const hasValidMime = ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType) || mimeType === 'image/jpg';

    // Disallow if neither extension nor MIME is valid, or if MIME is explicitly an unsupported known type
    const isExplicitlyUnsupportedMime =
      mimeType !== '' &&
      !ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType) &&
      mimeType !== 'image/jpg';

    if ((!hasValidExtension && !hasValidMime) || isExplicitlyUnsupportedMime) {
      return {
        isValid: false,
        error: 'Unsupported file format. Please upload a PDF, PNG, JPEG, or WebP document.',
      };
    }

    return { isValid: true };
  }

  /**
   * Legacy validator for PDF-only forms.
   */
  public validatePdfFile(file: File): { isValid: boolean; error?: string } {
    if (
      !APP_CONFIG.limits.allowedMimeTypes.includes(file.type as any) &&
      !file.name.toLowerCase().endsWith('.pdf')
    ) {
      return {
        isValid: false,
        error: 'Only PDF documents (.pdf) are supported. Please select a valid official document.',
      };
    }

    if (file.size > APP_CONFIG.limits.maxFileSizeBytes) {
      return {
        isValid: false,
        error: `File size exceeds the limit of ${APP_CONFIG.limits.maxFileSizeDisplay}. Selected file is ${(
          file.size /
          (1024 * 1024)
        ).toFixed(2)} MB.`,
      };
    }

    if (file.size === 0) {
      return {
        isValid: false,
        error: 'The selected PDF file is empty (0 bytes). Please choose a valid document.',
      };
    }

    return { isValid: true };
  }
}

export const documentApi = new DocumentApiService();
