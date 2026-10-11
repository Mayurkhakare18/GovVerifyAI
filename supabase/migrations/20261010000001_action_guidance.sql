-- ==============================================================================
-- GOVVERIFY AI — ACTION GUIDANCE SCHEMA MIGRATION
-- Migration: 20261010000001_action_guidance.sql
-- Description: Non-destructive addition of action_guidance table for
--              "Verify & Take Action" citizen next steps.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.action_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_request_id UUID NOT NULL UNIQUE REFERENCES public.verification_requests(id) ON DELETE CASCADE,
  has_actionable_service BOOLEAN NOT NULL DEFAULT false,
  guidance_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_guidance_request_id ON public.action_guidance(verification_request_id);

ALTER TABLE public.action_guidance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "action_guidance_read_policy" ON public.action_guidance;
CREATE POLICY "action_guidance_read_policy" ON public.action_guidance
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.verification_requests vr
      WHERE vr.id = action_guidance.verification_request_id
        AND vr.user_id = auth.uid()
    )
  );

GRANT SELECT ON public.action_guidance TO authenticated;
GRANT ALL ON public.action_guidance TO service_role;
