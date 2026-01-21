-- 1. Create a sequence
-- We start at 1. If we were migrating existing data with numbers we'd check max, 
-- but since column is new, we assume 1.
CREATE SEQUENCE IF NOT EXISTS public.work_order_number_seq START 1;

-- 2. Add column
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS document_number BIGINT;

-- 3. Create Trigger Function
CREATE OR REPLACE FUNCTION public.assign_work_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.document_number IS NULL THEN
        NEW.document_number := nextval('public.work_order_number_seq');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create Trigger
DROP TRIGGER IF EXISTS trigger_assign_work_order_number ON public.work_orders;
CREATE TRIGGER trigger_assign_work_order_number
    BEFORE INSERT ON public.work_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_work_order_number();

-- 5. Backfill existing orders (Chronological order for nicer numbering)
-- We use a DO block to iterate and update ensuring order
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.work_orders WHERE document_number IS NULL ORDER BY created_at ASC
    LOOP
        UPDATE public.work_orders
        SET document_number = nextval('public.work_order_number_seq')
        WHERE id = r.id;
    END LOOP;
END $$;
