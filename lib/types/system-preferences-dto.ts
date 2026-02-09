export interface SystemOccurrenceTypeDTO {
    id: string
    code: string
    label: string
    active: boolean
    sort_order: number
    created_at: string
    updated_at: string
}

export interface SystemOccurrenceReasonDTO {
    id: string
    type_code: string
    label: string
    active: boolean
    sort_order: number
    created_at: string
    updated_at: string
}

export interface SystemOccurrenceReasonDefaultDTO {
    id: string
    reason_id: string
    require_note: boolean
    allow_override: boolean
    return_to_sandbox_pending: boolean
    register_attempt_note: boolean
    reverse_stock_and_finance: boolean
    create_devolution: boolean
    create_new_order_for_pending: boolean
    create_complement_order: boolean
    write_internal_notes: boolean
    default_actions: Record<string, any>
    created_at: string
    updated_at: string
}

export interface SystemOccurrenceReasonWithDefaultsDTO extends SystemOccurrenceReasonDTO {
    defaults: SystemOccurrenceReasonDefaultDTO | null
}
