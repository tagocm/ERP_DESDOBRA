-- Create fleet_vehicles table
CREATE TABLE IF NOT EXISTS public.fleet_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    name TEXT NOT NULL,
    plate TEXT,
    type TEXT, -- carro, caminhao, moto, outro
    brand TEXT,
    model TEXT,
    year INTEGER,
    color TEXT,
    renavam TEXT,
    chassis TEXT,
    fuel_type TEXT,
    tank_capacity_l NUMERIC,
    odometer_initial_km NUMERIC,
    odometer_current_km NUMERIC,
    is_active BOOLEAN NOT NULL DEFAULT true,
    cost_center_id UUID REFERENCES public.cost_centers(id) ON DELETE SET NULL,
    
    -- Unicidade: (company_id, plate) unique quando plate não for null
    CONSTRAINT uq_fleet_vehicles_plate UNIQUE (company_id, plate)
);

-- Enable RLS
ALTER TABLE public.fleet_vehicles ENABLE ROW LEVEL SECURITY;

-- Add RLS policies
CREATE POLICY "Users can view vehicles of their own company" ON public.fleet_vehicles
    FOR SELECT
    USING (company_id IN (
        SELECT company_id 
        FROM public.company_members 
        WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can insert vehicles for their own company" ON public.fleet_vehicles
    FOR INSERT
    WITH CHECK (company_id IN (
        SELECT company_id 
        FROM public.company_members 
        WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can update vehicles of their own company" ON public.fleet_vehicles
    FOR UPDATE
    USING (company_id IN (
        SELECT company_id 
        FROM public.company_members 
        WHERE auth_user_id = auth.uid()
    ));

CREATE POLICY "Users can delete vehicles of their own company" ON public.fleet_vehicles
    FOR DELETE
    USING (company_id IN (
        SELECT company_id 
        FROM public.company_members 
        WHERE auth_user_id = auth.uid()
    ));

-- Create trigger for updated_at
CREATE TRIGGER set_updated_at_fleet_vehicles
    BEFORE UPDATE ON public.fleet_vehicles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_company_id ON public.fleet_vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_plate ON public.fleet_vehicles(plate);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_name ON public.fleet_vehicles(name);
