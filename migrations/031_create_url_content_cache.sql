-- URL Content Cache for Discovery Pipeline
-- Caches fetched HTML content to avoid re-downloading during development iterations

CREATE TABLE IF NOT EXISTS url_content_cache (
  url_hash VARCHAR(64) PRIMARY KEY,
  url TEXT NOT NULL,
  html_content TEXT,
  content_length INTEGER,
  fetch_status VARCHAR(20) DEFAULT 'success', -- success, error, timeout
  error_message TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days'
);

-- Index for cleanup of expired entries
CREATE INDEX idx_url_cache_expires ON url_content_cache(expires_at);

-- Index for finding recent fetches
CREATE INDEX idx_url_cache_fetched ON url_content_cache(fetched_at DESC);

COMMENT ON TABLE url_content_cache IS 'Caches HTML content from URLs to speed up LLM extraction iteration';
