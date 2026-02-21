-- Revenue category usage rules + item guard against inactive categories

CREATE OR REPLACE FUNCTION public.set_revenue_category_active(
  p_company_id uuid,
  p_category_id uuid,
  p_is_active boolean
)
RETURNS TABLE (
  category_id uuid,
  account_id uuid,
  is_active boolean
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_member_of(p_company_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar categorias desta empresa.' USING ERRCODE = '42501';
  END IF;

  SELECT revenue_account_id
    INTO v_account_id
  FROM public.product_categories
  WHERE id = p_category_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Categoria não encontrada para a empresa informada.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.product_categories
    SET is_active = p_is_active
  WHERE id = p_category_id
    AND company_id = p_company_id;

  UPDATE public.gl_accounts
    SET is_active = p_is_active
  WHERE id = v_account_id
    AND company_id = p_company_id;

  RETURN QUERY SELECT p_category_id, v_account_id, p_is_active;
END;
$$;

REVOKE ALL ON FUNCTION public.set_revenue_category_active(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_revenue_category_active(uuid, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_revenue_category_active(uuid, uuid, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_revenue_category_if_unused(
  p_company_id uuid,
  p_category_id uuid
)
RETURNS TABLE (
  mode text,
  deleted_category_id uuid,
  deleted_account_id uuid
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_usage_items integer;
  v_usage_financial integer;
BEGIN
  IF auth.role() <> 'service_role' AND NOT public.is_member_of(p_company_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para excluir categorias desta empresa.' USING ERRCODE = '42501';
  END IF;

  SELECT revenue_account_id
    INTO v_account_id
  FROM public.product_categories
  WHERE id = p_category_id
    AND company_id = p_company_id
  FOR UPDATE;

  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Categoria não encontrada para a empresa informada.' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)
    INTO v_usage_items
  FROM public.items i
  WHERE i.company_id = p_company_id
    AND i.category_id = p_category_id
    AND i.deleted_at IS NULL;

  SELECT
    (
      SELECT COUNT(*)
      FROM public.ar_installments ai
      WHERE ai.account_id = v_account_id
    ) +
    (
      SELECT COUNT(*)
      FROM public.ap_installments ai
      WHERE ai.account_id = v_account_id
    )
    INTO v_usage_financial;

  IF v_usage_items > 0 OR v_usage_financial > 0 THEN
    RAISE EXCEPTION 'Categoria em uso. Inative a categoria em vez de excluir.' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.product_categories
  WHERE id = p_category_id
    AND company_id = p_company_id;

  DELETE FROM public.gl_accounts
  WHERE id = v_account_id
    AND company_id = p_company_id
    AND origin = 'PRODUCT_CATEGORY'
    AND origin_id = p_category_id;

  RETURN QUERY SELECT 'hard'::text, p_category_id, v_account_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_revenue_category_if_unused(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_revenue_category_if_unused(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_revenue_category_if_unused(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.enforce_active_category_for_items()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cat_company_id uuid;
  v_cat_is_active boolean;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.category_id IS NOT DISTINCT FROM OLD.category_id THEN
    RETURN NEW;
  END IF;

  SELECT pc.company_id, pc.is_active
    INTO v_cat_company_id, v_cat_is_active
  FROM public.product_categories pc
  WHERE pc.id = NEW.category_id;

  IF v_cat_company_id IS NULL THEN
    RAISE EXCEPTION 'Categoria selecionada não existe.' USING ERRCODE = 'P0001';
  END IF;

  IF v_cat_company_id <> NEW.company_id THEN
    RAISE EXCEPTION 'Categoria não pertence à mesma empresa do produto.' USING ERRCODE = 'P0001';
  END IF;

  IF COALESCE(v_cat_is_active, false) = false THEN
    RAISE EXCEPTION 'Categoria inativa não pode ser vinculada a produtos.' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_active_category_for_items ON public.items;
CREATE TRIGGER trg_enforce_active_category_for_items
BEFORE INSERT OR UPDATE OF category_id ON public.items
FOR EACH ROW
EXECUTE FUNCTION public.enforce_active_category_for_items();
