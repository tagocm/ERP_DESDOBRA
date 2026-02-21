-- Fix Supabase linter 0010 (security_definer_view)
-- Ensure listed views run with invoker privileges.

DO $$
DECLARE
  v text;
  views text[] := ARRAY[
    'public.audit_dre_double_count_delivery_v1',
    'public.audit_dre_cost_zero_v1',
    'public.dre_revenue_realized_v1',
    'public.v_dre_devolucoes_mercadorias_recebidas',
    'public.audit_dre_stock_return_orphan_v1',
    'public.v_audit_devolucao_sem_entrada_estoque',
    'public.audit_dre_return_stock_mismatch_v1',
    'public.dre_returns_v1',
    'public.v_audit_movimento_sem_referencia',
    'public.audit_dre_stock_mismatch_v1',
    'public.dre_summary_v1',
    'public.audit_dre_price_source_mismatch_v1',
    'public.v_dre_cmv_entregue',
    'public.v_audit_delivery_sem_saida_estoque',
    'public.dre_cogs_v1',
    'public.dre_refusals_logistics_v1',
    'public.dre_revenue_gross_v1',
    'public.v_dre_resumo',
    'public.dre_summary_v2',
    'public.dre_revenue_realized_v2',
    'public.v_dre_receita_mercadorias_entregue',
    'public.audit_dre_net_vs_gross_gap_v1',
    'public.audit_dre_return_qty_exceeds_delivered_v1',
    'public.dre_returns_v2',
    'public.audit_dre_return_without_prior_revenue_v1',
    'public.dre_item_prices_v1'
  ];
BEGIN
  FOREACH v IN ARRAY views LOOP
    IF to_regclass(v) IS NOT NULL THEN
      EXECUTE format('ALTER VIEW %s SET (security_invoker = true)', v);
    END IF;
  END LOOP;
END
$$;
