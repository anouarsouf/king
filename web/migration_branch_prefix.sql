-- Migration: Add Reference Prefix to Branches

-- 1. Add the column
ALTER TABLE branches 
ADD COLUMN reference_prefix text;

-- 2. Add constraint to ensure uniqueness (optional but recommended)
ALTER TABLE branches 
ADD CONSTRAINT branches_reference_prefix_key UNIQUE (reference_prefix);

-- 3. (Optional) Comment
COMMENT ON COLUMN branches.reference_prefix IS 'Unique single letter (A, B, C...) used as prefix for generated reference codes';
