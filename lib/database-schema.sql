-- Tabel untuk menyimpan pesan bot
CREATE TABLE IF NOT EXISTS bot_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel untuk statistik bot
CREATE TABLE IF NOT EXISTS bot_stats (
  id TEXT PRIMARY KEY DEFAULT 'main',
  total_messages INTEGER DEFAULT 0,
  total_users INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'online' CHECK (status IN ('online', 'offline')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index untuk performa yang lebih baik
CREATE INDEX IF NOT EXISTS idx_bot_messages_user_id ON bot_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_bot_messages_created_at ON bot_messages(created_at DESC);

-- RLS (Row Level Security) policies
ALTER TABLE bot_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_stats ENABLE ROW LEVEL SECURITY;

-- Policy untuk bot_messages (hanya service role yang bisa akses)
CREATE POLICY "Service role can manage bot_messages" ON bot_messages
  FOR ALL USING (auth.role() = 'service_role');

-- Policy untuk bot_stats (hanya service role yang bisa akses)
CREATE POLICY "Service role can manage bot_stats" ON bot_stats
  FOR ALL USING (auth.role() = 'service_role');

-- Insert initial stats record
INSERT INTO bot_stats (id, total_messages, total_users, status) 
VALUES ('main', 0, 0, 'online') 
ON CONFLICT (id) DO NOTHING;