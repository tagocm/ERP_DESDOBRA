export interface TaxGroupDTO {
    id: string;
    company_id: string;
    name: string;
    description?: string;
    ncm?: string | null;
    cest?: string | null;
    origin_default?: number;
    is_active: boolean;
    observation?: string | null;
}

export interface FiscalOperationDTO {
    id: string;
    company_id: string;
    tax_group_id: string;
    uf_origem: string; // Pattern B: Origin State
    destination_state: string; // UF
    customer_ie_indicator: 'contributor' | 'exempt' | 'non_contributor';
    customer_is_final_consumer: boolean;
    operation_type: 'sales' | 'return' | 'shipment' | 'bonus';

    cfop: string;

    // ICMS
    icms_cst?: string;
    icms_csosn?: string;
    icms_modal_bc?: string;
    icms_reduction_bc_percent?: number;
    icms_rate_percent: number;
    icms_show_in_xml: boolean;

    // ST
    st_applies: boolean;
    st_modal_bc?: string;
    st_mva_percent?: number;
    st_reduction_bc_percent?: number;
    st_rate_percent?: number;
    st_fcp_percent?: number;

    // PIS
    pis_applies: boolean;
    pis_cst?: string;
    pis_rate_percent?: number;

    // COFINS
    cofins_applies: boolean;
    cofins_cst?: string;
    cofins_rate_percent?: number;

    // IPI
    ipi_applies: boolean;
    ipi_cst?: string;
    ipi_rate_percent?: number;

    is_active: boolean;
    created_at?: string;
    updated_at?: string;
    deleted_at?: string;

    // Joined Fields
    tax_group?: { name: string };
}

export interface CfopDTO {
    id: string;
    codigo: string;
    descricao: string;
    tipo_operacao: 'entrada' | 'saida';
    ambito: 'estadual' | 'interestadual' | 'exterior';
    ativo: boolean;
}
