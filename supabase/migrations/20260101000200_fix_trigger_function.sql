-- Migration: Fix Trigger Function for Auto Stock Deduction
-- Description: Updates handle_sales_order_logistic_change_stock to include required columns (reason, qty_in, qty_out).

CREATE OR REPLACE FUNCTION public.handle_sales_order_logistic_change_stock()
RETURNS TRIGGER AS $$
DECLARE
    r_item RECORD;
    v_qty NUMERIC;
    v_source_ref TEXT;
BEGIN
    -- Conditions:
    -- 1. Must be an Order
    -- 2. New status must be 'em_rota' (logistics_status enum or text)
    IF NEW.doc_type = 'order' AND NEW.status_logistic::text = 'em_rota' THEN
        
        -- Idempotency Check:
        IF EXISTS (
            SELECT 1 FROM public.inventory_movements 
            WHERE reference_type = 'pedido' 
            AND reference_id = NEW.id 
            AND movement_type = 'SAIDA'
        ) THEN
            RETURN NEW;
        END IF;

        -- Prepare Reference
        v_source_ref := concat('#', NEW.document_number);

        -- Loop items and insert movements
        FOR r_item IN 
            SELECT * FROM public.sales_document_items WHERE document_id = NEW.id
        LOOP
            -- Calculate Quantity (Use base if available, fallback to quantity)
            v_qty := COALESCE(r_item.qty_base, r_item.quantity);

            -- Insert Movement with ALL required legacy columns
            INSERT INTO public.inventory_movements (
                company_id,
                item_id,
                movement_type,
                qty_base,
                reference_type, -- source_type
                reference_id,   -- source_id
                source_ref,
                notes,
                created_by,
                created_at,
                updated_at,
                reason,         -- Required by legacy schema (NOT NULL)
                qty_in,         -- Legacy support
                qty_out         -- Legacy support
            ) VALUES (
                NEW.company_id,
                r_item.item_id,
                'SAIDA',
                v_qty,
                'pedido',
                NEW.id,
                v_source_ref,
                'Baixa automática ao entrar em rota',
                NULL,
                NOW(),
                NOW(),
                'sale_out',     -- Reason code
                0,              -- qty_in
                v_qty           -- qty_out
            );
        END LOOP;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
