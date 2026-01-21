-- Ensure delivery_routes policies use company_members (not company_users)
-- and force schema reload

BEGIN;

-- delivery_routes policies
DROP POLICY IF EXISTS "Users can view routes for their company" ON public.delivery_routes;
DROP POLICY IF EXISTS "Users can insert routes for their company" ON public.delivery_routes;
DROP POLICY IF EXISTS "Users can update routes for their company" ON public.delivery_routes;
DROP POLICY IF EXISTS "Users can delete routes for their company" ON public.delivery_routes;

CREATE POLICY "Users can view routes for their company"
    ON public.delivery_routes FOR SELECT
    USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert routes for their company"
    ON public.delivery_routes FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update routes for their company"
    ON public.delivery_routes FOR UPDATE
    USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete routes for their company"
    ON public.delivery_routes FOR DELETE
    USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));


-- delivery_route_orders policies
DROP POLICY IF EXISTS "Users can view route orders for their company" ON public.delivery_route_orders;
DROP POLICY IF EXISTS "Users can insert route orders for their company" ON public.delivery_route_orders;
DROP POLICY IF EXISTS "Users can update route orders for their company" ON public.delivery_route_orders;
DROP POLICY IF EXISTS "Users can delete route orders for their company" ON public.delivery_route_orders;

CREATE POLICY "Users can view route orders for their company"
    ON public.delivery_route_orders FOR SELECT
    USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can insert route orders for their company"
    ON public.delivery_route_orders FOR INSERT
    WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can update route orders for their company"
    ON public.delivery_route_orders FOR UPDATE
    USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

CREATE POLICY "Users can delete route orders for their company"
    ON public.delivery_route_orders FOR DELETE
    USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';

COMMIT;
