/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GovVerify AI — Document Upload & Claim Review Component
 * Ingests images and PDFs, displays redacted extraction preview,
 * enables editing and single-claim selection, and enforces honest confirmation.
 */

import React, { useState, useRef } from 'react';
import {
  Upload,
  FileCheck2,
  Trash2,
  AlertCircle,
  CheckCircle,
  FileText,
  Info,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Check,
  X,
  Sparkles,
  Search,
} from 'lucide-react';
import { APP_CONFIG } from '../../config';
import { documentApi } from '../../services/api/documents';
import { DocumentExtractionApiResponse, CandidateExtractedClaim } from '../../services/api/types';
import { useAuth } from '../../contexts/AuthContext';

export interface DocumentUploadReviewProps {
  onConfirmClaim: (claimText: string, documentId: string, guestToken?: string) => Promise<void>;
  isVerifying?: boolean;
  onManualEntryRequested?: (suggestedText?: string) => void;
  className?: string;
}

export const DocumentUploadReview: React.FC<DocumentUploadReviewProps> = ({
  onConfirmClaim,
  isVerifying = false,
  onManualEntryRequested,
  className = '',
}) => {
  const { token } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ingestion States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractionStepMessage, setExtractionStepMessage] = useState<string>('');
  const [extractionData, setExtractionData] = useState<DocumentExtractionApiResponse | null>(null);

  // Review & Selection States
  const [showTextPreview, setShowTextPreview] = useState<boolean>(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [editableClaims, setEditableClaims] = useState<
    Record<string, { text: string; isEdited: boolean }>
  >({});
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);
  const [editingDraftText, setEditingDraftText] = useState<string>('');

  // Deletion States
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deletionNotice, setDeletionNotice] = useState<string | null>(null);

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setFileError(null);
    setDeletionNotice(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    setDeletionNotice(null);
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
    // Reset file input target value so selecting the same file again triggers change event
    e.target.value = '';
  };

  const handleFileSelected = (file: File) => {
    const safeExt = file.name && file.name.includes('.')
      ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
      : '(none)';
    console.log('[GovVerify Doc Upload] File selected for review:', {
      extension: safeExt,
      declaredMime: file.type || '(empty)',
      fileSizeBytes: file.size,
    });

    const validation = documentApi.validateDocumentFile(file);
    if (!validation.isValid) {
      setFileError(validation.error || 'Invalid file.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setFileError(null);
    setExtractionData(null);
    setSelectedClaimId(null);
    setEditableClaims({});
    setEditingClaimId(null);
    setDeletionNotice(null);
  };

  const handleClearSelectedFile = () => {
    setSelectedFile(null);
    setFileError(null);
    setExtractionData(null);
    setSelectedClaimId(null);
    setEditableClaims({});
    setEditingClaimId(null);
    setShowTextPreview(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Extraction Execution
  const handleExtractDocument = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedFile || isExtracting) return;

    const safeExt = selectedFile.name && selectedFile.name.includes('.')
      ? selectedFile.name.slice(selectedFile.name.lastIndexOf('.')).toLowerCase()
      : '(none)';
    console.log('[GovVerify Doc Upload] Initiating factual claim extraction:', {
      extension: safeExt,
      declaredMime: selectedFile.type || '(empty)',
      fileSizeBytes: selectedFile.size,
    });

    setFileError(null);
    setIsExtracting(true);
    setExtractionStepMessage('Uploading document securely to server memory...');

    try {
      setExtractionStepMessage('Reading document and extracting factual claims with Gemini Flash...');
      const result = await documentApi.extractDocument(selectedFile, token || undefined);

      setExtractionData(result);

      // Populate editable claims map
      const initialMap: Record<string, { text: string; isEdited: boolean }> = {};
      result.candidateClaims.forEach((c) => {
        initialMap[c.id] = { text: c.claimText, isEdited: false };
      });
      setEditableClaims(initialMap);

      if (result.candidateClaims.length > 0) {
        setSelectedClaimId(result.candidateClaims[0].id);
      } else {
        setSelectedClaimId(null);
      }
    } catch (err: any) {
      setFileError(
        err.message || 'We could not extract claims from this document. Please check the file and try again.'
      );
    } finally {
      setIsExtracting(false);
      setExtractionStepMessage('');
    }
  };

  // Editing Handlers
  const handleStartEdit = (claimId: string, currentText: string) => {
    setEditingClaimId(claimId);
    setEditingDraftText(currentText);
  };

  const handleSaveEdit = (claimId: string) => {
    const trimmed = editingDraftText.trim();
    if (trimmed.length < 10) {
      setFileError('Claim statement must be at least 10 characters long.');
      return;
    }

    const original = extractionData?.candidateClaims.find((c) => c.id === claimId);
    const isEdited = original ? original.claimText !== trimmed : true;

    setEditableClaims((prev) => ({
      ...prev,
      [claimId]: { text: trimmed, isEdited },
    }));
    setEditingClaimId(null);
    setEditingDraftText('');
    setFileError(null);
  };

  const handleCancelEdit = () => {
    setEditingClaimId(null);
    setEditingDraftText('');
  };

  // Document Deletion Handler
  const handleDeleteDocument = async () => {
    if (!extractionData?.documentId || isDeleting) return;

    const confirmed = window.confirm(
      'Are you sure you want to delete this document? The uploaded document metadata and extracted text will be permanently deleted from our servers. Any completed verifications will remain in audit history.'
    );
    if (!confirmed) return;

    setIsDeleting(true);
    setFileError(null);

    try {
      await documentApi.deleteDocument(
        extractionData.documentId,
        token || undefined,
        extractionData.guestToken || undefined
      );

      handleClearSelectedFile();
      setDeletionNotice('Document metadata and extracted text have been permanently deleted.');
      setTimeout(() => setDeletionNotice(null), 5000);
    } catch (err: any) {
      setFileError(err.message || 'Failed to delete document from server.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Confirmation & Verification Trigger
  const handleConfirmAndVerify = async () => {
    if (!extractionData || !selectedClaimId || isVerifying) return;

    const currentClaim = editableClaims[selectedClaimId];
    const finalClaimText = currentClaim ? currentClaim.text.trim() : '';

    if (!finalClaimText || finalClaimText.length < 10) {
      setFileError('Please select a valid claim statement of at least 10 characters.');
      return;
    }

    setFileError(null);
    await onConfirmClaim(finalClaimText, extractionData.documentId, extractionData.guestToken);
  };

  const activeSelectedClaimText = selectedClaimId ? editableClaims[selectedClaimId]?.text : '';

  return (
    <div className={`space-y-5 ${className}`}>
      {/* Deletion Toast / Notice */}
      {deletionNotice && (
        <div
          role="status"
          className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in"
        >
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{deletionNotice}</span>
        </div>
      )}

      {/* Error Banner */}
      {fileError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-start gap-2.5 animate-in fade-in"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Extraction Notice: </span>
            <span>{fileError}</span>
          </div>
          <button
            type="button"
            onClick={() => setFileError(null)}
            className="text-rose-500 hover:text-rose-700"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* STAGE 1: FILE DROPZONE & INGESTION (When no extractionData yet) */}
      {!extractionData && (
        <div className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Upload Screenshot, Image or PDF Document"
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all cursor-pointer ${
              isDragging
                ? 'border-brand-blue bg-brand-softblue/60 scale-[1.01]'
                : selectedFile
                ? 'border-emerald-300 bg-emerald-50/50'
                : 'border-[#E1E7EF] hover:border-brand-blue/60 bg-[#F8FAFC]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
              onChange={handleFileInputChange}
              className="hidden"
              id="doc-upload-input"
            />

            {selectedFile ? (
              <div className="space-y-2">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center border border-emerald-200 shadow-xs">
                  <FileCheck2 className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="font-bold text-sm text-brand-navy">{selectedFile.name}</div>
                <div className="text-xs text-brand-slate">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB ·{' '}
                  {selectedFile.type.toUpperCase() || 'Document'}
                </div>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearSelectedFile();
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1 rounded-lg border border-rose-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Change File</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="w-12 h-12 rounded-xl bg-brand-softblue text-brand-blue mx-auto flex items-center justify-center border border-brand-softblue-border shadow-xs">
                  <Upload className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="font-extrabold text-sm sm:text-base text-brand-navy">
                  Drop screenshot, image, or circular PDF here, or browse
                </div>
                <p className="text-xs text-brand-slate max-w-md mx-auto leading-relaxed">
                  Upload official notices, viral gazette screenshots, or circulars in{' '}
                  <strong className="text-brand-navy">PNG, JPG, WebP, or PDF</strong> format (max{' '}
                  {APP_CONFIG.limits.maxFileSizeDisplay}).
                </p>
                <div className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue bg-white px-2.5 py-1 rounded-full border border-brand-softblue-border shadow-2xs">
                  <span>PDF (up to 5 pages) · Images (PNG, JPG, WebP)</span>
                </div>
              </div>
            )}
          </div>

          {/* Privacy and Extraction Notice */}
          <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E1E7EF] space-y-1.5 text-xs text-[#526176]">
            <div className="font-bold text-brand-navy flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-blue" />
              <span>In-Memory Privacy Shield</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Your document is processed strictly in temporary server memory and discarded
              immediately. Personal identifiers (such as Aadhaar, PAN, and mobile numbers) are
              automatically masked prior to claim extraction. Original file bytes are never stored on disk.
            </p>
          </div>

          {/* Extraction Action Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="text-[11px] text-brand-slate">
              {selectedFile ? 'File ready for extraction' : 'Select a file to begin claim extraction'}
            </div>

            <button
              type="button"
              onClick={handleExtractDocument}
              disabled={!selectedFile || isExtracting}
              className="px-5 py-2.5 text-xs sm:text-sm font-bold text-white bg-brand-blue hover:bg-brand-blue-hover active:bg-brand-navy disabled:opacity-40 disabled:cursor-not-allowed rounded-xl shadow-xs transition-all flex items-center justify-center gap-2"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{extractionStepMessage || 'Extracting Claims...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Extract Factual Claims</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: EXTRACTED CLAIM REVIEW & SELECTION (When extractionData is set) */}
      {extractionData && (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Document Summary Card */}
          <div className="p-4 rounded-xl border border-brand-softblue-border bg-brand-softblue/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-brand-blue text-white shrink-0 shadow-2xs mt-0.5">
                <FileText className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-brand-navy truncate max-w-xs sm:max-w-md">
                    {extractionData.fileName}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-white border border-brand-softblue-border text-brand-blue">
                    {extractionData.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="text-xs text-brand-slate flex flex-wrap items-center gap-2">
                  <span>{(extractionData.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB</span>
                  <span>·</span>
                  <span>{extractionData.fileType}</span>
                  <span>·</span>
                  <span>
                    {extractionData.pageCount} page{extractionData.pageCount > 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={handleDeleteDocument}
                disabled={isDeleting}
                className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-white hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                title="Permanently remove uploaded document and extracted text from server"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                )}
                <span>Remove Document</span>
              </button>
            </div>
          </div>

          {/* Collapsible Extracted Text Preview */}
          <div className="rounded-xl border border-[#E1E7EF] bg-white overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setShowTextPreview((prev) => !prev)}
              className="w-full px-4 py-3 bg-[#F8FAFC] hover:bg-[#F1F5F9] flex items-center justify-between text-left transition-colors"
              aria-expanded={showTextPreview}
            >
              <div className="flex items-center gap-2 text-xs font-bold text-brand-navy">
                <FileText className="w-4 h-4 text-brand-blue" />
                <span>Extracted Text Preview (Unverified Document Transcription)</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-brand-slate">
                <span>{showTextPreview ? 'Hide Text' : 'View Text'}</span>
                {showTextPreview ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            </button>

            {showTextPreview && (
              <div className="p-4 space-y-3 border-t border-[#E1E7EF] text-xs animate-in fade-in">
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <strong>Untrusted Citizen Ingestion:</strong> This text was extracted from the
                    uploaded document. It represents the claim statement being audited and does{' '}
                    <strong className="underline">NOT</strong> constitute verified evidence of its
                    own truth.
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto p-3 rounded-lg bg-[#F8FAFC] border border-[#E1E7EF] font-mono text-[11px] text-brand-navy whitespace-pre-wrap leading-relaxed select-text">
                  {extractionData.extractedTextPreview || 'No readable text preview available.'}
                </div>
              </div>
            )}
          </div>

          {/* Candidate Claims Section */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div>
                <h4 className="text-sm font-extrabold text-brand-navy flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-brand-blue" />
                  <span>Candidate Factual Claims ({extractionData.candidateClaims.length})</span>
                </h4>
                <p className="text-xs text-brand-slate">
                  Select one claim to independently verify against sovereign government sources.
                </p>
              </div>

              <div className="text-[11px] text-brand-slate-light font-medium">
                Click claim card to select · Use pencil to edit statement
              </div>
            </div>

            {/* Empty Claims State */}
            {extractionData.candidateClaims.length === 0 ? (
              <div className="p-6 rounded-xl border border-[#E1E7EF] bg-white text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 mx-auto flex items-center justify-center">
                  <Info className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h5 className="text-sm font-bold text-brand-navy">
                    No Policy Claims Automatically Isolated
                  </h5>
                  <p className="text-xs text-brand-slate max-w-sm mx-auto">
                    The document contained legible text, but no specific factual policy assertions
                    (such as subsidy amounts or circular mandates) could be cleanly separated.
                  </p>
                </div>
                {onManualEntryRequested && (
                  <button
                    type="button"
                    onClick={() =>
                      onManualEntryRequested(extractionData.extractedTextPreview.slice(0, 300))
                    }
                    className="px-4 py-2 text-xs font-bold text-brand-blue bg-brand-softblue hover:bg-brand-softblue-border rounded-xl transition-colors"
                  >
                    Enter Claim Statement Manually
                  </button>
                )}
              </div>
            ) : (
              /* Claims List */
              <div className="space-y-2.5" role="radiogroup" aria-label="Selectable Factual Claims">
                {extractionData.candidateClaims.map((claim) => {
                  const claimObj = editableClaims[claim.id] || {
                    text: claim.claimText,
                    isEdited: false,
                  };
                  const isSelected = selectedClaimId === claim.id;
                  const isCurrentlyEditing = editingClaimId === claim.id;

                  return (
                    <div
                      key={claim.id}
                      onClick={() => {
                        if (!isCurrentlyEditing) {
                          setSelectedClaimId(claim.id);
                        }
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-brand-blue bg-white shadow-xs ring-2 ring-brand-blue/20'
                          : 'border-[#E1E7EF] bg-white hover:border-brand-blue/50 hover:bg-[#F8FAFC]'
                      }`}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          if (!isCurrentlyEditing) {
                            e.preventDefault();
                            setSelectedClaimId(claim.id);
                          }
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Radio selection circle */}
                        <div className="pt-0.5 shrink-0">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'border-brand-blue bg-brand-blue'
                                : 'border-[#CBD5E1] bg-white'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>

                        {/* Card Content */}
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {claim.category && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-[#F1F5F9] text-brand-navy border border-[#E2E8F0]">
                                  {claim.category}
                                </span>
                              )}
                              {claim.context && (
                                <span className="text-[11px] text-brand-slate italic">
                                  Context: {claim.context}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {claimObj.isEdited && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-200">
                                  Edited Statement
                                </span>
                              )}

                              {!isCurrentlyEditing && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(claim.id, claimObj.text);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-blue hover:text-brand-blue-hover px-2 py-0.5 rounded hover:bg-brand-softblue transition-colors"
                                  aria-label="Edit claim text"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Edit</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Claim Text or Editor */}
                          {isCurrentlyEditing ? (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="space-y-2 pt-1 animate-in fade-in"
                            >
                              <textarea
                                rows={3}
                                value={editingDraftText}
                                onChange={(e) => setEditingDraftText(e.target.value)}
                                className="w-full p-2.5 text-xs text-brand-navy bg-[#F8FAFC] border border-brand-blue rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-blue resize-y"
                                placeholder="Refine the factual claim statement..."
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelEdit}
                                  className="px-2.5 py-1 text-xs font-semibold text-brand-slate hover:text-brand-navy bg-white border border-[#E1E7EF] rounded-md transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(claim.id)}
                                  className="px-3 py-1 text-xs font-bold text-white bg-brand-blue hover:bg-brand-blue-hover rounded-md transition-colors flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Save Statement</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs sm:text-sm font-semibold text-brand-navy leading-relaxed">
                              "{claimObj.text}"
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* STAGE 3: CITIZEN CONFIRMATION & VERIFICATION BANNER */}
          {selectedClaimId && activeSelectedClaimText && (
            <div className="p-4 sm:p-5 rounded-2xl border border-brand-blue/30 bg-gradient-to-br from-brand-softblue/80 to-white space-y-3.5 shadow-xs animate-in fade-in">
              <div className="space-y-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-brand-blue flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-brand-blue" />
                  <span>Confirmed Target Claim</span>
                </div>
                <blockquote className="text-xs sm:text-sm font-bold text-brand-navy italic border-l-3 border-brand-blue pl-3 py-1 bg-white/90 rounded-r-lg border border-[#E1E7EF]">
                  "{activeSelectedClaimText}"
                </blockquote>
              </div>

              <div className="flex items-start gap-2 text-xs text-[#526176] bg-white/80 p-2.5 rounded-xl border border-[#E1E7EF]">
                <Info className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  <strong>Verification Protocol:</strong> GovVerify AI will now independently search
                  for authoritative evidence across official gazettes and nodal ministries (
                  <code>.gov.in</code>, <code>.nic.in</code>, PIB). The uploaded document will{' '}
                  <strong>not</strong> count as evidence of its own validity.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleClearSelectedFile}
                  disabled={isVerifying}
                  className="px-4 py-2 text-xs font-semibold text-brand-slate hover:text-brand-navy bg-white hover:bg-slate-50 border border-[#E1E7EF] rounded-xl transition-colors text-center disabled:opacity-50"
                >
                  Upload Different File
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndVerify}
                  disabled={isVerifying || !activeSelectedClaimText}
                  className="px-6 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-brand-blue hover:bg-brand-blue-hover active:bg-brand-navy rounded-xl shadow-xs transition-all hover:shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Claim with Sovereign Portals...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Verify Selected Claim</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
