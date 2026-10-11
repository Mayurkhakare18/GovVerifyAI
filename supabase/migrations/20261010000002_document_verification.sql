-- ==============================================================================
-- GOVVERIFY AI — DOCUMENT VERIFICATION & EXTRACTION SCHEMA MIGRATION
-- Migration: 20261010000002_document_verification.sql
-- Description: Non-destructive addition of public.documents table for
--              screenshot, image, and PDF ingestion metadata, extraction
--              lifecycle, and foreign key linkage to verification_requests.
-- ==============================================================================

-- 1. Create public.documents table for document extraction lifecycle
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_session_token TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  sha256_hash TEXT NOT NULL,
  extracted_text TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'UNREADABLE_DOCUMENT', 'NO_FACTUAL_CLAIMS_FOUND', 'FAILED')),
  failure_category TEXT,
  page_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 2. Add non-destructive foreign key linkage to verification_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'verification_requests' 
      AND column_name = 'document_id'
  ) THEN
    ALTER TABLE public.verification_requests
      ADD COLUMN document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. High-frequency indexes for tenant isolation, lifecycle, and request joins
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_guest_token ON public.documents(guest_session_token) WHERE guest_session_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON public.documents(expires_at);
CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON public.documents(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_verification_requests_document_id ON public.verification_requests(document_id);

-- 4. Automatic updated_at trigger
DROP TRIGGER IF EXISTS set_documents_updated_at ON public.documents;
CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable Row-Level Security (RLS) on public.documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 6. Row-Level Security Policies (Non-recursive DAG model)
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
CREATE POLICY "Users can view their own documents"
  ON public.documents
  FOR SELECT
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;
CREATE POLICY "Users can delete their own documents"
  ON public.documents
  FOR DELETE
  USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- 7. SQL Table & Role Privileges (Defense-in-depth boundary)
-- Authenticated users can SELECT and DELETE their own records via RLS.
-- Pipeline insertion and mutation are reserved exclusively for service_role.
GRANT SELECT, DELETE ON public.documents TO authenticated;
REVOKE INSERT, UPDATE ON public.documents FROM authenticated;
REVOKE ALL ON public.documents FROM anon;
GRANT ALL ON public.documents TO service_role;
