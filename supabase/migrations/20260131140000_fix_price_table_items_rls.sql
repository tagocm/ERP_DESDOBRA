-- Fix RLS Policies for price_table_items
-- Issue: Policies were incorrectly referencing company_id on NEW record
-- Price_table_items doesn't have company_id - must join with price_tables

-- First, drop the incorrect policies
DROP POLICY IF EXISTS "Users can view items of price tables they accessed" ON public.price_table_items;
DROP POLICY IF EXISTS "Users can insert items to price tables they access" ON public.price_table_items;
DROP POLICY IF EXISTS "Users can update items of price tables they access" ON public.price_table_items;
DROP POLICY IF EXISTS "Users can delete items of price tables they access" ON public.price_table_items;

-- Recreate correct policies
-- SELECT Policy
CREATE POLICY "Users can view items of price tables they accessed"
    ON public.price_table_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.price_tables pt
            WHERE pt.id = price_table_items.price_table_id
            AND pt.company_id IN (
                SELECT company_id FROM public.company_members 
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- INSERT Policy
CREATE POLICY "Users can insert items to price tables they access"
    ON public.price_table_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.price_tables pt
            WHERE pt.id = price_table_id  -- NEW.price_table_id
            AND pt.company_id IN (
                SELECT company_id FROM public.company_members 
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- UPDATE Policy
CREATE POLICY "Users can update items of price tables they access"
    ON public.price_table_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.price_tables pt
            WHERE pt.id = price_table_items.price_table_id
            AND pt.company_id IN (
                SELECT company_id FROM public.company_members 
                WHERE auth_user_id = auth.uid()
            )
        )
    );

-- DELETE Policy
CREATE POLICY "Users can delete items of price tables they access"
    ON public.price_table_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.price_tables pt
            WHERE pt.id = price_table_items.price_table_id
            AND pt.company_id IN (
                SELECT company_id FROM public.company_members 
                WHERE auth_user_id = auth.uid()
            )
        )
    );
