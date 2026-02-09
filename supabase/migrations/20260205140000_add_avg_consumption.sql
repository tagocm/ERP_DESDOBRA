-- Add Average Fuel Consumption Column
-- Date: 2026-02-05

-- Add column for average fuel consumption (km per liter)
ALTER TABLE public.fleet_vehicles 
    ADD COLUMN IF NOT EXISTS avg_fuel_consumption_km_l DECIMAL(5,2);

-- Add comment
COMMENT ON COLUMN public.fleet_vehicles.avg_fuel_consumption_km_l IS 'Average fuel consumption in km/L, calculated automatically from fuel records';
