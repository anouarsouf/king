-- ==========================================
-- MIGRATION: ADMIN MANAGEMENT FUNCTIONS
-- ==========================================

-- 1. Enable pgcrypto for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. SECURE FUNCTION: Reset Password
-- Only Admins can call this. Updates auth.users directly.
CREATE OR REPLACE FUNCTION public.admin_reset_password(target_user_id uuid, new_password text)
RETURNS void AS $$
BEGIN
  -- Security Check: Caller must be Admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can reset passwords.';
  END IF;

  -- Update password in auth.users
  UPDATE auth.users
  SET encrypted_password = crypt(new_password, gen_salt('bf'))
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. SECURE FUNCTION: Delete User
-- Only Admins can call this. Deletes from auth.users (Cascades to profiles).
CREATE OR REPLACE FUNCTION public.admin_delete_user(target_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Security Check: Caller must be Admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can delete users.';
  END IF;

  -- Prevent self-deletion (Safety net)
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Safety Error: You cannot delete your own account.';
  END IF;

  -- Delete from auth.users (Cascade will handle public.profiles if configured, otherwise we delete manually)
  DELETE FROM auth.users WHERE id = target_user_id;
  
  -- Just in case cascade isn't set up perfectly, clean profiles too
  DELETE FROM public.profiles WHERE id = target_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RAISE NOTICE '✅ Admin functions created successfully.';
