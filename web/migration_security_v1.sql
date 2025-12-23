-- ==========================================
-- MIGRATION: SECURITY & ROLES OVERHAUL (V1 - FINAL FIX)
-- ==========================================

-- 0. ENSURE TABLES EXIST
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    amount decimal(12, 2) NOT NULL,
    type text NOT NULL CHECK (type IN ('income', 'expense')),
    category text,
    description text,
    branch_id bigint REFERENCES public.branches(id) ON DELETE SET NULL,
    created_by uuid REFERENCES auth.users(id)
);

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    branch_id bigint REFERENCES public.branches(id) ON DELETE SET NULL,
    product_id bigint REFERENCES public.products(id) ON DELETE CASCADE,
    quantity_change integer NOT NULL,
    transaction_type text NOT NULL,
    reference_id text,
    created_by uuid REFERENCES auth.users(id)
);

-- 1. DATA CLEANUP (Prevent Constraint Violations)
-- Upgrade existing 'user' roles to new system
UPDATE public.profiles SET role = 'admin' WHERE (role = 'user' OR role IS NULL) AND branch_id IS NULL;
UPDATE public.profiles SET role = 'employee' WHERE (role = 'user' OR role IS NULL) AND branch_id IS NOT NULL;

-- 2. ENFORCE ROLE TYPES
ALTER TABLE public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('admin', 'manager', 'employee'));

ALTER TABLE public.profiles 
  ALTER COLUMN role SET DEFAULT 'employee';

-- 3. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.get_my_claims()
RETURNS TABLE (role text, branch_id bigint, id uuid) AS $$
  SELECT role, branch_id, id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

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
    WHERE id = auth.uid() AND role IN ('admin', 'manager')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. SECURE CASHBOX VISIBILITY
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin sees all cash tx" ON public.cash_transactions;
CREATE POLICY "Admin sees all cash tx" ON public.cash_transactions FOR ALL USING ( public.is_admin() );

DROP POLICY IF EXISTS "Branch staff see own branch cash tx" ON public.cash_transactions;
CREATE POLICY "Branch staff see own branch cash tx" ON public.cash_transactions FOR SELECT
USING ( branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()) );

DROP POLICY IF EXISTS "Branch staff can add cash tx" ON public.cash_transactions;
CREATE POLICY "Branch staff can add cash tx" ON public.cash_transactions FOR INSERT
WITH CHECK ( branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()) );

-- 5. SECURE INVENTORY & SALES
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Sales Policies
DROP POLICY IF EXISTS "Admin sees all sales" ON public.sales;
CREATE POLICY "Admin sees all sales" ON public.sales FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Branch see own sales" ON public.sales;
CREATE POLICY "Branch see own sales" ON public.sales FOR SELECT 
USING (branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Branch create own sales" ON public.sales;
CREATE POLICY "Branch create own sales" ON public.sales FOR INSERT 
WITH CHECK (branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()));

-- Customers Policies 
DROP POLICY IF EXISTS "Everyone reads customers" ON public.customers;
CREATE POLICY "Everyone reads customers" ON public.customers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin manages customers" ON public.customers;
CREATE POLICY "Admin manages customers" ON public.customers FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Staff create customers" ON public.customers;
CREATE POLICY "Staff create customers" ON public.customers FOR INSERT WITH CHECK (true); 

-- Inventory Policies (Stock Levels)
DROP POLICY IF EXISTS "Admin sees all inventory" ON public.branch_stock;
CREATE POLICY "Admin sees all inventory" ON public.branch_stock FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Branch sees own stock" ON public.branch_stock;
CREATE POLICY "Branch sees own stock" ON public.branch_stock FOR SELECT 
USING (branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()));

-- Inventory Transactions Policies
DROP POLICY IF EXISTS "Admin sees all inv tx" ON public.inventory_transactions;
CREATE POLICY "Admin sees all inv tx" ON public.inventory_transactions FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Branch sees own inv tx" ON public.inventory_transactions;
CREATE POLICY "Branch sees own inv tx" ON public.inventory_transactions FOR SELECT 
USING (branch_id = (SELECT branch_id FROM public.profiles WHERE id = auth.uid()));

-- 6. UPDATE PROFILES TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, branch_id)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', 'New User'),
    'employee',
    NULL
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. FIX PROFILES RLS (Prevent Recursive Loops)
-- The following policies replace any potentially recursive policies from previous migrations
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "View profiles" ON public.profiles
FOR SELECT USING (
   public.is_admin() OR auth.uid() = id
);

CREATE POLICY "Admins can update profiles" ON public.profiles
FOR UPDATE USING ( public.is_admin() );

CREATE POLICY "Admins can insert profiles" ON public.profiles
FOR INSERT WITH CHECK ( public.is_admin() );

-- Ensure we can delete if needed (optional)
CREATE POLICY "Admins can delete profiles" ON public.profiles
FOR DELETE USING ( public.is_admin() );
