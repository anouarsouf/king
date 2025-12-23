-- 📧 ADD EMAIL TO PROFILES (Sync from Auth)

-- 1. Add email column if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 2. Backfill email from auth.users (Requires Admin/Superuser privileges)
UPDATE public.profiles p
SET email = a.email
FROM auth.users a
WHERE p.id = a.id AND p.email IS NULL;

-- 3. Trigger to Sync Email on New User (Optional but good)
CREATE OR REPLACE FUNCTION public.handle_new_user_email_sync()
RETURNS trigger AS $$
BEGIN
  UPDATE public.profiles
  SET email = new.email
  WHERE id = new.id;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Trigger definition omitted to keep it simple, running the UPDATE manually is enough for now)

-- RAISE NOTICE '✅ Emails synced to profiles!';
-- Done.
