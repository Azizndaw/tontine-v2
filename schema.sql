-- SQL Schema for Tontine Database (Supabase / PostgreSQL)
-- Executer ce script dans le SQL Editor de Supabase pour initialiser la base de données.

CREATE TABLE IF NOT EXISTS tontine_store (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Politique de securite RLS (Permet la lecture et l'ecriture avec la clé anonyme)
ALTER TABLE tontine_store ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public full access" ON tontine_store;
CREATE POLICY "Public full access" ON tontine_store 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
