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

COMMIT;

-- Verification line (visible in CI logs)
SELECT count(*) AS products_total FROM "Products";
