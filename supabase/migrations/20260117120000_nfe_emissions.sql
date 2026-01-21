-- Create table for NF-e emissions
-- Manages the full lifecycle of NF-e authorization with SEFAZ

CREATE TABLE IF NOT EXISTS nfe_emissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    sales_document_id UUID REFERENCES sales_documents(id) ON DELETE SET NULL,
    
    -- Identificação NF-e
    access_key VARCHAR(44) NOT NULL UNIQUE, -- chave de acesso (chNFe)
    numero VARCHAR(9) NOT NULL,
    serie VARCHAR(3) NOT NULL,
    modelo VARCHAR(2) DEFAULT '55',
    
    -- Status do processo
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- Valores possíveis: 'draft', 'signed', 'sent', 'processing', 'authorized', 'rejected', 'denied', 'error'
    
    -- Dados do lote
    id_lote VARCHAR(15), -- identificador único do lote
    ind_sinc VARCHAR(1), -- '0'=assíncrono, '1'=síncrono
    
    -- Recibo (para fluxo assíncrono)
    n_recibo VARCHAR(15), -- número do recibo (cStat 103)
    
    -- XMLs
    xml_unsigned TEXT, -- XML gerado sem assinatura
    xml_signed TEXT NOT NULL, -- XML assinado (enviado)
    xml_sent TEXT, -- XML do envelope enviado (SOAP + NFe)
    xml_nfe_proc TEXT, -- nfeProc (NFe + protNFe) - XML autorizado final
    
    -- Resposta da SEFAZ
    c_stat VARCHAR(3), -- código de status retornado
    x_motivo TEXT, -- mensagem/motivo
    dh_recbto TIMESTAMPTZ, -- data/hora de recebimento pela SEFAZ
    
    -- Protocolo de autorização
    n_prot VARCHAR(15), -- número do protocolo
    digest_value TEXT, -- digest do protocolo (validação)
    
    -- Ambiente e UF
    tp_amb VARCHAR(1) NOT NULL, -- '1'=produção, '2'=homologação
    uf VARCHAR(2) DEFAULT 'SP',
    
    -- Controle de tentativas e retry
    attempts INT DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    authorized_at TIMESTAMPTZ -- momento da autorização
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_nfe_emissions_company ON nfe_emissions(company_id);
CREATE INDEX IF NOT EXISTS idx_nfe_emissions_status ON nfe_emissions(status);
CREATE INDEX IF NOT EXISTS idx_nfe_emissions_access_key ON nfe_emissions(access_key);
CREATE INDEX IF NOT EXISTS idx_nfe_emissions_sales_doc ON nfe_emissions(sales_document_id);
CREATE INDEX IF NOT EXISTS idx_nfe_emissions_created_at ON nfe_emissions(created_at DESC);

-- Constraint: access_key por company deve ser único
CREATE UNIQUE INDEX IF NOT EXISTS idx_nfe_emissions_company_key ON nfe_emissions(company_id, access_key);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_nfe_emissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Atualizar authorized_at quando status muda para authorized
    IF NEW.status = 'authorized' AND OLD.status != 'authorized' THEN
        NEW.authorized_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_nfe_emissions_updated_at
    BEFORE UPDATE ON nfe_emissions
    FOR EACH ROW
    EXECUTE FUNCTION update_nfe_emissions_updated_at();

-- RLS (Row Level Security) - usuários só veem emissões de suas empresas
ALTER TABLE nfe_emissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY nfe_emissions_select_policy ON nfe_emissions
    FOR SELECT
    USING (
        company_id IN (
            SELECT company_id FROM company_members 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY nfe_emissions_insert_policy ON nfe_emissions
    FOR INSERT
    WITH CHECK (
        company_id IN (
            SELECT company_id FROM company_members 
            WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY nfe_emissions_update_policy ON nfe_emissions
    FOR UPDATE
    USING (
        company_id IN (
            SELECT company_id FROM company_members 
            WHERE auth_user_id = auth.uid()
        )
    );
