-- 🛠️ FIX PROFILES COLUMNS (Critical for Users Page)

-- 1. Add 'created_at' if missing (Fixes the sorting error)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- 2. Add 'email' if missing (Fixes the search filter)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- 3. Sync Emails again (just in case)
UPDATE public.profiles p
SET email = a.email
FROM auth.users a
WHERE p.id = a.id AND p.email IS NULL;

-- RAISE NOTICE '✅ Profiles table fixed! created_at and email columns added.';
