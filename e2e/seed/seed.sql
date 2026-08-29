-- E2E seed: minimum data for the public ordering flow.
-- Inserts 1 category, 1 product (active + available + not deleted), the
-- product<->category link, and one English product description so the
-- card renders a name. Idempotent via fixed UUIDs + ON CONFLICT DO NOTHING.
--
-- Schema source of truth: backend EF model snapshot at
-- backend/RestaurantSystem.Infrastructure/Persistence/Migrations/ApplicationDbContextModelSnapshot.cs
-- Tables written: "Products", "Tables", "OrderItems" (quoted PascalCase), categories,
-- product_categories, product_descriptions, orders; working_hours is UPDATEd, not inserted.
-- Run AFTER `dotnet ef database update`.

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
--
-- This is ALSO the featured special (frontend #380). `GetFeaturedSpecialQuery`
-- requires all three of is_featured_special + is_special + is_active, so all
-- three are set here; two out of three renders nothing and looks like a
-- frontend bug.
--
-- Deliberately this product rather than a fourth one: flagging an existing item
-- adds the hero to /menu without adding a card to the grid, so the screenshot
-- baselines move by the hero (plus this card's "special" tape) and nothing
-- else. It also matches production, where the special IS a menu item and
-- appears in both places.
--
-- `image_url` stays NULL on purpose. The live tenant's special has no image,
-- and the hero's no-photo layout is the case E4 had to fix (its grid always
-- declared a photo column, so the details landed in a capped 340px column).
-- Seeding a photo would baseline the path production does not take.
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
    TRUE,
    TRUE,
    0,
    5,
    0,
    'e2e-seed'
) ON CONFLICT (id) DO NOTHING;

-- The insert above is ON CONFLICT DO NOTHING, so a database seeded before #380
-- keeps the old flags and shows no hero — a local-only failure that looks like
-- a broken test rather than a stale row. CI always starts fresh; this is for
-- the developer who does not.
UPDATE "Products"
SET is_featured_special = TRUE, is_special = TRUE
WHERE id = '00000000-0000-0000-0000-0000000000bb';

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

-- 4b) A SECOND category + product, restricted to Takeaway|Delivery — the fixture the
-- per-order-type availability suite discovers (ORDER-TYPE-AVAILABILITY-PLAN §4.4).
--
-- Deliberately a NEW pair rather than a mask on the category above: that one's product is added to
-- the cart by menu-and-cart and checkout-guest, and making it Dine-In-blocked would 400 their adds
-- the moment either picks Dine-In. The suite finds this one on its own (it looks for any product
-- the server refuses on an ENABLED channel), so nothing hardcodes these ids.
--
-- 6 = OrderChannels.Takeaway|Delivery ⇒ blocked for Dine-In. NOT a raw OrderType cast: the enum is
-- 1/2/3 while the mask bits are 1/2/4, so `3` here would silently mean Dine-In|Takeaway.
-- The product carries NO mask of its own — it INHERITS via its primary category, which is the
-- client's actual scenario ("items in the Dürüm category can not be dine-in") and the path most
-- worth guarding.
INSERT INTO categories (
    id, name, description, display_order, image_url,
    is_active, is_deleted, created_by, available_order_types
) VALUES (
    '00000000-0000-0000-0000-0000000000cc',
    'E2E Restricted Category',
    'Takeaway + Delivery only — fixture for the order-type availability suite',
    1,
    NULL,
    TRUE,
    FALSE,
    'e2e-seed',
    6
) ON CONFLICT (id) DO NOTHING;

INSERT INTO "Products" (
    id, name, description, base_price,
    display_order, image_url,
    allergens, ingredients,
    is_active, is_available, is_deleted, is_featured_special, is_special,
    kitchen_type, preparation_time_minutes, type,
    created_by
) VALUES (
    '00000000-0000-0000-0000-0000000000bd',
    'E2E Restricted Product',
    'Inherits Takeaway + Delivery from its primary category',
    12.00,
    1,
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

INSERT INTO product_categories (
    id, product_id, category_id, is_primary, display_order, created_by
) VALUES (
    '00000000-0000-0000-0000-0000000000ad',
    '00000000-0000-0000-0000-0000000000bd',
    '00000000-0000-0000-0000-0000000000cc',
    TRUE,
    0,
    'e2e-seed'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO product_descriptions (
    id, product_id, lang, name, description, created_by
) VALUES (
    '00000000-0000-0000-0000-0000000000df',
    '00000000-0000-0000-0000-0000000000bd',
    'en',
    'E2E Restricted Product',
    'Inherits Takeaway + Delivery from its primary category',
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

-- 6) Working hours — override the seeder's 11:00–23:00 default to
-- 00:00–23:59 (effectively 24h) so the DineIn order type stays enabled
-- regardless of the CI wall-clock time. THIS PAIR IS NO LONGER WHAT IS READ:
-- since backend #447 the day's SERVING WINDOWS decide, and the pair is only
-- their fallback — 6b below is the half that does the work, and this UPDATE
-- keeps the legacy mirror consistent with it. The seeder's window is
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

-- 6b) The SERVING WINDOWS, which are what actually answers "are we open" since
-- backend #447 (`a day is N serving windows`, G11).
--
-- THE UPDATE ABOVE STOPPED WORKING AND SAID NOTHING. `WorkingHoursSeeder` now
-- writes a `working_hours_shifts` child row (11:00-23:00) beside the legacy
-- open_time/close_time pair, and `WorkingHoursWindows.Of()` prefers the shift
-- rows whenever the day has any:
--
--     if (day.Shifts.Count == 0) return [(day.OpenTime, day.CloseTime)];
--
-- So the legacy pair is a FALLBACK for a day with no windows, and the 24h
-- override above became a no-op the moment the shift rows existed — leaving CI
-- open only 11:00-23:00 on the tenant clock (Europe/Zurich by default;
-- TenantClock.DefaultTimeZoneId, and CI sets no `Localization__TimeZone`).
--
-- WRITE the window rather than deleting the rows. Deleting them would route
-- around the shipped shape and silently exercise the legacy fallback path,
-- which no tenant is on; writing one 00:00-23:59:59 window per day exercises
-- exactly what a real install runs and still keeps the shop open at every
-- instant of the CI day. Replace, do not diff: a shift row carries nothing but
-- two times and no other table points at one (the same argument
-- `WorkingHoursService.UpdateAsync` makes).
--
-- The WHERE names the scope instead of leaving it implicit. Every window of
-- every day IS what this replaces, but a bare `DELETE FROM <table>` says that
-- by omission — and a reader cannot tell an intended whole-table replace from a
-- forgotten predicate (SonarCloud plsql:DeleteOrUpdateWithoutWhereCheck, and it
-- is right to ask).
DELETE FROM working_hours_shifts
WHERE working_hours_id IN (SELECT id FROM working_hours);

-- `'…'::interval`, not `INTERVAL '…'`: in a SELECT list the second form reads as
-- a column named INTERVAL carrying a quoted alias, which is also how SonarCloud's
-- parser sees it. The cast is unambiguous to both.
INSERT INTO working_hours_shifts (
    id, working_hours_id, open_time, close_time, created_by
)
SELECT
    gen_random_uuid(),
    wh.id,
    '00:00:00'::interval,
    '23:59:59'::interval,
    'e2e-seed'
FROM working_hours wh;

-- psql variables so the order's id and the bundle-parent line's id are written ONCE. They are
-- foreign keys repeated across the child rows and the verification query, and a UUID typo there
-- fails as a silently orphaned row, not an error. (`\set` is a client-side psql command; this file
-- is only ever run as `psql -f`, which is how CI and e2e/README.md invoke it.)
\set order_id '00000000-0000-0000-0000-0000000000f0'
\set combo_item_id '00000000-0000-0000-0000-0000000000e1'

-- 7) MIXED-KITCHEN BUNDLE ORDER — fixture for e2e/tests/cashier/kitchen-ticket-routing.e2e.ts.
--
-- The regression backend #237 (issue #234) introduced: `OrderDto.Items` is now ROOT-ONLY, so a
-- BackKitchen component inside a FrontKitchen combo is no longer a top-level row. A frontend that
-- filters only the top level finds nothing for BackKitchen — the back kitchen gets NO ticket and
-- its item prints on the FRONT one instead. This seeds exactly that shape so the E2E can drive the
-- real cashier UI over a real API response.
--
-- All three products are `type = 5` (ProductType.Menu) and carry no category link or description ON
-- PURPOSE: they must never reach the public menu, where they would displace the item the menu/cart
-- and checkout specs add and shift the pinned screenshot baselines.
--
-- `type = 5` is what actually hides them, NOT `is_active = FALSE`. GetProductsQuery applies IsActive
-- only when the caller passes it, and the customer menu never does; the one unconditional exclusion
-- on the default list is `p.Type != ProductType.Menu`. is_active is kept FALSE as belt-and-braces
-- for any surface that does filter on it.
--
-- Nothing in the order path cares: the receipt prints the OrderItem's own `product_name` snapshot,
-- and OrderMappingService reads KitchenType off the joined Product whatever its Type. `Kind` on a
-- child comes from the PARENT's product type, so the parent being Menu is what makes these
-- `BundleChild` — the children's own type is irrelevant to that.
--
-- kitchen_type: 0 = None, 1 = FrontKitchen, 2 = BackKitchen (Domain/Common/Enums/KitchenType.cs).

INSERT INTO "Products" (
    id, name, description, base_price,
    display_order, image_url,
    allergens, ingredients,
    is_active, is_available, is_deleted, is_featured_special, is_special,
    kitchen_type, preparation_time_minutes, type,
    created_by
) VALUES
    ('00000000-0000-0000-0000-0000000000f1', 'E2E Kitchen Combo', 'Bundle parent — front kitchen',
     20.00, 90, NULL, '[]'::jsonb, '[]'::jsonb, FALSE, TRUE, FALSE, FALSE, FALSE, 1, 5, 5, 'e2e-seed'),
    ('00000000-0000-0000-0000-0000000000f2', 'E2E Front Burger', 'Bundle component — front kitchen',
     12.00, 91, NULL, '[]'::jsonb, '[]'::jsonb, FALSE, TRUE, FALSE, FALSE, FALSE, 1, 5, 5, 'e2e-seed'),
    ('00000000-0000-0000-0000-0000000000f3', 'E2E Back Fries', 'Bundle component — BACK kitchen',
     8.00, 92, NULL, '[]'::jsonb, '[]'::jsonb, FALSE, TRUE, FALSE, FALSE, FALSE, 2, 5, 5, 'e2e-seed')
ON CONFLICT (id) DO NOTHING;

-- Takeaway so the order does not depend on working hours or a table.
--
-- Dated a day AHEAD deliberately. The cashier list is OrderDate-descending with a default page size
-- of 10, and the rest of the suite creates orders while this one waits, so a "now"-dated fixture
-- would drift off page 1 as the suite grows. Future-dating pins it to the top forever. The spec
-- switches OFF the dashboard's "today only" window, which is what makes that safe — and also what
-- keeps this out of the timezone business: that window is computed in the BROWSER's local zone
-- while this timestamp is written in the DB session's, so any "today at 23:00" anchor here is only
-- ever correct when both happen to be UTC.
--
-- No focus column here, and do not re-add one: backend 20260728222102_ExtractOrderFocusOwnedType
-- DROPPED is_focus_order. "Focused" is now "focused_at IS NOT NULL", so this fixture's unfocused
-- state is simply the omitted column's NULL rather than an explicit FALSE. Naming the dropped
-- column fails this statement as Postgres analyses it; under ON_ERROR_STOP the run stops there
-- and the enclosing BEGIN rolls the earlier inserts back, so the e2e and screenshot jobs go down
-- before a single test runs.
INSERT INTO orders (
    id, order_number, status, payment_status, type,
    customer_name, order_date,
    sub_total, tax, delivery_fee, discount, discount_percentage, tip,
    total, total_paid, remaining_amount,
    customer_discount_amount, fidelity_points_discount, fidelity_points_earned, fidelity_points_redeemed,
    has_user_limit_discount, user_limit_amount,
    is_deleted, created_by
) VALUES (
    :'order_id',
    'E2E-KITCHEN-001',
    'Pending',
    'Pending',
    'Takeaway',
    'E2E Kitchen Routing',
    NOW() + INTERVAL '1 day',
    20.00, 0, 0, 0, 0, 0,
    20.00, 0, 20.00,
    0, 0, 0, 0,
    FALSE, 0,
    FALSE, 'e2e-seed'
) ON CONFLICT (id) DO NOTHING;

-- The tree. Children are rows in the SAME order.Items collection pointing back via
-- parent_order_item_id — that is how the backend rebuilds the tree, and why nothing broke loudly
-- when the projection changed.
INSERT INTO "OrderItems" (
    id, order_id, product_id, parent_order_item_id,
    product_name, quantity, unit_price, item_total, created_by
) VALUES
    (:'combo_item_id', :'order_id',
     '00000000-0000-0000-0000-0000000000f1', NULL,
     'E2E Kitchen Combo', 1, 20.00, 20.00, 'e2e-seed'),
    ('00000000-0000-0000-0000-0000000000e2', :'order_id',
     '00000000-0000-0000-0000-0000000000f2', :'combo_item_id',
     'E2E Front Burger', 1, 12.00, 12.00, 'e2e-seed'),
    ('00000000-0000-0000-0000-0000000000e3', :'order_id',
     '00000000-0000-0000-0000-0000000000f3', :'combo_item_id',
     'E2E Back Fries', 1, 8.00, 8.00, 'e2e-seed')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Verification lines (visible in CI logs)
SELECT count(*) AS products_total FROM "Products";
SELECT count(*) AS tables_total FROM "Tables";
-- Both halves of the hours, because only the SHIFT rows decide whether the shop
-- is open (backend #447) — a log line showing the legacy pair alone is what let
-- this break unnoticed.
SELECT wh.day_of_week, wh.open_time, wh.close_time, wh.is_closed,
       s.open_time AS shift_open, s.close_time AS shift_close
FROM working_hours wh
LEFT JOIN working_hours_shifts s ON s.working_hours_id = wh.id
ORDER BY wh.day_of_week ASC, s.open_time ASC;
-- The mixed-kitchen bundle: 1 root + 2 children, one per kitchen.
SELECT oi.product_name, p.kitchen_type, oi.parent_order_item_id IS NULL AS is_root
FROM "OrderItems" oi
JOIN "Products" p ON p.id = oi.product_id
WHERE oi.order_id = :'order_id'
ORDER BY oi.product_name ASC;
