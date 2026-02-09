-- Fleet Module Hardening Migration
-- Date: 2026-02-05

-- 1. Enable pg_trgm for performance search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Audit Columns
ALTER TABLE public.fleet_vehicles 
    ADD COLUMN IF NOT EXISTS inactivated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS inactivated_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- 3. Plate Normalization Function
CREATE OR REPLACE FUNCTION public.normalize_plate(p_plate TEXT) 
RETURNS TEXT AS $$
DECLARE
    v_norm TEXT;
BEGIN
    -- Trim and Uppercase
    v_norm := UPPER(TRIM(p_plate));
    -- Remove non-alphanumeric (hyphens, spaces, etc)
    v_norm := REGEXP_REPLACE(v_norm, '[^A-Z0-9]', '', 'g');
    
    -- Return NULL if empty
    IF v_norm = '' THEN
        RETURN NULL;
    END IF;
    
    RETURN v_norm;
END;
$$ LANGUAGE plpgsql;

-- 4. Audit & Normalization Trigger Function
CREATE OR REPLACE FUNCTION public.handle_fleet_vehicles_hardening() 
RETURNS TRIGGER AS $$
BEGIN
    -- Normalize Plate
    NEW.plate := public.normalize_plate(NEW.plate);
    
    -- Audit updated_by
    NEW.updated_by := auth.uid();
    
    -- Integrity: Odometer check
    IF NEW.odometer_current_km IS NOT NULL AND NEW.odometer_initial_km IS NOT NULL THEN
        IF NEW.odometer_current_km < NEW.odometer_initial_km THEN
            RAISE EXCEPTION 'Odômetro atual (%) não pode ser menor que o inicial (%)', NEW.odometer_current_km, NEW.odometer_initial_km;
        END IF;
    END IF;

    -- Audit Inactivation
    IF OLD.is_active IS TRUE AND NEW.is_active IS FALSE THEN
        NEW.inactivated_at := now();
        NEW.inactivated_by := auth.uid();
    ELSIF OLD.is_active IS FALSE AND NEW.is_active IS TRUE THEN
        NEW.inactivated_at := NULL;
        NEW.inactivated_by := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach Triggers
DROP TRIGGER IF EXISTS trg_fleet_vehicles_hardening ON public.fleet_vehicles;
CREATE TRIGGER trg_fleet_vehicles_hardening
    BEFORE INSERT OR UPDATE ON public.fleet_vehicles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_fleet_vehicles_hardening();

-- 6. Correct Uniqueness
ALTER TABLE public.fleet_vehicles DROP CONSTRAINT IF EXISTS uq_fleet_vehicles_plate;
DROP INDEX IF EXISTS idx_fleet_vehicles_plate_unique;
CREATE UNIQUE INDEX idx_fleet_vehicles_plate_unique ON public.fleet_vehicles(company_id, plate) WHERE plate IS NOT NULL;

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_company_active ON public.fleet_vehicles(company_id, is_active);
-- Trigram Index for Search (name, model, plate)
-- Using GIN + gin_trgm_ops for fast ILIKE
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_search_trgm ON public.fleet_vehicles USING GIN (
    (company_id::text || ' ' || name || ' ' || COALESCE(model, '') || ' ' || COALESCE(plate, '')) gin_trgm_ops
);

-- Documentation: 
-- - Plate is normalized on save (removes hyphens/spaces, uppercase).
-- - odometer_current_km >= odometer_initial_km is enforced at DB level.
-- - Inactivation is tracked (who and when).
-- - Optimized search for "TRUE GOLD" listing performance.
