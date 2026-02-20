-- FRPEI feedback capture

CREATE TABLE IF NOT EXISTS frpei_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES frpei_requests(id) ON DELETE SET NULL,
  candidate_id UUID NOT NULL,
  provider VARCHAR(50),
  feedback VARCHAR(20) NOT NULL,
  rating FLOAT,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_frpei_feedback_request ON frpei_feedback(request_id);
CREATE INDEX IF NOT EXISTS idx_frpei_feedback_provider ON frpei_feedback(provider);
CREATE INDEX IF NOT EXISTS idx_frpei_feedback_candidate ON frpei_feedback(candidate_id);
