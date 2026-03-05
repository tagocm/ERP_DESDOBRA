BEGIN;

ALTER TABLE public.fiscal_inbound_dfe
    DROP CONSTRAINT IF EXISTS ck_fiscal_inbound_dfe_chnfe,
    DROP CONSTRAINT IF EXISTS ck_fiscal_inbound_dfe_emit_cnpj,
    DROP CONSTRAINT IF EXISTS ck_fiscal_inbound_dfe_dest_cnpj;

ALTER TABLE public.fiscal_inbound_dfe
    ADD CONSTRAINT ck_fiscal_inbound_dfe_chnfe
        CHECK (chnfe IS NULL OR chnfe ~ '^[0-9]{44}$'),
    ADD CONSTRAINT ck_fiscal_inbound_dfe_emit_cnpj
        CHECK (emit_cnpj IS NULL OR emit_cnpj ~ '^[0-9]{14}$'),
    ADD CONSTRAINT ck_fiscal_inbound_dfe_dest_cnpj
        CHECK (dest_cnpj IS NULL OR dest_cnpj ~ '^[0-9]{14}$');

ALTER TABLE public.fiscal_inbound_manifest_events
    DROP CONSTRAINT IF EXISTS ck_fiscal_inbound_manifest_events_chnfe;

ALTER TABLE public.fiscal_inbound_manifest_events
    ADD CONSTRAINT ck_fiscal_inbound_manifest_events_chnfe
        CHECK (chnfe ~ '^[0-9]{44}$');

COMMIT;
