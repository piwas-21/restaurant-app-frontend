-- E2E seed: minimum data for the public ordering flow.
-- Inserts 1 category, 1 product (active + available + not deleted), the
-- product<->category link, and one English product description so the
-- card renders a name. Idempotent via fixed UUIDs + ON CONFLICT DO NOTHING.
--
-- Schema source of truth: backend EF model snapshot at
-- backend/RestaurantSystem.Infrastructure/Persistence/Migrations/ApplicationDbContextModelSnapshot.cs
-- Tables: "Products" (quoted PascalCase), categories, product_categories,
-- product_descriptions. Run AFTER `dotnet ef database update`.

BEGIN;

-- 1) Category
INSERT INTO categories (
    id, name, description, display_order, image_url,
    is_active, is_deleted, created_by
) VALUES (
    '00000000-0000-0000-0000-0000000000ca',
    'E2E Category',
    'Seed category for Playwright E2E',
    0,
    NULL,
    TRUE,
    FALSE,
    'e2e-seed'
) ON CONFLICT (id) DO NOTHING;

-- 2) Product (Type=0 MainItem, so the GetProducts default Menu-exclude
-- filter still includes it). is_active + is_available + NOT is_deleted
-- are the public-list filters the frontend cares about.
INSERT INTO "Products" (
    id, name, description, base_price,
    display_order, image_url,
    allergens, ingredients,
    is_active, is_available, is_deleted, is_featured_special, is_special,
    kitchen_type, preparation_time_minutes, type,
    created_by
) VALUES (
    '00000000-0000-0000-0000-0000000000bb',
    'E2E Test Product',
    'Seed product for Playwright E2E',
    15.00,
    0,
    NULL,
    '[]'::jsonb,
    '[]'::jsonb,
    TRUE,
    TRUE,
    FALSE,
    FALSE,
    FALSE,
    0,
    5,
    0,
    'e2e-seed'
) ON CONFLICT (id) DO NOTHING;

-- 3) Product<->Category link (primary so PrimaryCategoryName resolves)
INSERT INTO product_categories (
    id, product_id, category_id, is_primary, display_order, created_by
) VALUES (
    '00000000-0000-0000-0000-0000000000ac',
    '00000000-0000-0000-0000-0000000000bb',
    '00000000-0000-0000-0000-0000000000ca',
    TRUE,
    0,
    'e2e-seed'
) ON CONFLICT (id) DO NOTHING;

-- 4) English product description (Content[lang] dictionary entry)
INSERT INTO product_descriptions (
    id, product_id, lang, name, description, created_by
) VALUES (
    '00000000-0000-0000-0000-0000000000de',
    '00000000-0000-0000-0000-0000000000bb',
    'en',
    'E2E Test Product',
    'Seed product for Playwright E2E',
    'e2e-seed'
) ON CONFLICT (id) DO NOTHING;

-- 5) One dining-room Table — needed for the DineIn order-type followup
-- test (table-selection modal needs at least one row to render).
-- PascalCase quoted; columns snake_case.
INSERT INTO "Tables" (
    id, table_number, max_guests, is_active, is_outdoor,
    position_x, position_y, width, height, created_by
) VALUES (
    '00000000-0000-0000-0000-00000000007a',
    'T1',
    4,
    TRUE,
    FALSE,
    0,
    0,
    80,
    80,
    'e2e-seed'
) ON CONFLICT (id) DO NOTHING;

-- 5b) The full reference dining-room layout is NOT seeded here any more.
-- Since FLOOR-PLAN-REVAMP S5 the /reservations map renders from
-- GET /api/floorplan in real-world METRES, so the backend's startup
-- FloorPlanSeeder (the 14×9 reference plan) + TableSeeder (tables 1..14b in
-- metres, linked to the default plan) own the reservations layout — and only
-- tables linked to the plan appear on the map. Pre-seeding pixel rows here
-- would just collapse into the corner again; the metre seeders now produce the
-- coherent plan the regenerated screenshot baseline is pinned to. (T1 above
-- stays for the DineIn order-type test; it is unlinked, so it never shows on
-- the reservations map, which filters by FloorPlanId.)

-- 6) Working hours — override the migration's 10:00–23:00 default to
-- 00:00–23:59 (effectively 24h) so the DineIn order type stays enabled
-- regardless of the CI wall-clock time. The migration's window is
-- Europe/Zurich local time (CET = UTC+1 winter, CEST = UTC+2 summer),
-- so CI runs after 22:00 UTC in winter / 21:00 UTC in summer get DineIn
-- filtered out by OrderTypeConfigurationService.GetEnabledOrderTypesAsync,
-- which calls IsOpenNowAsync and removes DineIn when closed. That's
-- the root cause of e2e/tests/public/order-type-followup.e2e.ts
-- (frontend #51) failing intermittently.
UPDATE working_hours
SET open_time = INTERVAL '00:00:00',
    close_time = INTERVAL '23:59:59',
    is_active = TRUE,
    is_closed = FALSE,
    updated_by = 'e2e-seed';

COMMIT;

-- Verification lines (visible in CI logs)
SELECT count(*) AS products_total FROM "Products";
SELECT count(*) AS tables_total FROM "Tables";
SELECT day_of_week, open_time, close_time, is_closed
FROM working_hours ORDER BY day_of_week;
