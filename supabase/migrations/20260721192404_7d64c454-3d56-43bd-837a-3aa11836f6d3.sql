
CREATE TABLE IF NOT EXISTS public.ac_conversation_qa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  agent_user_id UUID,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  greeting_score NUMERIC(5,2),
  empathy_score NUMERIC(5,2),
  resolution_score NUMERIC(5,2),
  compliance_score NUMERIC(5,2),
  tone_score NUMERIC(5,2),
  first_response_seconds INTEGER,
  resolution_seconds INTEGER,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  model TEXT NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id)
);
CREATE INDEX IF NOT EXISTS idx_ac_conv_qa_agent ON public.ac_conversation_qa (agent_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_conv_qa_created ON public.ac_conversation_qa (created_at DESC);
GRANT SELECT ON public.ac_conversation_qa TO authenticated;
GRANT ALL ON public.ac_conversation_qa TO service_role;
ALTER TABLE public.ac_conversation_qa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read QA"
  ON public.ac_conversation_qa FOR SELECT
  TO authenticated
  USING (has_role('Admin') OR has_role('Super Admin'));
