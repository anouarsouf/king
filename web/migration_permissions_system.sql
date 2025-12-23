-- ==========================================
-- MIGRATION: PERMISSIONS SYSTEM (STRICT RLS)
-- ==========================================

-- 1. CLEANUP & PREP
-- Ensure profiles table has necessary columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id bigint REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text DEFAULT 'employee';

-- Ensure role constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'manager', 'employee'));

-- 2. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (role = 'manager' OR role = 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_employee()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_my_branch_id()
RETURNS bigint AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 3. PROFILES RLS (Strict Admin Control)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admin delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

-- VIEW: Admin sees all, User sees self
CREATE POLICY "View profiles" ON public.profiles FOR SELECT
USING ( public.is_admin() OR auth.uid() = id );

-- UPDATE: Admin only
CREATE POLICY "Admin update profiles" ON public.profiles FOR UPDATE
USING ( public.is_admin() );

-- INSERT: Admin only
CREATE POLICY "Admin insert profiles" ON public.profiles FOR INSERT
WITH CHECK ( public.is_admin() );

-- DELETE: Admin only
CREATE POLICY "Admin delete profiles" ON public.profiles FOR DELETE
USING ( public.is_admin() );


-- 4. SALES RLS (Branch Isolation)
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch Isolation Policy" ON public.sales;
DROP POLICY IF EXISTS "Admin sees all sales" ON public.sales;
DROP POLICY IF EXISTS "Branch see own sales" ON public.sales;
DROP POLICY IF EXISTS "Branch create own sales" ON public.sales;

CREATE POLICY "Branch Isolation Policy" ON public.sales FOR ALL
USING (
  public.is_admin() 
  OR 
  branch_id = public.get_my_branch_id()
);


-- 5. CUSTOMERS RLS (Global Read, Branch Write)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Everyone reads customers" ON public.customers;
DROP POLICY IF EXISTS "Staff Manage Customers" ON public.customers;
DROP POLICY IF EXISTS "Admin manages customers" ON public.customers;
DROP POLICY IF EXISTS "Staff create customers" ON public.customers;

-- READ: Everyone (Global Database)
CREATE POLICY "Global Read Customers" ON public.customers FOR SELECT
USING ( true );

-- WRITE: Any Staff
CREATE POLICY "Staff Manage Customers" ON public.customers FOR ALL
USING ( public.is_admin() OR public.is_manager() OR public.is_employee() );


-- 6. CASH TRANSACTIONS RLS (The Critical One)
-- Ensure we are using 'cash_transactions'
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin Full Access" ON public.cash_transactions;
DROP POLICY IF EXISTS "Manager Branch Access" ON public.cash_transactions;
DROP POLICY IF EXISTS "Employee Insert Only" ON public.cash_transactions;
DROP POLICY IF EXISTS "Admin sees all cash tx" ON public.cash_transactions;
DROP POLICY IF EXISTS "Branch staff see own branch cash tx" ON public.cash_transactions;
DROP POLICY IF EXISTS "Branch staff can add cash tx" ON public.cash_transactions;

-- ADMIN: All Access
CREATE POLICY "Admin Full Access" ON public.cash_transactions FOR ALL
USING ( public.is_admin() );

-- MANAGER: View/Manage Own Branch
CREATE POLICY "Manager Branch Access" ON public.cash_transactions FOR ALL
USING ( 
  public.is_manager() 
  AND 
  branch_id = public.get_my_branch_id() 
);

-- EMPLOYEE: Insert Only (Blind Drop)
CREATE POLICY "Employee Insert Only" ON public.cash_transactions FOR INSERT
WITH CHECK ( 
  branch_id = public.get_my_branch_id() 
);

-- NOTE: No SELECT policy for Employee = No Read Access (Confirmed)


-- 7. SECURE VIEW/FUNCTION FOR BALANCE
-- Function to get balance without exposing rows
CREATE OR REPLACE FUNCTION public.get_branch_balance(target_branch_id bigint)
RETURNS numeric AS $$
DECLARE
  total numeric;
BEGIN
  -- Security check: Can user see this branch?
  IF NOT public.is_admin() AND public.get_my_branch_id() IS DISTINCT FROM target_branch_id THEN
     RETURN 0;
  END IF;

  SELECT COALESCE(SUM(
    CASE WHEN type = 'income' THEN amount ELSE -amount END
  ), 0)
  INTO total
  FROM public.cash_transactions
  WHERE branch_id = target_branch_id;
  
  RETURN total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. TRIGGER FIX FOR USER CREATION
-- Ensure the trigger doesn't conflict with Admin manual creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Only insert if not already there (Admin might have done it manually/transactionally)
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = new.id) THEN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
      new.id, 
      COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
      'employee' -- Default role
    );
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
