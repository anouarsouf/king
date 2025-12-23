-- Migration: Strict Centralized Purchases
-- 1. Policies: Restrict Purchase Creation to Admins (Central Warehouse Managers) ONLY
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins Only Create Purchases" ON public.purchases;

CREATE POLICY "Admins Only Create Purchases" ON public.purchases
FOR INSERT
WITH CHECK (
    -- Only allow if user has NO branch (is NULL, i.e., Admin/Central)
    get_user_branch_id() IS NULL
);

-- Allow viewing? Maybe branches can see history? For now let's allow all to see, or restrict?
-- "Purchases are recorded ONLY in central", implies branches don't deal with them.
-- Let's restrict VIEW to Admins too for clarity/security, unless requested otherwise.
DROP POLICY IF EXISTS "Admins Only View Purchases" ON public.purchases;
CREATE POLICY "Admins Only View Purchases" ON public.purchases
FOR SELECT
USING (
    get_user_branch_id() IS NULL
);


-- 2. Create V2 Function for registering purchase - STRICTLY CENTRAL
CREATE OR REPLACE FUNCTION register_purchase_v2(
    p_supplier_id bigint,
    p_total_amount numeric,
    p_items jsonb, -- Array of {product_id, quantity, unit_price}
    p_date date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_purchase_id bigint;
    item jsonb;
    v_product_id bigint;
    v_quantity int;
    v_unit_price numeric;
BEGIN
    -- Check Authorization again just in case (though RLS handles it for table insert)
    IF get_user_branch_id() IS NOT NULL THEN
       RAISE EXCEPTION 'Unauthorized: Only Central Warehouse Admins can register purchases.';
    END IF;

    -- 1. Insert Purchase Record (No branch_id needed, or implicitly NULL)
    INSERT INTO public.purchases (supplier_id, total_amount, created_at, notes, branch_id)
    VALUES (p_supplier_id, p_total_amount, p_date, 'Central Warehouse Purchase', NULL) -- Force NULL branch_id
    RETURNING id INTO v_purchase_id;

    -- 2. Process Items
    FOR item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (item->>'product_id')::bigint;
        v_quantity := (item->>'quantity')::int;
        v_unit_price := (item->>'unit_price')::numeric;

        -- A. Insert Purchase Item
        INSERT INTO public.purchase_items (purchase_id, product_id, quantity, unit_price, total_price)
        VALUES (v_purchase_id, v_product_id, v_quantity, v_unit_price, v_quantity * v_unit_price);

        -- B. Update CENTRAL Stock (branch_id = NULL) - ALWAYS
        INSERT INTO public.branch_stock (branch_id, product_id, quantity, updated_at)
        VALUES (NULL, v_product_id, v_quantity, now())
        ON CONFLICT (product_id) WHERE branch_id IS NULL
        DO UPDATE SET quantity = branch_stock.quantity + EXCLUDED.quantity, updated_at = now();
        
    END LOOP;
    
END;
$$;
