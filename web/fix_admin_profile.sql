-- 🔥 FIX ADMIN ACCOUNT (Upsert)
-- This script ensures the profile exists AND is set to Admin.

-- 1. Replace 'YOUR_EMAIL' below with the actual email
DO $$
DECLARE
  target_email text := 'admin@teqsit.com'; -- ⚠️ PUT YOUR EMAIL HERE
  target_user_id uuid;
BEGIN
  -- Find the user ID from auth.users
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NULL THEN
    RAISE NOTICE '❌ User with email % not found in auth.users! Please Sign Up first.', target_email;
  ELSE
    -- Upsert into profiles (Insert if not exists, Update if exists)
    INSERT INTO public.profiles (id, full_name, role, branch_id)
    VALUES (target_user_id, 'Super Admin', 'admin', NULL)
    ON CONFLICT (id) 
    DO UPDATE SET 
      role = 'admin',
      branch_id = NULL; -- Admin has no branch

    RAISE NOTICE '✅ SUCCESS! User % is now an ADMIN.', target_email;
  END IF;
END $$;
