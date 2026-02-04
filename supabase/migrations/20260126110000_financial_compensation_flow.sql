-- Migration: Financial Event Allocations (Compensation Logic)
-- Description: Adds table to store planned compensations involved in Financial Events (Pre-Entries)

-- 1. Table for Allocations (Staging / Pre-Approval)


-- Existing logic below
CREATE TABLE IF NOT EXISTS financial_event_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Source Event (The Credit Event, e.g., Return)
    source_event_id UUID NOT NULL REFERENCES financial_events(id) ON DELETE CASCADE,
    
    -- Target (The Debit/Receivable to offset)
    -- We allow targeting an EXISTING Title (ar_titles) 
    target_title_id UUID NOT NULL REFERENCES ar_titles(id),
    
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT financial_event_allocations_unique_target UNIQUE (source_event_id, target_title_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_fin_event_allocations_source ON financial_event_allocations(source_event_id);
CREATE INDEX IF NOT EXISTS idx_fin_event_allocations_target ON financial_event_allocations(target_title_id);

-- 2. Function to Process Compensation on Approval
-- Called by the application layer or trigger when event status -> 'approved'
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
    -- This groups all the offsets
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
        -- Create Title Settlement Record (Link AR Title to Settlement)
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
            status = CASE WHEN (amount_open - v_alloc.amount) <= 0.009 THEN 'SETTLED' ELSE 'OPEN' END,
            updated_at = NOW()
        WHERE id = v_alloc.target_title_id;
        
        -- B. Credit the AP Title (Use the Credit Note we just created)
        -- We add a matching entry in title_settlements for the AP side?
        -- Usually settlements link multiple titles. 
        -- If we are using the AP Title as the source of funds ("Paying" the AR Title with the AP Title).
        
        -- Link AP Title (Credit Note) to Settlement
        -- Note: title_type 'PAY' for AP Titles
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
    -- It was likely created as OPEN. Now consume it.
    UPDATE ap_titles
    SET amount_open = amount_open - v_total_allocated,
        status = CASE WHEN (amount_open - v_total_allocated) <= 0.009 THEN 'SETTLED' ELSE 'OPEN' END,
        updated_at = NOW()
    WHERE id = p_credit_title_id;

    -- 4. Update Settlement Total
    UPDATE financial_settlements
    SET total_amount = v_total_allocated
    WHERE id = v_settlement_id;

    RETURN jsonb_build_object('processed', true, 'settlement_id', v_settlement_id, 'amount', v_total_allocated);
END;
$$;
