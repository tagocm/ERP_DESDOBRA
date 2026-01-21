-- Create delivery_route_order_occurrences table
CREATE TABLE IF NOT EXISTS delivery_route_order_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id),
    route_id UUID NOT NULL REFERENCES delivery_routes(id),
    sales_document_id UUID NOT NULL REFERENCES sales_documents(id),
    occurrence_type TEXT NOT NULL CHECK (occurrence_type IN ('NOT_LOADED_TOTAL', 'PARTIAL_LOADED')),
    reason_id UUID REFERENCES occurrence_reasons(id), -- Nullable for 'Outros'
    reason_name_snapshot TEXT NOT NULL,
    observation TEXT,
    payload JSONB, -- For partial loaded items details
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Processing fields
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES auth.users(id),
    processing_result JSONB,

    -- Ensure one occurrence per order per route (active/draft)
    -- We use a unique index partial or just unique constraint if we delete/process them?
    -- User said "1 ocorrência ativa por (route_id, sales_document_id)".
    -- Let's just use UNIQUE(route_id, sales_document_id) for now, assuming we don't need history in THIS table for the same route session.
    UNIQUE(route_id, sales_document_id)
);

-- Add flags to sales_documents
ALTER TABLE sales_documents 
ADD COLUMN IF NOT EXISTS needs_commercial_attention BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS needs_finance_attention BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS logistic_last_occurrence_at TIMESTAMP WITH TIME ZONE;

-- Add RLS Policies
ALTER TABLE delivery_route_order_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for authenticated users" ON delivery_route_order_occurrences
    FOR SELECT
    TO authenticated
    USING (is_member_of(company_id));

CREATE POLICY "Enable insert access for authenticated users" ON delivery_route_order_occurrences
    FOR INSERT
    TO authenticated
    WITH CHECK (is_member_of(company_id));

CREATE POLICY "Enable update access for authenticated users" ON delivery_route_order_occurrences
    FOR UPDATE
    TO authenticated
    USING (is_member_of(company_id));

CREATE POLICY "Enable delete access for authenticated users" ON delivery_route_order_occurrences
    FOR DELETE
    TO authenticated
    USING (is_member_of(company_id));
