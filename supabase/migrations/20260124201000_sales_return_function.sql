-- Migration: Sales Return Processing Function (Hardened)
-- Description: Atomic function to process returns with TRUSTED NET PRICE VALUATION.

CREATE OR REPLACE FUNCTION public.process_sales_return(
    p_order_id UUID,
    p_user_id UUID,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges
AS $$
DECLARE
    v_delivery_id UUID;
    v_item JSONB;
    v_delivery_item public.delivery_items%ROWTYPE;
    v_sales_item public.sales_document_items%ROWTYPE;
    v_order public.sales_documents%ROWTYPE;
    
    v_prod_cost NUMERIC(15,4);
    v_net_unit_price NUMERIC(15,4);
    v_item_credit_value NUMERIC(15,2);
    v_total_credit NUMERIC(15,2) := 0;
    
    v_delivery_ref public.deliveries%ROWTYPE;
    v_company_id UUID;
    v_order_number TEXT;
    v_client_id UUID;
    v_event_id UUID;
    v_financial_event_id UUID;
    v_reason_text TEXT;
BEGIN
    -- 1. Extract Info
    v_delivery_id := (p_payload->>'delivery_id')::UUID;
    v_reason_text := COALESCE(p_payload->>'note', 'Devolução processada');
    
    -- Load Delivery & Order Context
    SELECT * INTO v_delivery_ref FROM public.deliveries WHERE id = v_delivery_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Delivery not found'; END IF;
    
    SELECT * INTO v_order FROM public.sales_documents WHERE id = p_order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
    
    v_company_id := v_order.company_id;
    v_client_id := v_order.client_id;
    v_order_number := v_order.document_number;

    -- 2. Create Audit Event (Parent)
    INSERT INTO public.order_delivery_events (
        company_id, order_id, route_id, event_type, payload, created_at, created_by
    ) VALUES (
        v_company_id, p_order_id, v_delivery_ref.route_id, 
        'DEVOLUCAO_PARCIAL', 
        p_payload,
        NOW(), p_user_id
    ) RETURNING id INTO v_event_id;

    -- 3. Process Items Loop
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'items')
    LOOP
        -- Lock & Get Delivery Item
        SELECT * INTO v_delivery_item 
        FROM public.delivery_items 
        WHERE id = (v_item->>'delivery_item_id')::UUID
        FOR UPDATE;
        
        IF NOT FOUND THEN RAISE EXCEPTION 'Delivery Item not found: %', (v_item->>'delivery_item_id'); END IF;
        
        -- Get Sales Item (for Price Calculation)
        SELECT * INTO v_sales_item
        FROM public.sales_document_items
        WHERE id = v_delivery_item.sales_document_item_id;

        -- Validate Quantity
        IF (v_delivery_item.qty_returned + (v_item->>'qty_returned')::NUMERIC) > v_delivery_item.qty_delivered THEN
             RAISE EXCEPTION 'Return quantity exceeds delivered quantity for Item %', v_delivery_item.sales_document_item_id;
        END IF;

        IF (v_item->>'qty_returned')::NUMERIC <= 0 THEN
             RAISE EXCEPTION 'Return quantity must be positive';
        END IF;

        -- Update Delivery Item
        UPDATE public.delivery_items
        SET qty_returned = qty_returned + (v_item->>'qty_returned')::NUMERIC,
            updated_at = NOW()
        WHERE id = v_delivery_item.id;
        
        -- TRUSLESS PRICE CALCULATION (Net)
        -- Formula: (ItemTotal - (ItemTotal/Subtotal * HeaderDiscount)) / Qty
        IF v_sales_item.quantity = 0 OR COALESCE(v_order.subtotal_amount, 0) = 0 THEN
            v_net_unit_price := 0;
        ELSE
            v_net_unit_price := (
                v_sales_item.total_amount - 
                ( (v_sales_item.total_amount / v_order.subtotal_amount) * COALESCE(v_order.discount_amount, 0) )
            ) / v_sales_item.quantity;
        END IF;
        
        v_item_credit_value := (v_item->>'qty_returned')::NUMERIC * v_net_unit_price;
        
        -- Get Cost (Snapshot or Fallback)
        -- Ideally, we should trace the original sales_delivery movement cost.
        -- Usage: v_prod_cost := (v_item->>'unit_cost')::NUMERIC; (Still using payload for cost as tracing old cost is hard in SQL alone without massive CTEs)
        -- But Cost affects COGS, not Client Credit.
        v_prod_cost := COALESCE((v_item->>'unit_cost')::NUMERIC, 0);

        -- Insert Inventory Movement (ENTRADA)
        INSERT INTO public.inventory_movements (
            company_id, item_id, movement_type, qty_base, 
            unit_cost, total_cost,
            reason, reference_type, reference_id,
            notes, created_at, created_by
        ) VALUES (
            v_company_id, v_sales_item.item_id, 'ENTRADA', (v_item->>'qty_returned')::NUMERIC,
            v_prod_cost, (v_item->>'qty_returned')::NUMERIC * v_prod_cost,
            'customer_return', 'delivery', v_delivery_id,
            'Devolução Pedido #' || v_order_number,
            NOW(), p_user_id
        );

        -- Sum Credit Value (TRUSTED)
        v_total_credit := v_total_credit + v_item_credit_value;
    END LOOP;

    -- 4. Financial (Credit Generation)
    IF (p_payload->>'settlement') = 'CREDIT' AND v_total_credit > 0 THEN
        -- Create Financial Event
        INSERT INTO public.financial_events (
            company_id, origin_type, origin_id, origin_reference,
            partner_id, partner_name, direction, issue_date, total_amount,
            status, notes, created_at
        ) VALUES (
            v_company_id, 'RETURN', p_order_id, 
            'Devolução #' || v_order_number || '-' || substring(v_event_id::text, 1, 8),
            v_client_id, 'Cliente (Crédito)', 'AP', CURRENT_DATE, v_total_credit,
            'pending',
            'Crédito gerado por devolução: ' || v_reason_text,
            NOW()
        ) RETURNING id INTO v_financial_event_id;
        
        -- Create Installment
        INSERT INTO public.financial_event_installments (
            event_id, installment_number, due_date, amount, payment_condition
        ) VALUES (
            v_financial_event_id, 1, CURRENT_DATE, v_total_credit, 'À vista'
        );
        
        -- Create AP Title
        INSERT INTO public.ap_titles (
            company_id, supplier_id, document_number, 
            amount_total, amount_open, 
            issue_date, due_date, 
            status, source_event_id, description
        ) VALUES (
            v_company_id, v_client_id, 
            'CR-' || v_order_number || '-' || substring(v_event_id::text, 1, 5),
            v_total_credit, v_total_credit,
            CURRENT_DATE, CURRENT_DATE,
            'PENDING_APPROVAL', v_financial_event_id,
            'Crédito por Devolução - Pedido #' || v_order_number
        );
    END IF;

    RETURN jsonb_build_object('success', true, 'event_id', v_event_id, 'total_credit', v_total_credit);
END;
$$;
