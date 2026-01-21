-- ⚠️ DANGER: This script PERMANENTLY DELETES virtually all business data.
-- It attempts to reset the database to a blank slate while keeping:
-- 1. Tenants (companies)
-- 2. User Accounts (users, company_members, profiles)
-- 3. System global settings (if any exist outside company_settings)
-- 
-- EVERYTHING ELSE IS WIPED: Sales, Routes, Inventory, Finance, Products, Clients, Fiscal Settings.

BEGIN;

-- 1. Finance (AR)
TRUNCATE TABLE ar_payment_allocations RESTART IDENTITY CASCADE;
TRUNCATE TABLE ar_payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE ar_installments RESTART IDENTITY CASCADE;
TRUNCATE TABLE ar_titles RESTART IDENTITY CASCADE;

-- 2. Logistics (Routes)
TRUNCATE TABLE delivery_route_orders RESTART IDENTITY CASCADE;
TRUNCATE TABLE delivery_routes RESTART IDENTITY CASCADE;

-- 3. Inventory
-- Deleting inventory movements (ledger)
TRUNCATE TABLE inventory_movements RESTART IDENTITY CASCADE;

-- 4. Sales & Commercial
-- Deleting all sales documents and related history
TRUNCATE TABLE sales_document_history RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales_document_nfes RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales_document_payments RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales_document_items RESTART IDENTITY CASCADE;
TRUNCATE TABLE sales_documents RESTART IDENTITY CASCADE;

-- 5. Helper Catalogs (Financial & Commercial)
-- Payment Terms & Price Tables usually considered test configuration in early stages
TRUNCATE TABLE payment_terms RESTART IDENTITY CASCADE;
TRUNCATE TABLE price_tables RESTART IDENTITY CASCADE;
TRUNCATE TABLE payment_modes RESTART IDENTITY CASCADE;

-- 6. Products & Catalog
-- Deleting items and their categorizations
-- Note: BOMs (Bill of Materials) are usually linked to items, so they wipe via CASCADE if they exist.
TRUNCATE TABLE items RESTART IDENTITY CASCADE;
TRUNCATE TABLE product_categories RESTART IDENTITY CASCADE;

-- 7. Fiscal & Tax
-- Deleting fiscal configurations
TRUNCATE TABLE fiscal_operations RESTART IDENTITY CASCADE;
TRUNCATE TABLE tax_groups RESTART IDENTITY CASCADE;
-- UOMs (Units of Measure) - Wipe if they are user-defined test data
TRUNCATE TABLE uoms RESTART IDENTITY CASCADE;

-- 8. Stakeholders (Clients, Suppliers, Carriers)
-- Organizations and their contacts/addresses
TRUNCATE TABLE organization_contacts RESTART IDENTITY CASCADE;
TRUNCATE TABLE organization_addresses RESTART IDENTITY CASCADE;
TRUNCATE TABLE organizations RESTART IDENTITY CASCADE;

COMMIT;
