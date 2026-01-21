
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'unit_cost') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN unit_cost NUMERIC NOT NULL DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name = 'total_cost') THEN
        ALTER TABLE public.inventory_movements ADD COLUMN total_cost NUMERIC NOT NULL DEFAULT 0;
    END IF;
END $$;
