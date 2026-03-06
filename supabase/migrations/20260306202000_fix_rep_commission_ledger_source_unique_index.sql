BEGIN;

-- O ON CONFLICT (company_id, source_key) usado nas RPCs de comissões
-- precisa de índice/constraint UNIQUE não-parcial para inferência automática.
-- UNIQUE normal continua permitindo múltiplos NULLs em source_key.
DROP INDEX IF EXISTS public.rep_commission_ledger_source_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS rep_commission_ledger_source_uidx
    ON public.rep_commission_ledger (company_id, source_key);

COMMIT;

