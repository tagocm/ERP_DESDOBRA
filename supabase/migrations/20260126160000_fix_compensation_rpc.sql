-- Migration: Fix Compensation RPC
-- Description: Remove reference to updated_at column in ar_titles/ap_titles as it doesn't exist.

CREATE OR REPLACE FUNCTION process_financial_compensation(
    p_event_id UUID,
    p_credit_title_id UUID, -- The newly created AP Title (Credit Note) from the event
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_alloc RECORD;
    v_settlement_id UUID;
    v_total_allocated NUMERIC(15, 2) := 0;
    v_company_id UUID;
BEGIN
    SELECT company_id INTO v_company_id FROM financial_events WHERE id = p_event_id;

    -- Check if there are allocations
    IF NOT EXISTS (SELECT 1 FROM financial_event_allocations WHERE source_event_id = p_event_id) THEN
        RETURN jsonb_build_object('processed', false, 'reason', 'no_allocations');
    END IF;

    -- 1. Create a "Compensation" Financial Settlement (No Bank Trans)
    INSERT INTO financial_settlements (
        company_id,
        settlement_date,
        total_amount,
        type,
        notes,
        created_at,
        created_by
    ) VALUES (
        v_company_id,
        CURRENT_DATE,
        0, -- Will update later
        'COMPENSACAO',
        'Compensação de Crédito (Evento #' || substring(p_event_id::text, 1, 8) || ')',
        NOW(),
        p_user_id
    ) RETURNING id INTO v_settlement_id;

    -- 2. Loop Allocations
    FOR v_alloc IN 
        SELECT * FROM financial_event_allocations 
        WHERE source_event_id = p_event_id
    LOOP
        -- A. Debit the AR Title (Reduce Open Amount)
        INSERT INTO title_settlements (
            settlement_id,
            title_id,
            title_type, -- 'REC' (Receivable)
            amount,
            interest_amount,
            penalty_amount,
            discount_amount
        ) VALUES (
            v_settlement_id,
            v_alloc.target_title_id,
            'REC',
            v_alloc.amount,
            0, 0, 0
        );
        
        -- Update AR Title Balance
        UPDATE ar_titles 
        SET amount_open = amount_open - v_alloc.amount,
            status = CASE WHEN (amount_open - v_alloc.amount) <= 0.009 THEN 'SETTLED' ELSE 'OPEN' END
            -- updated_at removed
        WHERE id = v_alloc.target_title_id;
        
        -- B. Credit the AP Title (Use the Credit Note we just created)
        INSERT INTO title_settlements (
            settlement_id,
            title_id,
            title_type, -- 'PAG' (Payable)
            amount,
            interest_amount,
            penalty_amount,
            discount_amount
        ) VALUES (
            v_settlement_id,
            p_credit_title_id,
            'PAG',
            v_alloc.amount,
            0, 0, 0
        );

        v_total_allocated := v_total_allocated + v_alloc.amount;
    END LOOP;

    -- 3. Update AP Title (Credit Note) Balance
    UPDATE ap_titles
    SET amount_open = amount_open - v_total_allocated,
        status = CASE WHEN (amount_open - v_total_allocated) <= 0.009 THEN 'SETTLED' ELSE 'OPEN' END
        -- updated_at removed
    WHERE id = p_credit_title_id;

    -- 4. Update Settlement Total
    UPDATE financial_settlements
    SET total_amount = v_total_allocated
    WHERE id = v_settlement_id;

    RETURN jsonb_build_object('processed', true, 'settlement_id', v_settlement_id, 'amount', v_total_allocated);
END;
$$;
