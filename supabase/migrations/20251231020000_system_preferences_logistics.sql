-- Create system_occurrence_types
CREATE TABLE IF NOT EXISTS system_occurrence_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code text UNIQUE NOT NULL,
    label text NOT NULL,
    active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create system_occurrence_reasons
CREATE TABLE IF NOT EXISTS system_occurrence_reasons (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type_code text NOT NULL REFERENCES system_occurrence_types(code),
    label text NOT NULL,
    active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create system_occurrence_reason_defaults
CREATE TABLE IF NOT EXISTS system_occurrence_reason_defaults (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    reason_id uuid NOT NULL REFERENCES system_occurrence_reasons(id) ON DELETE CASCADE,
    require_note boolean DEFAULT false,
    allow_override boolean DEFAULT true,
    
    -- Actions (Booleans as requested)
    return_to_sandbox_pending boolean DEFAULT false,
    register_attempt_note boolean DEFAULT false,
    reverse_stock_and_finance boolean DEFAULT false,
    create_devolution boolean DEFAULT false,
    create_new_order_for_pending boolean DEFAULT false,
    create_complement_order boolean DEFAULT false,
    write_internal_notes boolean DEFAULT false,
    
    -- Extra expansion
    default_actions jsonb DEFAULT '{}'::jsonb,
    
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create order_occurrence_logs
CREATE TABLE IF NOT EXISTS order_occurrence_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id uuid NOT NULL, 
    route_id uuid, 
    type_code text NOT NULL,
    reason_id uuid REFERENCES system_occurrence_reasons(id),
    reason_label_snapshot text,
    note text,
    actions_applied jsonb,
    created_by_user_id uuid, 
    created_at timestamptz DEFAULT now()
);

-- Create route_event_logs
CREATE TABLE IF NOT EXISTS route_event_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id uuid NOT NULL, 
    event_code text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    created_by_user_id uuid,
    created_at timestamptz DEFAULT now()
);

-- Seeds
INSERT INTO system_occurrence_types (code, label, sort_order) VALUES
('EXPEDICAO_NAO_CARREGADO', 'Expedição - Não Carregado', 10),
('EXPEDICAO_CARREGADO_PARCIAL', 'Expedição - Carregado Parcial', 20),
('RETORNO_ENTREGUE', 'Retorno - Entregue', 30),
('RETORNO_ENTREGA_PARCIAL', 'Retorno - Entrega Parcial', 40),
('RETORNO_NAO_ENTREGUE', 'Retorno - Não Entregue', 50)
ON CONFLICT (code) DO NOTHING;

-- Function to helper insert reasons and defaults
CREATE OR REPLACE FUNCTION insert_system_reason(
    p_type_code text,
    p_label text,
    p_sort_order int,
    p_require_note boolean,
    p_return_to_sandbox_pending boolean DEFAULT false,
    p_register_attempt_note boolean DEFAULT false,
    p_reverse_stock_and_finance boolean DEFAULT false,
    p_create_devolution boolean DEFAULT false,
    p_create_new_order_for_pending boolean DEFAULT false,
    p_create_complement_order boolean DEFAULT false,
    p_write_internal_notes boolean DEFAULT false
) RETURNS void AS $$
DECLARE
    v_reason_id uuid;
BEGIN
    INSERT INTO system_occurrence_reasons (type_code, label, sort_order)
    VALUES (p_type_code, p_label, p_sort_order)
    RETURNING id INTO v_reason_id;

    INSERT INTO system_occurrence_reason_defaults (
        reason_id, require_note, 
        return_to_sandbox_pending, register_attempt_note, reverse_stock_and_finance,
        create_devolution, create_new_order_for_pending,
        create_complement_order, write_internal_notes
    ) VALUES (
        v_reason_id, p_require_note,
        p_return_to_sandbox_pending, p_register_attempt_note, p_reverse_stock_and_finance,
        p_create_devolution, p_create_new_order_for_pending,
        p_create_complement_order, p_write_internal_notes
    );
END;
$$ LANGUAGE plpgsql;

-- Seeds for Reasons
-- RETORNO_NAO_ENTREGUE
SELECT insert_system_reason('RETORNO_NAO_ENTREGUE', 'Cliente pediu para adiar', 10, false, 
    true, true, true, false, false, false, false);

SELECT insert_system_reason('RETORNO_NAO_ENTREGUE', 'Cliente fechado / não recebeu', 20, false, 
    true, true, true, false, false, false, false);

SELECT insert_system_reason('RETORNO_NAO_ENTREGUE', 'Endereço incorreto', 30, false, 
    true, true, true, false, false, false, false);

SELECT insert_system_reason('RETORNO_NAO_ENTREGUE', 'Outros', 99, true, 
    true, true, true, false, false, false, false);

-- RETORNO_ENTREGA_PARCIAL
SELECT insert_system_reason('RETORNO_ENTREGA_PARCIAL', 'Faltou produto', 10, false, 
    false, false, false, true, false, false, false);
    
SELECT insert_system_reason('RETORNO_ENTREGA_PARCIAL', 'Cliente aceitou parcial', 20, false, 
    false, false, false, true, false, false, false);

-- EXPEDICAO_NAO_CARREGADO
SELECT insert_system_reason('EXPEDICAO_NAO_CARREGADO', 'Cliente pediu para adiar', 10, false, 
    true, true, false, false, false, false, false);

SELECT insert_system_reason('EXPEDICAO_NAO_CARREGADO', 'Falta de estoque', 20, false, 
    true, true, false, false, false, false, false);

-- EXPEDICAO_CARREGADO_PARCIAL
SELECT insert_system_reason('EXPEDICAO_CARREGADO_PARCIAL', 'Falta de estoque', 10, false, 
    false, false, false, false, false, true, true);

DROP FUNCTION insert_system_reason;

-- RLS Policies
ALTER TABLE system_occurrence_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_occurrence_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_occurrence_reason_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_occurrence_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE route_event_logs ENABLE ROW LEVEL SECURITY;

-- Read policies
CREATE POLICY "Allow read access for authenticated users" ON system_occurrence_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON system_occurrence_reasons FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON system_occurrence_reason_defaults FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON order_occurrence_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access for authenticated users" ON route_event_logs FOR SELECT TO authenticated USING (true);

-- Write policies
CREATE POLICY "Allow full access for authenticated users" ON system_occurrence_types FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow full access for authenticated users" ON system_occurrence_reasons FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow full access for authenticated users" ON system_occurrence_reason_defaults FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow insert for logs" ON order_occurrence_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow insert for logs" ON route_event_logs FOR INSERT TO authenticated WITH CHECK (true);
