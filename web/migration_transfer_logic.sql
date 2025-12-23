-- Migration: Add Transfer Management Logic (Delete & Update)

-- 1. Function to Delete a Transfer (Reverse Stock & Remove Record)
CREATE OR REPLACE FUNCTION delete_branch_transfer(p_transfer_id bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transfer record;
BEGIN
    -- Get transfer details
    SELECT * INTO v_transfer FROM stock_transfers WHERE id = p_transfer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transfer not found';
    END IF;

    -- Reverse Stock Movement
    -- 1. Add back to Source
    UPDATE branch_stock 
    SET quantity = quantity + v_transfer.quantity
    WHERE branch_id = v_transfer.from_branch_id AND product_id = v_transfer.product_id;
    
    -- 2. Remove from Target
    UPDATE branch_stock 
    SET quantity = quantity - v_transfer.quantity
    WHERE branch_id = v_transfer.to_branch_id AND product_id = v_transfer.product_id;

    -- Delete the record
    DELETE FROM stock_transfers WHERE id = p_transfer_id;
END;
$$;

-- 2. Function to Update a Transfer (Reverse Old Stock -> Apply New Stock -> Update Record)
CREATE OR REPLACE FUNCTION update_branch_transfer(
    p_transfer_id bigint,
    p_new_product_id bigint,
    p_new_from_branch_id bigint,
    p_new_to_branch_id bigint,
    p_new_quantity integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_old_transfer record;
BEGIN
    -- Get old details
    SELECT * INTO v_old_transfer FROM stock_transfers WHERE id = p_transfer_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transfer not found';
    END IF;

    -- A. REVERT OLD STOCK
    -- Add back to old Source
    UPDATE branch_stock 
    SET quantity = quantity + v_old_transfer.quantity
    WHERE branch_id = v_old_transfer.from_branch_id AND product_id = v_old_transfer.product_id;
    
    -- Remove from old Target
    UPDATE branch_stock 
    SET quantity = quantity - v_old_transfer.quantity
    WHERE branch_id = v_old_transfer.to_branch_id AND product_id = v_old_transfer.product_id;

    -- B. APPLY NEW STOCK
    -- Remove from new Source
    -- Ensure stock exists? We assume UI checks or DB constraints.
    UPDATE branch_stock 
    SET quantity = quantity - p_new_quantity
    WHERE branch_id = p_new_from_branch_id AND product_id = p_new_product_id;

    -- Add to new Target
    -- Upsert logic if record doesn't exist? usually branch_stock should exist or be created.
    -- Assuming branch_stock rows exist for simplicity as per current app logic.
    UPDATE branch_stock 
    SET quantity = quantity + p_new_quantity
    WHERE branch_id = p_new_to_branch_id AND product_id = p_new_product_id;

    -- C. UPDATE RECORD
    UPDATE stock_transfers
    SET 
        product_id = p_new_product_id,
        from_branch_id = p_new_from_branch_id,
        to_branch_id = p_new_to_branch_id,
        quantity = p_new_quantity,
        updated_at = now() -- Assuming column exists or is handled
    WHERE id = p_transfer_id;
END;
$$;
