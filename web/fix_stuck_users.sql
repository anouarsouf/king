-- 🛠️ FIX STUCK USERS
-- Run this if you have users that don't show up in the list.

-- 1. Ensure all users in Auth have a Profile
INSERT INTO public.profiles (id, full_name, role)
SELECT id, raw_user_meta_data->>'full_name', 'employee'
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. (Optional) Make sure confirm_email is handled if you have access (Note: usually requires Super Admin/Service Role)
-- Since we can't easily update auth.users from here directly in all Supabase setups without extensions,
-- we rely on the fact that you Disabled Email Confirmation for NEW users.
-- For OLD stuck users, it is best to delete them via the "Users" page (if visible) or just ignore them.

RAISE NOTICE '✅ Fixed missing profiles for existing users.';
