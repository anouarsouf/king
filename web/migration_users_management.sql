-- Migration: User Management & Auto-Profile Sync

-- 1. Ensure `full_name` exists in profiles for better display
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;

-- 2. Create/Enable the Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', -- Try to get name from metadata
    'user'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid duplication errors and then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Policy: Allow Admins to UPDATE profiles (Assign Branches)
-- We assume Admin = user with branch_id IS NULL (or check specific role column if you prefer)
CREATE POLICY "Admins can update profiles" ON public.profiles
FOR UPDATE
USING (
  -- Check if the *requesting* user is an Admin (branch_id IS NULL)
  -- Note: This is a recursive check if we look at profiles table itself.
  -- Safe way: define a helper or just check if auth.uid() has NULL branch.
  (SELECT branch_id FROM public.profiles WHERE id = auth.uid()) IS NULL
)
WITH CHECK (
  (SELECT branch_id FROM public.profiles WHERE id = auth.uid()) IS NULL
);

-- Ensure Select policy allows fetching all profiles (already done in previous migration, but reinforcing)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT
USING (
   (SELECT branch_id FROM public.profiles WHERE id = auth.uid()) IS NULL
   OR
   auth.uid() = id -- User can see themselves
);
