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

-- 5b) The full reference dining-room layout, in the LEGACY 600×500 pixel units
-- the current /reservations renderer (VisualTableLayout) draws in. This seed
-- must own the table set deterministically: the backend's startup TableSeeder
-- was rewritten to seed real-world METRES (FLOOR-PLAN-REVAMP S3, backend #216)
-- and only adds table numbers it finds MISSING. Without these rows it would add
-- 1..14b at metre coordinates (1.5, 2.5, …) which the pixel renderer collapses
-- into the top-left corner — drifting the reservations screenshot baseline.
-- Pre-seeding every number it knows keeps the screenshot pinned to the pixel
-- layout until S5 renders metres (which will regenerate the baseline). Values
-- are the pre-S3 TableSeeder coordinates verbatim.
INSERT INTO "Tables" (
    table_number, max_guests, is_active, is_outdoor,
    position_x, position_y, width, height, shape, created_by
) VALUES
    ('1', 4, TRUE, FALSE, 80, 40, 100, 100, 'circle', 'e2e-seed'),
    ('2', 4, TRUE, FALSE, 160, 40, 100, 100, 'circle', 'e2e-seed'),
    ('3', 4, TRUE, FALSE, 40, 120, 100, 100, 'circle', 'e2e-seed'),
    ('4', 4, TRUE, FALSE, 40, 180, 100, 100, 'circle', 'e2e-seed'),
    ('5', 4, TRUE, FALSE, 40, 240, 100, 100, 'circle', 'e2e-seed'),
    ('6', 4, TRUE, FALSE, 40, 320, 100, 100, 'circle', 'e2e-seed'),
    ('7', 4, TRUE, FALSE, 140, 160, 100, 100, 'circle', 'e2e-seed'),
    ('8', 4, TRUE, FALSE, 140, 220, 100, 100, 'circle', 'e2e-seed'),
    ('9', 4, TRUE, FALSE, 260, 120, 100, 100, 'circle', 'e2e-seed'),
    ('10', 4, TRUE, FALSE, 260, 180, 100, 100, 'circle', 'e2e-seed'),
    ('11a', 2, TRUE, TRUE, 100, 400, 60, 60, 'square', 'e2e-seed'),
    ('11b', 2, TRUE, TRUE, 160, 400, 60, 60, 'square', 'e2e-seed'),
    ('12a', 2, TRUE, TRUE, 220, 400, 60, 60, 'square', 'e2e-seed'),
    ('12b', 2, TRUE, TRUE, 280, 400, 60, 60, 'square', 'e2e-seed'),
    ('13a', 2, TRUE, TRUE, 340, 400, 60, 60, 'square', 'e2e-seed'),
    ('13b', 2, TRUE, TRUE, 400, 400, 60, 60, 'square', 'e2e-seed'),
    ('14a', 2, TRUE, TRUE, 460, 400, 60, 60, 'square', 'e2e-seed'),
    ('14b', 2, TRUE, TRUE, 520, 400, 60, 60, 'square', 'e2e-seed')
ON CONFLICT (table_number) DO NOTHING;

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
