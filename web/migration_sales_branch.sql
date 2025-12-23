-- Migration: Connect Sales to Branches

-- 1. Add branch_id column to sales table
ALTER TABLE sales 
ADD COLUMN branch_id bigint REFERENCES branches(id) ON DELETE SET NULL;

-- 2. Add index for performance
CREATE INDEX idx_sales_branch_id ON sales(branch_id);

-- 3. (Optional) Comment
COMMENT ON COLUMN sales.branch_id IS 'The branch where this sale was made. Used for reference code generation prefix.';
