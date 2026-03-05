BEGIN;

-- =====================================================
-- Sales documents commission metadata (source of truth)
-- =====================================================
ALTER TABLE public.sales_documents
    ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(7, 4);

ALTER TABLE public.sales_documents
    ADD COLUMN IF NOT EXISTS commission_rate_source TEXT;

ALTER TABLE public.sales_documents
    ADD COLUMN IF NOT EXISTS commission_rate_updated_at TIMESTAMPTZ;

ALTER TABLE public.sales_documents
    ADD COLUMN IF NOT EXISTS commission_rate_updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Keep deterministic defaults for new rows.
UPDATE public.sales_documents
SET commission_rate = COALESCE(commission_rate, 0),
    commission_rate_source = COALESCE(commission_rate_source, 'MANUAL')
WHERE commission_rate IS NULL
   OR commission_rate_source IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'sales_documents_commission_rate_range_ck'
          AND conrelid = 'public.sales_documents'::regclass
    ) THEN
        ALTER TABLE public.sales_documents
            ADD CONSTRAINT sales_documents_commission_rate_range_ck
            CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));
    END IF;
END
$$;

-- =====================================================
-- Commission settlement core tables
-- =====================================================
CREATE TABLE IF NOT EXISTS public.commission_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    cutoff_date DATE NOT NULL,
    allow_advance BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'RASCUNHO',
    total_paid NUMERIC(15, 2) NOT NULL DEFAULT 0,
    request_key TEXT,
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'commission_settlements_status_ck'
          AND conrelid = 'public.commission_settlements'::regclass
    ) THEN
        ALTER TABLE public.commission_settlements
            ADD CONSTRAINT commission_settlements_status_ck
            CHECK (status IN ('RASCUNHO', 'CONFIRMADO', 'CANCELADO'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS commission_settlements_company_rep_idx
    ON public.commission_settlements (company_id, rep_id, created_at DESC);

CREATE INDEX IF NOT EXISTS commission_settlements_company_status_idx
    ON public.commission_settlements (company_id, status, cutoff_date DESC);

CREATE UNIQUE INDEX IF NOT EXISTS commission_settlements_request_key_uidx
    ON public.commission_settlements (company_id, rep_id, request_key)
    WHERE request_key IS NOT NULL;

DROP TRIGGER IF EXISTS commission_settlements_updated_at ON public.commission_settlements;
CREATE TRIGGER commission_settlements_updated_at
    BEFORE UPDATE ON public.commission_settlements
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.commission_entitlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    delivery_id UUID NOT NULL REFERENCES public.delivery_items(id) ON DELETE CASCADE,
    base_delivered_amount NUMERIC(15, 2) NOT NULL,
    commission_rate NUMERIC(7, 4) NOT NULL,
    commission_total NUMERIC(15, 2) NOT NULL,
    settlement_id UUID NULL REFERENCES public.commission_settlements(id) ON DELETE SET NULL,
    origin_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'commission_entitlements_rate_ck'
          AND conrelid = 'public.commission_entitlements'::regclass
    ) THEN
        ALTER TABLE public.commission_entitlements
            ADD CONSTRAINT commission_entitlements_rate_ck
            CHECK (commission_rate >= 0 AND commission_rate <= 100);
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS commission_entitlements_origin_uidx
    ON public.commission_entitlements (company_id, origin_key);

CREATE INDEX IF NOT EXISTS commission_entitlements_company_rep_idx
    ON public.commission_entitlements (company_id, rep_id, created_at DESC);

CREATE INDEX IF NOT EXISTS commission_entitlements_order_idx
    ON public.commission_entitlements (order_id);

CREATE INDEX IF NOT EXISTS commission_entitlements_settlement_idx
    ON public.commission_entitlements (settlement_id);

DROP TRIGGER IF EXISTS commission_entitlements_updated_at ON public.commission_entitlements;
CREATE TRIGGER commission_entitlements_updated_at
    BEFORE UPDATE ON public.commission_entitlements
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.commission_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    entitlement_id UUID NOT NULL REFERENCES public.commission_entitlements(id) ON DELETE CASCADE,
    payment_id UUID NOT NULL REFERENCES public.ar_payments(id) ON DELETE CASCADE,
    base_paid_amount NUMERIC(15, 2) NOT NULL,
    commission_released_amount NUMERIC(15, 2) NOT NULL,
    settlement_id UUID NULL REFERENCES public.commission_settlements(id) ON DELETE SET NULL,
    origin_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS commission_releases_origin_uidx
    ON public.commission_releases (company_id, origin_key);

CREATE INDEX IF NOT EXISTS commission_releases_company_rep_idx
    ON public.commission_releases (company_id, rep_id, created_at DESC);

CREATE INDEX IF NOT EXISTS commission_releases_order_idx
    ON public.commission_releases (order_id);

CREATE INDEX IF NOT EXISTS commission_releases_settlement_idx
    ON public.commission_releases (settlement_id);

DROP TRIGGER IF EXISTS commission_releases_updated_at ON public.commission_releases;
CREATE TRIGGER commission_releases_updated_at
    BEFORE UPDATE ON public.commission_releases
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.commission_settlement_items (
    settlement_id UUID NOT NULL REFERENCES public.commission_settlements(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    item_id UUID NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (settlement_id, item_type, item_id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'commission_settlement_items_type_ck'
          AND conrelid = 'public.commission_settlement_items'::regclass
    ) THEN
        ALTER TABLE public.commission_settlement_items
            ADD CONSTRAINT commission_settlement_items_type_ck
            CHECK (item_type IN ('RELEASE', 'ENTITLEMENT', 'ADJUSTMENT'));
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS commission_settlement_items_settlement_idx
    ON public.commission_settlement_items (settlement_id, item_type);

CREATE TABLE IF NOT EXISTS public.rep_commission_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    rep_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    entry_type TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    release_id UUID NULL REFERENCES public.commission_releases(id) ON DELETE SET NULL,
    settlement_id UUID NULL REFERENCES public.commission_settlements(id) ON DELETE SET NULL,
    source_key TEXT,
    created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'rep_commission_ledger_entry_type_ck'
          AND conrelid = 'public.rep_commission_ledger'::regclass
    ) THEN
        ALTER TABLE public.rep_commission_ledger
            ADD CONSTRAINT rep_commission_ledger_entry_type_ck
            CHECK (entry_type IN ('RELEASE', 'PAYOUT', 'ADJUSTMENT'));
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS rep_commission_ledger_release_uidx
    ON public.rep_commission_ledger (release_id)
    WHERE release_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rep_commission_ledger_source_uidx
    ON public.rep_commission_ledger (company_id, source_key)
    WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS rep_commission_ledger_company_rep_idx
    ON public.rep_commission_ledger (company_id, rep_id, created_at DESC);

CREATE INDEX IF NOT EXISTS rep_commission_ledger_settlement_idx
    ON public.rep_commission_ledger (settlement_id);

CREATE TABLE IF NOT EXISTS public.order_commission_rate_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES public.sales_documents(id) ON DELETE CASCADE,
    old_rate NUMERIC(7, 4) NOT NULL,
    new_rate NUMERIC(7, 4) NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason TEXT NOT NULL,
    source_context TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS order_commission_rate_history_company_order_idx
    ON public.order_commission_rate_history (company_id, order_id, changed_at DESC);

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE public.commission_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_settlement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_commission_rate_history ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.commission_settlements TO authenticated;
GRANT ALL ON public.commission_entitlements TO authenticated;
GRANT ALL ON public.commission_releases TO authenticated;
GRANT ALL ON public.commission_settlement_items TO authenticated;
GRANT ALL ON public.rep_commission_ledger TO authenticated;
GRANT ALL ON public.order_commission_rate_history TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_settlements' AND policyname = 'commission_settlements_select'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlements_select ON public.commission_settlements FOR SELECT USING (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_settlements' AND policyname = 'commission_settlements_insert'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlements_insert ON public.commission_settlements FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_settlements' AND policyname = 'commission_settlements_update'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlements_update ON public.commission_settlements FOR UPDATE USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_settlements' AND policyname = 'commission_settlements_delete'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlements_delete ON public.commission_settlements FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_entitlements' AND policyname = 'commission_entitlements_select'
    ) THEN
        EXECUTE 'CREATE POLICY commission_entitlements_select ON public.commission_entitlements FOR SELECT USING (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_entitlements' AND policyname = 'commission_entitlements_insert'
    ) THEN
        EXECUTE 'CREATE POLICY commission_entitlements_insert ON public.commission_entitlements FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_entitlements' AND policyname = 'commission_entitlements_update'
    ) THEN
        EXECUTE 'CREATE POLICY commission_entitlements_update ON public.commission_entitlements FOR UPDATE USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_entitlements' AND policyname = 'commission_entitlements_delete'
    ) THEN
        EXECUTE 'CREATE POLICY commission_entitlements_delete ON public.commission_entitlements FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_releases' AND policyname = 'commission_releases_select'
    ) THEN
        EXECUTE 'CREATE POLICY commission_releases_select ON public.commission_releases FOR SELECT USING (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_releases' AND policyname = 'commission_releases_insert'
    ) THEN
        EXECUTE 'CREATE POLICY commission_releases_insert ON public.commission_releases FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_releases' AND policyname = 'commission_releases_update'
    ) THEN
        EXECUTE 'CREATE POLICY commission_releases_update ON public.commission_releases FOR UPDATE USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_releases' AND policyname = 'commission_releases_delete'
    ) THEN
        EXECUTE 'CREATE POLICY commission_releases_delete ON public.commission_releases FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_settlement_items' AND policyname = 'commission_settlement_items_select'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlement_items_select ON public.commission_settlement_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.commission_settlements cs WHERE cs.id = commission_settlement_items.settlement_id AND public.is_member_of(cs.company_id)))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_settlement_items' AND policyname = 'commission_settlement_items_insert'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlement_items_insert ON public.commission_settlement_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.commission_settlements cs WHERE cs.id = commission_settlement_items.settlement_id AND public.is_member_of(cs.company_id)))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_settlement_items' AND policyname = 'commission_settlement_items_update'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlement_items_update ON public.commission_settlement_items FOR UPDATE USING (EXISTS (SELECT 1 FROM public.commission_settlements cs WHERE cs.id = commission_settlement_items.settlement_id AND public.is_member_of(cs.company_id))) WITH CHECK (EXISTS (SELECT 1 FROM public.commission_settlements cs WHERE cs.id = commission_settlement_items.settlement_id AND public.is_member_of(cs.company_id)))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'commission_settlement_items' AND policyname = 'commission_settlement_items_delete'
    ) THEN
        EXECUTE 'CREATE POLICY commission_settlement_items_delete ON public.commission_settlement_items FOR DELETE USING (EXISTS (SELECT 1 FROM public.commission_settlements cs WHERE cs.id = commission_settlement_items.settlement_id AND public.is_member_of(cs.company_id)))';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'rep_commission_ledger' AND policyname = 'rep_commission_ledger_select'
    ) THEN
        EXECUTE 'CREATE POLICY rep_commission_ledger_select ON public.rep_commission_ledger FOR SELECT USING (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'rep_commission_ledger' AND policyname = 'rep_commission_ledger_insert'
    ) THEN
        EXECUTE 'CREATE POLICY rep_commission_ledger_insert ON public.rep_commission_ledger FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'rep_commission_ledger' AND policyname = 'rep_commission_ledger_update'
    ) THEN
        EXECUTE 'CREATE POLICY rep_commission_ledger_update ON public.rep_commission_ledger FOR UPDATE USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'rep_commission_ledger' AND policyname = 'rep_commission_ledger_delete'
    ) THEN
        EXECUTE 'CREATE POLICY rep_commission_ledger_delete ON public.rep_commission_ledger FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'order_commission_rate_history' AND policyname = 'order_commission_rate_history_select'
    ) THEN
        EXECUTE 'CREATE POLICY order_commission_rate_history_select ON public.order_commission_rate_history FOR SELECT USING (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'order_commission_rate_history' AND policyname = 'order_commission_rate_history_insert'
    ) THEN
        EXECUTE 'CREATE POLICY order_commission_rate_history_insert ON public.order_commission_rate_history FOR INSERT WITH CHECK (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'order_commission_rate_history' AND policyname = 'order_commission_rate_history_update'
    ) THEN
        EXECUTE 'CREATE POLICY order_commission_rate_history_update ON public.order_commission_rate_history FOR UPDATE USING (public.is_member_of(company_id)) WITH CHECK (public.is_member_of(company_id))';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'order_commission_rate_history' AND policyname = 'order_commission_rate_history_delete'
    ) THEN
        EXECUTE 'CREATE POLICY order_commission_rate_history_delete ON public.order_commission_rate_history FOR DELETE USING (public.is_member_of(company_id))';
    END IF;
END
$$;

-- =====================================================
-- Internal refresh function for entitlements + releases
-- =====================================================
CREATE OR REPLACE FUNCTION public.commission_refresh_rep_open_state(
    p_company_id UUID,
    p_rep_id UUID,
    p_cutoff_date DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff_date DATE;
BEGIN
    IF p_company_id IS NULL OR p_rep_id IS NULL THEN
        RAISE EXCEPTION 'Empresa e representante são obrigatórios.';
    END IF;

    IF NOT public.is_member_of(p_company_id) THEN
        RAISE EXCEPTION 'Acesso negado para empresa %', p_company_id;
    END IF;

    v_cutoff_date := COALESCE(p_cutoff_date, CURRENT_DATE);

    INSERT INTO public.commission_entitlements (
        company_id,
        rep_id,
        order_id,
        delivery_id,
        base_delivered_amount,
        commission_rate,
        commission_total,
        origin_key
    )
    SELECT
        sd.company_id,
        sd.sales_rep_id,
        sd.id,
        di.id,
        ROUND(
            GREATEST(
                0,
                COALESCE(
                    (COALESCE(sdi.total_amount, sdi.unit_price * sdi.quantity)
                        * (COALESCE(di.qty_delivered, 0) / NULLIF(COALESCE(sdi.quantity, 0), 0))),
                    0
                )
            )::NUMERIC,
            2
        ) AS base_delivered_amount,
        COALESCE(sd.commission_rate, 0) AS commission_rate,
        ROUND(
            GREATEST(
                0,
                COALESCE(
                    (COALESCE(sdi.total_amount, sdi.unit_price * sdi.quantity)
                        * (COALESCE(di.qty_delivered, 0) / NULLIF(COALESCE(sdi.quantity, 0), 0)))
                        * (COALESCE(sd.commission_rate, 0) / 100),
                    0
                )
            )::NUMERIC,
            2
        ) AS commission_total,
        'delivery_item:' || di.id::TEXT AS origin_key
    FROM public.delivery_items di
    INNER JOIN public.deliveries d
        ON d.id = di.delivery_id
       AND d.company_id = di.company_id
    INNER JOIN public.sales_document_items sdi
        ON sdi.id = di.sales_document_item_id
       AND sdi.company_id = di.company_id
    INNER JOIN public.sales_documents sd
        ON sd.id = sdi.document_id
       AND sd.company_id = di.company_id
    WHERE di.company_id = p_company_id
      AND sd.sales_rep_id = p_rep_id
      AND sd.deleted_at IS NULL
      AND COALESCE(di.qty_delivered, 0) > 0
      AND COALESCE(d.created_at::DATE, CURRENT_DATE) <= v_cutoff_date
    ON CONFLICT (company_id, origin_key) DO UPDATE
    SET base_delivered_amount = EXCLUDED.base_delivered_amount,
        commission_rate = EXCLUDED.commission_rate,
        commission_total = EXCLUDED.commission_total,
        updated_at = now()
    WHERE public.commission_entitlements.settlement_id IS NULL;

    WITH payment_allocations AS (
        SELECT
            ap.company_id,
            sd.sales_rep_id AS rep_id,
            sd.id AS order_id,
            ap.id AS payment_id,
            ap.paid_at,
            CASE
                WHEN ap.status = 'reversed' THEN -1 * ABS(apa.amount_allocated)
                ELSE apa.amount_allocated
            END AS amount_allocated
        FROM public.ar_payment_allocations apa
        INNER JOIN public.ar_payments ap
            ON ap.id = apa.payment_id
        INNER JOIN public.ar_installments ai
            ON ai.id = apa.installment_id
        INNER JOIN public.ar_titles at
            ON at.id = ai.ar_title_id
           AND at.company_id = ap.company_id
        INNER JOIN public.sales_documents sd
            ON sd.id = at.sales_document_id
           AND sd.company_id = ap.company_id
        WHERE ap.company_id = p_company_id
          AND sd.sales_rep_id = p_rep_id
          AND ap.status IN ('confirmed', 'reversed')
          AND ap.paid_at::DATE <= v_cutoff_date
          AND sd.deleted_at IS NULL
    ),
    order_delivered_bases AS (
        SELECT
            e.order_id,
            SUM(e.base_delivered_amount) AS delivered_base_total
        FROM public.commission_entitlements e
        WHERE e.company_id = p_company_id
          AND e.rep_id = p_rep_id
        GROUP BY e.order_id
    )
    INSERT INTO public.commission_releases (
        company_id,
        rep_id,
        order_id,
        entitlement_id,
        payment_id,
        base_paid_amount,
        commission_released_amount,
        origin_key
    )
    SELECT
        e.company_id,
        e.rep_id,
        e.order_id,
        e.id AS entitlement_id,
        pa.payment_id,
        ROUND(
            (pa.amount_allocated * (e.base_delivered_amount / NULLIF(odb.delivered_base_total, 0)))::NUMERIC,
            2
        ) AS base_paid_amount,
        ROUND(
            (
                (pa.amount_allocated * (e.base_delivered_amount / NULLIF(odb.delivered_base_total, 0)))
                * (e.commission_rate / 100)
            )::NUMERIC,
            2
        ) AS commission_released_amount,
        'payment:' || pa.payment_id::TEXT || ':entitlement:' || e.id::TEXT AS origin_key
    FROM payment_allocations pa
    INNER JOIN order_delivered_bases odb
        ON odb.order_id = pa.order_id
    INNER JOIN public.commission_entitlements e
        ON e.order_id = pa.order_id
       AND e.company_id = pa.company_id
       AND e.rep_id = pa.rep_id
    WHERE odb.delivered_base_total > 0
    ON CONFLICT (company_id, origin_key) DO UPDATE
    SET base_paid_amount = EXCLUDED.base_paid_amount,
        commission_released_amount = EXCLUDED.commission_released_amount,
        updated_at = now()
    WHERE public.commission_releases.settlement_id IS NULL;

    INSERT INTO public.rep_commission_ledger (
        company_id,
        rep_id,
        entry_type,
        amount,
        release_id,
        source_key,
        notes,
        created_by
    )
    SELECT
        r.company_id,
        r.rep_id,
        'RELEASE',
        r.commission_released_amount,
        r.id,
        'release:' || r.id::TEXT,
        'Liberação proporcional por pagamento do cliente',
        auth.uid()
    FROM public.commission_releases r
    WHERE r.company_id = p_company_id
      AND r.rep_id = p_rep_id
      AND NOT EXISTS (
          SELECT 1
          FROM public.rep_commission_ledger l
          WHERE l.release_id = r.id
      );
END;
$$;

GRANT EXECUTE ON FUNCTION public.commission_refresh_rep_open_state(UUID, UUID, DATE) TO authenticated;

-- =====================================================
-- RPC: get open items
-- =====================================================
CREATE OR REPLACE FUNCTION public.commission_get_rep_open_items(
    p_company_id UUID,
    p_rep_id UUID,
    p_cutoff_date DATE
)
RETURNS TABLE (
    entitlement_id UUID,
    order_id UUID,
    order_number BIGINT,
    customer_id UUID,
    customer_name TEXT,
    delivery_item_id UUID,
    delivered_date DATE,
    status_logistico TEXT,
    status_financeiro TEXT,
    base_delivered_amount NUMERIC,
    commission_rate NUMERIC,
    commission_total NUMERIC,
    released_open_amount NUMERIC,
    unreleased_open_amount NUMERIC,
    total_open_amount NUMERIC,
    max_payable_amount NUMERIC,
    release_item_ids JSONB,
    default_selected BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_company_id IS NULL OR p_rep_id IS NULL THEN
        RAISE EXCEPTION 'Empresa e representante são obrigatórios.';
    END IF;

    IF NOT public.is_member_of(p_company_id) THEN
        RAISE EXCEPTION 'Acesso negado para empresa %', p_company_id;
    END IF;

    PERFORM public.commission_refresh_rep_open_state(p_company_id, p_rep_id, p_cutoff_date);

    RETURN QUERY
    WITH release_open AS (
        SELECT
            r.entitlement_id,
            ROUND(SUM(r.commission_released_amount)::NUMERIC, 2) AS released_open_amount,
            jsonb_agg(r.id ORDER BY r.created_at) AS release_item_ids
        FROM public.commission_releases r
        WHERE r.company_id = p_company_id
          AND r.rep_id = p_rep_id
          AND r.settlement_id IS NULL
        GROUP BY r.entitlement_id
    ),
    release_total AS (
        SELECT
            r.entitlement_id,
            ROUND(SUM(r.commission_released_amount)::NUMERIC, 2) AS released_total_amount
        FROM public.commission_releases r
        WHERE r.company_id = p_company_id
          AND r.rep_id = p_rep_id
        GROUP BY r.entitlement_id
    )
    SELECT
        e.id AS entitlement_id,
        e.order_id,
        sd.document_number::BIGINT AS order_number,
        sd.client_id AS customer_id,
        COALESCE(org.trade_name, org.legal_name, 'Cliente sem nome') AS customer_name,
        e.delivery_id AS delivery_item_id,
        COALESCE(d.created_at::DATE, p_cutoff_date) AS delivered_date,
        COALESCE(sd.status_logistic::TEXT, 'pending') AS status_logistico,
        COALESCE(sd.financial_status::TEXT, 'pending') AS status_financeiro,
        e.base_delivered_amount,
        e.commission_rate,
        e.commission_total,
        COALESCE(ro.released_open_amount, 0) AS released_open_amount,
        ROUND(GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0)::NUMERIC, 2) AS unreleased_open_amount,
        ROUND((COALESCE(ro.released_open_amount, 0) + GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0))::NUMERIC, 2) AS total_open_amount,
        ROUND((COALESCE(ro.released_open_amount, 0) + GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0))::NUMERIC, 2) AS max_payable_amount,
        COALESCE(ro.release_item_ids, '[]'::JSONB) AS release_item_ids,
        (COALESCE(ro.released_open_amount, 0) > 0) AS default_selected
    FROM public.commission_entitlements e
    INNER JOIN public.sales_documents sd
        ON sd.id = e.order_id
       AND sd.company_id = e.company_id
    INNER JOIN public.delivery_items di
        ON di.id = e.delivery_id
       AND di.company_id = e.company_id
    INNER JOIN public.deliveries d
        ON d.id = di.delivery_id
       AND d.company_id = e.company_id
    LEFT JOIN public.organizations org
        ON org.id = sd.client_id
    LEFT JOIN release_open ro
        ON ro.entitlement_id = e.id
    LEFT JOIN release_total rt
        ON rt.entitlement_id = e.id
    WHERE e.company_id = p_company_id
      AND e.rep_id = p_rep_id
      AND e.settlement_id IS NULL
      AND (COALESCE(ro.released_open_amount, 0) > 0 OR GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0) > 0)
    ORDER BY sd.document_number DESC, customer_name ASC, e.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.commission_get_rep_open_items(UUID, UUID, DATE) TO authenticated;

-- =====================================================
-- RPC: apply order rate override
-- =====================================================
CREATE OR REPLACE FUNCTION public.commission_apply_order_rate_override(
    p_company_id UUID,
    p_order_id UUID,
    p_new_rate NUMERIC,
    p_reason TEXT,
    p_changed_by UUID,
    p_source_context TEXT
)
RETURNS TABLE (
    order_id UUID,
    old_rate NUMERIC,
    new_rate NUMERIC,
    open_entitlements_count INTEGER,
    open_releases_count INTEGER,
    adjustment_delta NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_order RECORD;
    v_old_rate NUMERIC;
    v_new_rate NUMERIC;
    v_delta NUMERIC := 0;
    v_entitlements_count INTEGER := 0;
    v_releases_count INTEGER := 0;
    v_source_key TEXT;
BEGIN
    IF p_company_id IS NULL OR p_order_id IS NULL THEN
        RAISE EXCEPTION 'Empresa e pedido são obrigatórios.';
    END IF;

    IF p_new_rate IS NULL OR p_new_rate < 0 OR p_new_rate > 100 THEN
        RAISE EXCEPTION 'Nova taxa de comissão inválida.';
    END IF;

    IF p_reason IS NULL OR btrim(p_reason) = '' THEN
        RAISE EXCEPTION 'Motivo é obrigatório para alterar comissão.';
    END IF;

    IF NOT public.is_member_of(p_company_id) THEN
        RAISE EXCEPTION 'Acesso negado para empresa %', p_company_id;
    END IF;

    SELECT *
      INTO v_order
    FROM public.sales_documents sd
    WHERE sd.id = p_order_id
      AND sd.company_id = p_company_id
      AND sd.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pedido não encontrado para alteração de comissão.';
    END IF;

    v_old_rate := COALESCE(v_order.commission_rate, 0);
    v_new_rate := ROUND(p_new_rate::NUMERIC, 4);

    IF v_old_rate = v_new_rate THEN
        RETURN QUERY
        SELECT p_order_id, v_old_rate, v_new_rate, 0, 0, 0::NUMERIC;
        RETURN;
    END IF;

    UPDATE public.sales_documents
    SET commission_rate = v_new_rate,
        commission_rate_source = 'OVERRIDE_ACERTO',
        commission_rate_updated_at = now(),
        commission_rate_updated_by = p_changed_by,
        updated_at = now()
    WHERE id = p_order_id
      AND company_id = p_company_id;

    INSERT INTO public.order_commission_rate_history (
        company_id,
        order_id,
        old_rate,
        new_rate,
        changed_by,
        reason,
        source_context
    ) VALUES (
        p_company_id,
        p_order_id,
        v_old_rate,
        v_new_rate,
        p_changed_by,
        p_reason,
        COALESCE(NULLIF(btrim(p_source_context), ''), 'finance_commissions')
    );

    UPDATE public.commission_entitlements e
    SET commission_rate = v_new_rate,
        commission_total = ROUND((e.base_delivered_amount * (v_new_rate / 100))::NUMERIC, 2),
        updated_at = now()
    WHERE e.company_id = p_company_id
      AND e.order_id = p_order_id
      AND e.settlement_id IS NULL;

    GET DIAGNOSTICS v_entitlements_count = ROW_COUNT;

    WITH release_delta AS (
        SELECT
            r.id,
            ROUND((r.base_paid_amount * (v_new_rate / 100))::NUMERIC, 2) AS new_release_amount,
            ROUND((ROUND((r.base_paid_amount * (v_new_rate / 100))::NUMERIC, 2) - r.commission_released_amount)::NUMERIC, 2) AS delta
        FROM public.commission_releases r
        WHERE r.company_id = p_company_id
          AND r.order_id = p_order_id
          AND r.settlement_id IS NULL
    ),
    release_update AS (
        UPDATE public.commission_releases r
        SET commission_released_amount = rd.new_release_amount,
            updated_at = now()
        FROM release_delta rd
        WHERE r.id = rd.id
        RETURNING rd.delta
    )
    SELECT
        COALESCE(COUNT(*), 0)::INTEGER,
        COALESCE(ROUND(SUM(delta)::NUMERIC, 2), 0)
    INTO v_releases_count, v_delta
    FROM release_update;

    v_source_key := 'rate_override:' || p_order_id::TEXT || ':' || COALESCE(NULLIF(btrim(p_source_context), ''), 'finance_commissions');

    IF v_delta <> 0 THEN
        INSERT INTO public.rep_commission_ledger (
            company_id,
            rep_id,
            entry_type,
            amount,
            source_key,
            notes,
            created_by
        ) VALUES (
            p_company_id,
            v_order.sales_rep_id,
            'ADJUSTMENT',
            v_delta,
            v_source_key,
            'Ajuste de comissão por alteração de taxa no pedido #' || COALESCE(v_order.document_number::TEXT, p_order_id::TEXT),
            COALESCE(p_changed_by, auth.uid())
        )
        ON CONFLICT (company_id, source_key)
        DO NOTHING;
    END IF;

    RETURN QUERY
    SELECT
        p_order_id,
        v_old_rate,
        v_new_rate,
        v_entitlements_count,
        v_releases_count,
        v_delta;
END;
$$;

GRANT EXECUTE ON FUNCTION public.commission_apply_order_rate_override(UUID, UUID, NUMERIC, TEXT, UUID, TEXT) TO authenticated;

-- =====================================================
-- RPC: confirm settlement (transaction + idempotency)
-- p_selected_items JSON format:
-- [
--   {"item_type":"RELEASE", "item_id":"uuid"},
--   {"item_type":"ENTITLEMENT", "item_id":"uuid"}
-- ]
-- =====================================================
CREATE OR REPLACE FUNCTION public.commission_confirm_settlement(
    p_company_id UUID,
    p_rep_id UUID,
    p_cutoff_date DATE,
    p_allow_advance BOOLEAN,
    p_selected_items JSONB,
    p_total_to_pay NUMERIC,
    p_created_by UUID,
    p_request_key TEXT DEFAULT NULL
)
RETURNS TABLE (
    settlement_id UUID,
    total_released_selected NUMERIC,
    total_advance_selected NUMERIC,
    total_paid NUMERIC,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_settlement_id UUID;
    v_released_total NUMERIC := 0;
    v_advance_total NUMERIC := 0;
    v_total_calc NUMERIC := 0;
    v_total_pay NUMERIC := 0;
    v_company_rep_lock_key BIGINT;
    v_request_key TEXT;
BEGIN
    IF p_company_id IS NULL OR p_rep_id IS NULL THEN
        RAISE EXCEPTION 'Empresa e representante são obrigatórios.';
    END IF;

    IF p_selected_items IS NULL OR jsonb_typeof(p_selected_items) <> 'array' OR jsonb_array_length(p_selected_items) = 0 THEN
        RAISE EXCEPTION 'Selecione ao menos um item para confirmar o acerto.';
    END IF;

    IF NOT public.is_member_of(p_company_id) THEN
        RAISE EXCEPTION 'Acesso negado para empresa %', p_company_id;
    END IF;

    v_request_key := NULLIF(btrim(COALESCE(p_request_key, '')), '');
    v_company_rep_lock_key := hashtext(p_company_id::TEXT || ':' || p_rep_id::TEXT)::BIGINT;
    PERFORM pg_advisory_xact_lock(v_company_rep_lock_key);

    IF v_request_key IS NOT NULL THEN
        SELECT s.id, s.total_paid, s.status
          INTO v_settlement_id, v_total_pay, status
        FROM public.commission_settlements s
        WHERE s.company_id = p_company_id
          AND s.rep_id = p_rep_id
          AND s.request_key = v_request_key
          AND s.status = 'CONFIRMADO'
        LIMIT 1;

        IF v_settlement_id IS NOT NULL THEN
            RETURN QUERY
            SELECT
                v_settlement_id,
                0::NUMERIC,
                0::NUMERIC,
                v_total_pay,
                'CONFIRMADO'::TEXT;
            RETURN;
        END IF;
    END IF;

    PERFORM public.commission_refresh_rep_open_state(p_company_id, p_rep_id, p_cutoff_date);

    INSERT INTO public.commission_settlements (
        company_id,
        rep_id,
        cutoff_date,
        allow_advance,
        status,
        total_paid,
        request_key,
        created_by
    ) VALUES (
        p_company_id,
        p_rep_id,
        COALESCE(p_cutoff_date, CURRENT_DATE),
        COALESCE(p_allow_advance, FALSE),
        'RASCUNHO',
        0,
        v_request_key,
        COALESCE(p_created_by, auth.uid())
    )
    RETURNING id INTO v_settlement_id;

    WITH selected_items AS (
        SELECT
            UPPER(COALESCE(value->>'item_type', '')) AS item_type,
            (value->>'item_id')::UUID AS item_id
        FROM jsonb_array_elements(p_selected_items)
    ),
    valid_releases AS (
        SELECT
            r.id,
            r.commission_released_amount AS amount
        FROM selected_items si
        INNER JOIN public.commission_releases r
            ON si.item_type = 'RELEASE'
           AND si.item_id = r.id
        WHERE r.company_id = p_company_id
          AND r.rep_id = p_rep_id
          AND r.settlement_id IS NULL
        FOR UPDATE OF r SKIP LOCKED
    ),
    release_count AS (
        SELECT COUNT(*)::INTEGER AS qty FROM valid_releases
    ),
    release_sum AS (
        SELECT COALESCE(ROUND(SUM(amount)::NUMERIC, 2), 0) AS amount FROM valid_releases
    ),
    valid_entitlements AS (
        SELECT
            e.id,
            ROUND(GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0)::NUMERIC, 2) AS amount
        FROM selected_items si
        INNER JOIN public.commission_entitlements e
            ON si.item_type = 'ENTITLEMENT'
           AND si.item_id = e.id
        LEFT JOIN (
            SELECT
                entitlement_id,
                SUM(commission_released_amount) AS released_total_amount
            FROM public.commission_releases
            WHERE company_id = p_company_id
              AND rep_id = p_rep_id
            GROUP BY entitlement_id
        ) rt
          ON rt.entitlement_id = e.id
        WHERE e.company_id = p_company_id
          AND e.rep_id = p_rep_id
          AND e.settlement_id IS NULL
          AND GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0) > 0
        FOR UPDATE OF e SKIP LOCKED
    ),
    entitlement_count AS (
        SELECT COUNT(*)::INTEGER AS qty FROM valid_entitlements
    ),
    entitlement_sum AS (
        SELECT COALESCE(ROUND(SUM(amount)::NUMERIC, 2), 0) AS amount FROM valid_entitlements
    )
    SELECT
        rs.amount,
        CASE WHEN COALESCE(p_allow_advance, FALSE) THEN es.amount ELSE 0 END,
        rs.amount + CASE WHEN COALESCE(p_allow_advance, FALSE) THEN es.amount ELSE 0 END
    INTO v_released_total, v_advance_total, v_total_calc
    FROM release_sum rs, entitlement_sum es;

    IF NOT COALESCE(p_allow_advance, FALSE) THEN
        IF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(p_selected_items) si
            WHERE UPPER(COALESCE(si->>'item_type', '')) = 'ENTITLEMENT'
        ) THEN
            RAISE EXCEPTION 'Itens não liberados exigem opção de adiantamento habilitada.';
        END IF;
    END IF;

    IF v_total_calc <= 0 THEN
        RAISE EXCEPTION 'Nenhum valor elegível para pagamento no acerto.';
    END IF;

    IF p_total_to_pay IS NOT NULL THEN
        v_total_pay := ROUND(p_total_to_pay::NUMERIC, 2);
        IF ABS(v_total_pay - v_total_calc) > 0.01 THEN
            RAISE EXCEPTION 'Total informado (%.2f) difere do total elegível selecionado (%.2f).', v_total_pay, v_total_calc;
        END IF;
    ELSE
        v_total_pay := v_total_calc;
    END IF;

    INSERT INTO public.commission_settlement_items (settlement_id, item_type, item_id, amount)
    SELECT v_settlement_id, 'RELEASE', r.id, ROUND(r.commission_released_amount::NUMERIC, 2)
    FROM public.commission_releases r
    INNER JOIN (
        SELECT (value->>'item_id')::UUID AS id
        FROM jsonb_array_elements(p_selected_items)
        WHERE UPPER(COALESCE(value->>'item_type', '')) = 'RELEASE'
    ) src ON src.id = r.id
    WHERE r.company_id = p_company_id
      AND r.rep_id = p_rep_id
      AND r.settlement_id IS NULL;

    IF COALESCE(p_allow_advance, FALSE) THEN
        INSERT INTO public.commission_settlement_items (settlement_id, item_type, item_id, amount)
        SELECT
            v_settlement_id,
            'ENTITLEMENT',
            e.id,
            ROUND(GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0)::NUMERIC, 2)
        FROM public.commission_entitlements e
        INNER JOIN (
            SELECT (value->>'item_id')::UUID AS id
            FROM jsonb_array_elements(p_selected_items)
            WHERE UPPER(COALESCE(value->>'item_type', '')) = 'ENTITLEMENT'
        ) src ON src.id = e.id
        LEFT JOIN (
            SELECT entitlement_id, SUM(commission_released_amount) AS released_total_amount
            FROM public.commission_releases
            WHERE company_id = p_company_id
              AND rep_id = p_rep_id
            GROUP BY entitlement_id
        ) rt ON rt.entitlement_id = e.id
        WHERE e.company_id = p_company_id
          AND e.rep_id = p_rep_id
          AND e.settlement_id IS NULL
          AND GREATEST(e.commission_total - COALESCE(rt.released_total_amount, 0), 0) > 0;
    END IF;

    UPDATE public.commission_releases r
    SET settlement_id = v_settlement_id,
        updated_at = now()
    WHERE r.id IN (
        SELECT (value->>'item_id')::UUID
        FROM jsonb_array_elements(p_selected_items)
        WHERE UPPER(COALESCE(value->>'item_type', '')) = 'RELEASE'
    )
      AND r.company_id = p_company_id
      AND r.rep_id = p_rep_id
      AND r.settlement_id IS NULL;

    IF COALESCE(p_allow_advance, FALSE) THEN
        UPDATE public.commission_entitlements e
        SET settlement_id = v_settlement_id,
            updated_at = now()
        WHERE e.id IN (
            SELECT (value->>'item_id')::UUID
            FROM jsonb_array_elements(p_selected_items)
            WHERE UPPER(COALESCE(value->>'item_type', '')) = 'ENTITLEMENT'
        )
          AND e.company_id = p_company_id
          AND e.rep_id = p_rep_id
          AND e.settlement_id IS NULL;
    END IF;

    INSERT INTO public.rep_commission_ledger (
        company_id,
        rep_id,
        entry_type,
        amount,
        settlement_id,
        source_key,
        notes,
        created_by
    ) VALUES (
        p_company_id,
        p_rep_id,
        'PAYOUT',
        -1 * v_total_pay,
        v_settlement_id,
        'settlement:payout:' || v_settlement_id::TEXT,
        'Pagamento de comissões - acerto por lote',
        COALESCE(p_created_by, auth.uid())
    )
    ON CONFLICT (company_id, source_key) DO NOTHING;

    UPDATE public.commission_settlements
    SET status = 'CONFIRMADO',
        total_paid = v_total_pay,
        updated_at = now()
    WHERE id = v_settlement_id;

    RETURN QUERY
    SELECT
        v_settlement_id,
        COALESCE(v_released_total, 0),
        COALESCE(v_advance_total, 0),
        COALESCE(v_total_pay, 0),
        'CONFIRMADO'::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.commission_confirm_settlement(UUID, UUID, DATE, BOOLEAN, JSONB, NUMERIC, UUID, TEXT) TO authenticated;

COMMIT;
