-- Add registration_states table for persistent state management
CREATE TABLE IF NOT EXISTS registration_states (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  step VARCHAR(20) NOT NULL CHECK (step IN ('role_selection', 'name_input', 'confirmation')),
  role VARCHAR(10) CHECK (role IN ('HD', 'TEKNISI')),
  name TEXT,
  username TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_registration_states_telegram_id ON registration_states(telegram_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_registration_states_updated_at 
    BEFORE UPDATE ON registration_states 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();