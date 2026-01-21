# Migration Notes - Deliveries MVP (Phase 1 & 2)
**Date:**
- [2026-01-03] **Legacy Removal**: Removed "Carregamento Parcial" model completely. System now operates exclusively on "Deliveries" model. Removed `PartialLoadModal`, settings for expedition reasons, and backend legacy logic. Migration `20260103180000_cleanup_partial_loading.sql` cleans up occurrence reasons.
- [2026-01-01] **Inventory**: Added `inventory_movements` table and related triggers/functions for tracking stock changes.

## Overview
Phase 2 integrates the new "Deliveries" model into the `start-route` flow, gated by a feature flag.

## Changes (Phase 2)
1.  **Start Route API (`app/api/expedition/start-route/route.ts`)**:
    *   Added logic to check `company_settings.use_deliveries_model`.
    *   **IF TRUE**:
        *   Iterates orders and creates/updates records in `deliveries` and `delivery_items`.
        *   Sets `qty_loaded` based on payload or defaults to `qty_planned` (Full).
        *   Sets delivery status to `in_route`.
        *   Updates `delivery_route_orders` with `{ mode: 'deliveries_model', delivery_id: ... }` marker instead of full payload.
        *   **Crucial**: Does NOT split Sales Orders (no "Desdobra").
    *   **IF FALSE** (Default):
        *   Maintains legacy behavior (Splitting orders for partials).

2.  **Verification**:
    *   Added `app/api/test/setup-delivery-test` to seed data and enable flag for testing.
    *   Added RPCs `seed_test_data` and `get_test_user_id` to `supabase/migrations/20260103133000_helper_rpc.sql`.

## Changes (Phase 1)
1.  **New Tables (`supabase/migrations/20260103120000_create_deliveries.sql`):**
    *   `deliveries`: Stores delivery headers (number, status, date).
    *   `delivery_items`: Stores item-level delivery quantities (loaded, delivered, returned).
    *   `delivery_status` ENUM: `draft`, `in_preparation`, `in_route`, `delivered`, ...

2.  **Feature Flag:**
    *   Added `use_deliveries_model` to `company_settings`.

3.  **Backend Services (`lib/services/deliveries.ts`):**
    *   Core logic for delivery creation and updates.

## Next Steps (Phase 3)
*   Implement Frontend UI for Deliveries (Status tracking, Returns).
*   Connect Returns flow to new model.
