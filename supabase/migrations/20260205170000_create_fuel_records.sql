-- Fleet Fuel Records Table
-- Date: 2026-02-05

-- Create fuel records table
CREATE TABLE IF NOT EXISTS public.fleet_fuel_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES public.fleet_vehicles(id) ON DELETE CASCADE,
    
    -- Record Details
    fuel_date DATE NOT NULL,
    odometer_km INTEGER NOT NULL,
    fuel_type TEXT NOT NULL,
    quantity_liters DECIMAL(10,2) NOT NULL,
    price_per_liter DECIMAL(10,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    
    -- Optional
    gas_station TEXT,
    notes TEXT,
    
    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id),
    
    -- Constraints
    CONSTRAINT fuel_records_quantity_positive CHECK (quantity_liters > 0),
    CONSTRAINT fuel_records_price_positive CHECK (price_per_liter > 0),
    CONSTRAINT fuel_records_total_positive CHECK (total_amount > 0),
    CONSTRAINT fuel_records_odometer_positive CHECK (odometer_km >= 0)
);

-- Indexes for performance
CREATE INDEX idx_fuel_records_vehicle ON public.fleet_fuel_records(vehicle_id);
CREATE INDEX idx_fuel_records_company ON public.fleet_fuel_records(company_id);
CREATE INDEX idx_fuel_records_date ON public.fleet_fuel_records(fuel_date DESC);

-- Enable RLS
ALTER TABLE public.fleet_fuel_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only access fuel records from their company
CREATE POLICY fuel_records_company_isolation ON public.fleet_fuel_records
    FOR ALL
    USING (company_id IN (SELECT company_id FROM public.company_members WHERE auth_user_id = auth.uid()));

-- Trigger function to update vehicle's average consumption
CREATE OR REPLACE FUNCTION update_vehicle_avg_consumption()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate average consumption for the vehicle
    UPDATE public.fleet_vehicles v
    SET avg_fuel_consumption_km_l = (
        SELECT 
            CASE 
                WHEN SUM(quantity_liters) > 0 AND COUNT(*) > 1 THEN
                    ROUND((MAX(odometer_km) - MIN(odometer_km))::DECIMAL / NULLIF(SUM(quantity_liters), 0), 2)
                ELSE NULL
            END
        FROM public.fleet_fuel_records
        WHERE vehicle_id = COALESCE(NEW.vehicle_id, OLD.vehicle_id)
        AND company_id = COALESCE(NEW.company_id, OLD.company_id)
    )
    WHERE v.id = COALESCE(NEW.vehicle_id, OLD.vehicle_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to fuel records table
CREATE TRIGGER trigger_update_avg_consumption
AFTER INSERT OR UPDATE OR DELETE ON public.fleet_fuel_records
FOR EACH ROW
EXECUTE FUNCTION update_vehicle_avg_consumption();

-- Add comment
COMMENT ON TABLE public.fleet_fuel_records IS 'Stores fuel/refueling records for fleet vehicles';
