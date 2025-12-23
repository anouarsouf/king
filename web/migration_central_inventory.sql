-- Migration: Central Warehouse & Flexible Transfers
-- 1. Updates to branch_stock: Allow NULL branch_id for "Central Warehouse"
-- Note: schema already allows NULL if not defined as NOT NULL.
-- Let's check constraints. If branch_id is NOT NULL, we need to alter it.
-- Based on previous migration, it WAS 'not null'. We must relax this.

DO $$ 
BEGIN
  ALTER TABLE public.branch_stock ALTER COLUMN branch_id DROP NOT NULL;
EXCEPTION
  WHEN OTHERS THEN NULL; -- Ignore if already nullable
END $$;

-- 2. Update RLS for Central Stock Visibility
-- Admin (NULL branch in profile) should see everything, including NULL branch_stock.
-- Existing policy "View Branch Stock" uses get_user_branch_id().
-- If get_user_branch_id() returns NULL (Admin), equality check fails for NULL values in SQL (NULL = NULL is false).
-- We need to fix the policy logic for the "Central Stock" records.

DROP POLICY IF EXISTS "View Branch Stock" ON public.branch_stock;

CREATE POLICY "View Branch Stock" ON public.branch_stock
FOR SELECT USING (
  -- If User is Admin (branch_id is null), they see EVERYTHING.
  (get_user_branch_id() IS NULL)
  OR 
  -- If User is Branch Manager, they see ONLY their branch.
  (branch_id = get_user_branch_id())
);


-- 3. Function: Import Stock (Supplier -> Central Warehouse)
-- Only Admins should call this (RSL/App logic protected).
CREATE OR REPLACE FUNCTION admin_add_central_stock(
    p_product_id bigint,
    p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_branch bigint;
BEGIN
    -- Security Check: Caller must be Admin
    v_user_branch := get_user_branch_id();
    IF v_user_branch IS NOT NULL THEN
        RAISE EXCEPTION 'Unauthorized: Only Administrators can import stock to Central Warehouse.';
    END IF;

    -- Upsert Stock into Central Warehouse (branch_id = NULL)
    INSERT INTO public.branch_stock (branch_id, product_id, quantity, updated_at)
    VALUES (NULL, p_product_id, p_quantity, now())
    ON CONFLICT (product_id) WHERE branch_id IS NULL
    DO UPDATE SET 
        quantity = branch_stock.quantity + EXCLUDED.quantity,
        updated_at = now();
        
    -- NOTE: The UNIQUE constraint in previous migration was (branch_id, product_id).
    -- In Postgres, (NULL, product_id) multiple rows ARE allowed by default unique constraint unless specifically handled?
    -- Actually, standard SQL says NULL != NULL, so unique constraint might allow multiple NULLs for branch_id.
    -- We need a partial unique index for the central warehouse to be safe.
END;
$$;

-- Fix Unique Constraint for NULL branch_id (Central Warehouse)
CREATE UNIQUE INDEX IF NOT EXISTS idx_central_stock_unique 
ON public.branch_stock (product_id) 
WHERE branch_id IS NULL;


-- 4. Function: Process Transfer (Flexible)
-- Supports: Central -> Branch, Branch -> Branch, Branch -> Central
CREATE OR REPLACE FUNCTION process_inventory_transfer(
    p_product_id bigint,
    p_from_branch_id bigint, -- Can be NULL for Central
    p_to_branch_id bigint,   -- Can be NULL for Central
    p_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_stock integer;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be positive';
    END IF;

    IF p_from_branch_id IS NOT DISTINCT FROM p_to_branch_id THEN
        RAISE EXCEPTION 'Cannot transfer to the same branch';
    END IF;

    -- 1. Check Source Stock
    -- Special handling for NULL (Central) in query
    IF p_from_branch_id IS NULL THEN
        SELECT quantity INTO v_current_stock FROM public.branch_stock 
        WHERE branch_id IS NULL AND product_id = p_product_id;
    ELSE
        SELECT quantity INTO v_current_stock FROM public.branch_stock 
        WHERE branch_id = p_from_branch_id AND product_id = p_product_id;
    END IF;

    IF v_current_stock IS NULL OR v_current_stock < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock in source warehouse. Available: %, Requested: %', COALESCE(v_current_stock, 0), p_quantity;
    END IF;

    -- 2. Deduct from Source
    IF p_from_branch_id IS NULL THEN
        UPDATE public.branch_stock SET quantity = quantity - p_quantity, updated_at = now()
        WHERE branch_id IS NULL AND product_id = p_product_id;
    ELSE
        UPDATE public.branch_stock SET quantity = quantity - p_quantity, updated_at = now()
        WHERE branch_id = p_from_branch_id AND product_id = p_product_id;
    END IF;

    -- 3. Add to Target
    -- Handle UPSERT for Target
    IF p_to_branch_id IS NULL THEN
        -- Target is Central
        INSERT INTO public.branch_stock (branch_id, product_id, quantity, updated_at)
        VALUES (NULL, p_product_id, p_quantity, now())
        ON CONFLICT (product_id) WHERE branch_id IS NULL
        DO UPDATE SET quantity = branch_stock.quantity + p_quantity, updated_at = now();
    ELSE
        -- Target is Branch
        INSERT INTO public.branch_stock (branch_id, product_id, quantity, updated_at)
        VALUES (p_to_branch_id, p_product_id, p_quantity, now())
        ON CONFLICT (branch_id, product_id)
        DO UPDATE SET quantity = branch_stock.quantity + p_quantity, updated_at = now();
    END IF;

    -- 4. Log Transfer (Optional but recommended)
    INSERT INTO public.stock_transfers (product_id, from_branch_id, to_branch_id, quantity, created_at, updated_at)
    VALUES (p_product_id, p_from_branch_id, p_to_branch_id, p_quantity, now(), now());

END;
$$;
