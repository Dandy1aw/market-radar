-- Add notes column to opportunity_decision for per-symbol annotations
ALTER TABLE opportunity_decision
  ADD COLUMN IF NOT EXISTS notes TEXT;
