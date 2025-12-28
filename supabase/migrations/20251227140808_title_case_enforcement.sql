-- Migration: Title Case Enforcement
-- Created: 2025-12-27
-- Description: Automatically converts text fields to Title Case on insert/update

-- ========================================
-- Create Title Case Function
-- ========================================

CREATE OR REPLACE FUNCTION title_case(input_text TEXT) 
RETURNS TEXT AS $$
DECLARE
    result TEXT;
    word TEXT;
    words TEXT[];
    i INT;
    lowercase_words TEXT[] := ARRAY['de', 'da', 'do', 'dos', 'das', 'e', 'ou', 'a', 'o', 'as', 'os'];
    acronyms TEXT[] := ARRAY['ltda', 'eireli', 'me', 'epp', 'sa', 'ss', 'coop', 'cia'];
BEGIN
    IF input_text IS NULL OR input_text = '' THEN
        RETURN input_text;
    END IF;
    
    -- Normalize spaces and convert to lowercase
    input_text := REGEXP_REPLACE(LOWER(TRIM(input_text)), '\s+', ' ', 'g');
    
    -- Split into words
    words := STRING_TO_ARRAY(input_text, ' ');
    result := '';
    
    FOR i IN 1..ARRAY_LENGTH(words, 1) LOOP
        word := words[i];
        
        -- Skip empty words
        IF word = '' THEN
            CONTINUE;
        END IF;
        
        -- Check if it's an acronym (should be uppercase)
        IF word = ANY(acronyms) THEN
            word := UPPER(word);
        -- Check if it's a preposition/article (lowercase unless first word)
        ELSIF i > 1 AND word = ANY(lowercase_words) THEN
            word := LOWER(word);
        -- Default: capitalize first letter
        ELSE
            word := INITCAP(word);
        END IF;
        
        -- Append to result
        IF result = '' THEN
            result := word;
        ELSE
            result := result || ' ' || word;
        END IF;
    END LOOP;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ========================================
-- Organizations Table Trigger
-- ========================================

CREATE OR REPLACE FUNCTION enforce_title_case_organizations()
RETURNS TRIGGER AS $$
BEGIN
    -- Apply Title Case to text fields
    NEW.legal_name := title_case(NEW.legal_name);
    NEW.trade_name := title_case(NEW.trade_name);
    
    -- Address fields
    NEW.address_street := title_case(NEW.address_street);
    NEW.address_neighborhood := title_case(NEW.address_neighborhood);
    NEW.address_city := title_case(NEW.address_city);
    NEW.address_complement := title_case(NEW.address_complement);
    
    -- Keep these uppercase
    NEW.address_state := UPPER(NEW.address_state);
    NEW.address_country := UPPER(NEW.address_country);
    
    -- Email always lowercase
    NEW.email := LOWER(NEW.email);
    NEW.email_nfe := LOWER(NEW.email_nfe);
    
    -- Fiscal fields (uppercase)
    NEW.state_registration := UPPER(NEW.state_registration);
    NEW.municipal_registration := UPPER(NEW.municipal_registration);
    NEW.suframa := UPPER(NEW.suframa);
    NEW.public_agency_code := UPPER(NEW.public_agency_code);
    
    -- Default operation nature (Title Case)
    NEW.default_operation_nature := title_case(NEW.default_operation_nature);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS organizations_title_case ON organizations;

-- Create trigger
CREATE TRIGGER organizations_title_case
    BEFORE INSERT OR UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION enforce_title_case_organizations();

-- ========================================
-- Items (Products) Table Trigger
-- ========================================

CREATE OR REPLACE FUNCTION enforce_title_case_items()
RETURNS TRIGGER AS $$
BEGIN
    -- Apply Title Case to product name and description
    NEW.name := title_case(NEW.name);
    NEW.description := title_case(NEW.description);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS items_title_case ON items;

-- Create trigger
CREATE TRIGGER items_title_case
    BEFORE INSERT OR UPDATE ON items
    FOR EACH ROW
    EXECUTE FUNCTION enforce_title_case_items();

-- ========================================
-- Price Tables Trigger
-- ========================================

CREATE OR REPLACE FUNCTION enforce_title_case_price_tables()
RETURNS TRIGGER AS $$
BEGIN
    -- Apply Title Case to price table name and description
    NEW.name := title_case(NEW.name);
    NEW.description := title_case(NEW.description);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS price_tables_title_case ON price_tables;

-- Create trigger
CREATE TRIGGER price_tables_title_case
    BEFORE INSERT OR UPDATE ON price_tables
    FOR EACH ROW
    EXECUTE FUNCTION enforce_title_case_price_tables();

-- ========================================
-- Addresses Table Trigger
-- ========================================

CREATE OR REPLACE FUNCTION enforce_title_case_addresses()
RETURNS TRIGGER AS $$
BEGIN
    -- Apply Title Case to address fields
    NEW.street := title_case(NEW.street);
    NEW.neighborhood := title_case(NEW.neighborhood);
    NEW.city := title_case(NEW.city);
    NEW.complement := title_case(NEW.complement);
    
    -- Keep these uppercase
    NEW.state := UPPER(NEW.state);
    NEW.country := UPPER(NEW.country);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS addresses_title_case ON addresses;

-- Create trigger
CREATE TRIGGER addresses_title_case
    BEFORE INSERT OR UPDATE ON addresses
    FOR EACH ROW
    EXECUTE FUNCTION enforce_title_case_addresses();

-- Persons table trigger removed due to missing table

-- ========================================
-- Companies Table Trigger
-- ========================================

CREATE OR REPLACE FUNCTION enforce_title_case_companies()
RETURNS TRIGGER AS $$
BEGIN
    -- Apply Title Case to company fields
    NEW.legal_name := title_case(NEW.legal_name);
    NEW.trade_name := title_case(NEW.trade_name);
    
    -- Address fields
    NEW.address_street := title_case(NEW.address_street);
    NEW.address_neighborhood := title_case(NEW.address_neighborhood);
    NEW.address_city := title_case(NEW.address_city);
    
    -- Keep these uppercase
    NEW.address_state := UPPER(NEW.address_state);
    
    -- Email always lowercase
    NEW.email := LOWER(NEW.email);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS companies_title_case ON companies;

-- Create trigger
CREATE TRIGGER companies_title_case
    BEFORE INSERT OR UPDATE ON companies
    FOR EACH ROW
    EXECUTE FUNCTION enforce_title_case_companies();
