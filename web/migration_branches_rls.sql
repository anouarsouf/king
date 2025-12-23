-- Migration: Fix Branch Permissions (RLS)
-- It seems RLS is enabled but policies are missing for Update/Delete.

-- 1. Enable RLS (Good practice, ensuring we control it)
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow full access to branches" ON branches;

-- 3. Create a policy that allows ALL operations (Select, Insert, Update, Delete)
-- Note: In a real production app with multiple users/roles, you'd restrict this.
-- For this "Sales Manager", we assume the user is Admin.
CREATE POLICY "Allow full access to branches" 
ON branches
FOR ALL 
USING (true) 
WITH CHECK (true);
