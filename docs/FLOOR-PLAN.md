# Floor plan — how the seating plan is built

> The guest map on `/reservations` and the admin editor on `/admin/table-layout-editor`
> are **one renderer**. This is the map of that code: what lives where, the rules
> that are load-bearing, and the traps that have already cost time.
>
> The *why* — evidence, owner decisions, the design in full — is the workspace plan:
> [`docs/plans/FLOOR-PLAN-REVAMP-PLAN.md`](../../docs/plans/FLOOR-PLAN-REVAMP-PLAN.md).
> This file is for someone about to change the code.

---

## 1. One scene, two consumers

```
                       FloorPlanDocument  (metres)
                                │
                    ┌───────────┴────────────┐
                    │   <FloorPlanScene>     │   ← ONE component, one SVG, one viewBox
                    │  rooms → grid → walls  │     layer order is fixed here
                    │  → items → tables      │
                    │  → labels              │
                    └───────────┬────────────┘
           mode: view           │           mode: edit
   ┌────────────────────────────┘└──────────────────────────────┐
 FloorPlanGuestMap                                     FloorPlanEditor
 selection · hover card ·                    + <EditorOverlay/> in the SAME <svg>:
 zone chips · zoom/fit ·                       selection box · snap guides · grips ·
 Map|List toggle                               marquee · wall draft · vertex handles
```

**The guest view and the admin view cannot drift, because there is no second
renderer to drift from.** That is not a convention — `FloorPlanScene.mirroring.test.tsx`
renders the same fixture through both entry points and asserts the emitted
geometry (`transform` / `d` / `x` / `y`) is identical. Interactivity adds
`role` / `tabIndex` / `aria-*` and **never a shape**.

## 2. Units — the one thing to get right

| Layer | Unit | Why |
|---|---|---|
| Storage / DTOs | **metres**, `decimal(6,2)` | Real-world dimensions; a 1.2 m table is a 1.2 m table |
| SVG user space | **centimetres** | A 12 × 8 m room is `viewBox="0 0 1200 800"` — integers everywhere, natural stroke widths, no sub-unit rounding fuzz |
| Screen | `width:100%` + `preserveAspectRatio="xMidYMid meet"` | The plan can never be squashed, cropped or letterboxed by a breakpoint |

Every conversion goes through `lib/floorPlan/geometry.ts` (`metresToCm`,
`screenToPlanMetres`, `computeViewBox`, `pointInRect`, `obbOverlap`). A table's
`x, y` is its **centre**, and rotation is about that centre.

## 3. Where things live

### `src/lib/floorPlan/` — pure, unit-tested, no React

| Module | Owns |
|---|---|
| `geometry` | Units, viewBox, screen↔plan projection, oriented-box hit test + overlap |
| `movable` | **One geometry vocabulary** for tables *and* items — the reason a drag, a nudge, a grip and the inspector are each written once |
| `document` | Immutable document ops (every one returns a NEW document, sharing untouched arrays) |
| `history` | Generic undo/redo stack |
| `snapping` · `align` · `handles` · `editorGestures` | Grid + alignment snap, align/distribute, grip anchors, gesture resolution |
| `selection` · `editorGeometry` | Marquee maths, overlap detection, plan clamping |
| `symbols` + `symbolPrims` / `symbolsStructure` / `symbolsDecor` | The drawn-symbol registry, as data |
| `palette` | What the rail offers and at what size — **derived** from the symbol boxes |
| `itemPlacement` · `localIds` | How a placed object is born; client-minted ids |
| `walls` · `wallDrafting` · `wallEditing` · `wallOpenings` · `wallHitTest` | Segments, drawing a chain, reshaping it, doors/windows, picking one |
| `wayfinding` · `floorStyles` · `zones` · `editorTools` · `editorKeyActions` | Zone/label/entrance vocabulary, floor finishes, zone resolution, tool modes, what each key does |

### `src/hooks/floorPlan/` — event layers only

`useFloorPlanEditor` composes the rest. `useEditorPointerChain` assembles the
pointer chain (see §4). Everything else is one concern per hook.

### `src/components/floor-plan/` — the renderer

`FloorPlanScene` + one file per layer, `WayfindingShapes` (shared by two layers
*and* the palette preview), `guest/`, `editor/`.

## 4. The pointer chain — read most-specific first

Assembled in `useEditorPointerChain`. Each layer either claims a press or hands
it to the next:

1. **wall draft** — while the Wall tool is active, every press places a vertex
2. **palette placement** — while a palette entry is armed, a press places it
3. **wall vertices** — a corner or midpoint grip on the selected wall reshapes it
   *(above the objects, because the grips are drawn on top of them)*
4. **object gestures** — move / rotate / resize a table or item
5. **wall pick** — a press on bare wall selects it
   *(below the objects, so a table against a wall still wins its own press)*
6. **marquee** — a sweep across bare plan rubber-bands a selection
7. **viewport** — anything left over pans, pinches or zooms

**A layer that claims a press owns its whole sequence.** Handing on only the
`pointerdown` produces a gesture that starts and never moves — that is exactly
the bug the Wall tool's `panning` ref exists to prevent.

## 5. Rules that are load-bearing

**Nothing commits mid-gesture.** The canvas renders a `previewDoc`; exactly one
History entry is pushed on pointer-up. An undo therefore reverses the whole
drag, not its last frame. A gesture that ends where it started pushes nothing.

**Two selections, kept apart.** `selectedIds` is the *movable* selection (tables
+ items, which share one geometry vocabulary and can be multi-selected);
`selectedWallId` is a single wall, a polyline with a different panel and no
footprint. Picking either clears the other — the inspector is never ambiguous
about what an edit acts on.

**Openings are pinned to a wall segment by index**, and every reshape renumbers
the segments under them. Getting this wrong throws nothing — it silently slides
a door onto a different wall. `wallEditing` is explicit about it and is the
module held highest in the coverage gate:

- inserting a corner re-measures an opening that lands in the second half, and
  **drops one the new corner would run through** (a door is a straight span);
- removing a corner **drops the openings on the two sides that merged** — they
  were measured against geometry that no longer exists.

**Every pointer gesture has a no-drag equivalent** (SC 2.5.7). Placement is
click-then-click; rotation and size are inspector fields; corners are picked and
typed; the palette places immediately for a pointer-*less* activation, because a
keyboard user has no way to click the canvas afterwards.

**Client-minted ids are stripped on save.** Every `Id` on the document DTOs is a
`Guid?`, so sending back a `local-…` id is a **model-binding 400, not a new
object**. `floorPlanService.toWirePayload` strips them through the single
`isLocalId` predicate; `localIds.ts` is deliberately kind-agnostic at the outer
level so a new local-id collection cannot be forgotten.

**A footprint is never written twice.** Each symbol is authored in its own
centimetre box, and the palette's default size is *derived* from it. The
wayfinding kinds are the one exception, and only because they have no authored
box at all.

## 6. Save

One `PUT /api/floorplan/{id}` of the **whole document**, with optimistic
concurrency on `updatedAt` (a mismatch is a `409` → "reload"). Edits autosave
1.5 s after the admin stops and at most 10 s into continuous editing; the browser
still warns for the window in between, and Save stays as an explicit "save now"
and the recovery path when autosave gives up.

A table's **identity, details, QR and lifecycle stay on `/api/tables`** — the
document PUT only touches geometry. Those ops end in a reload, so each one
**flushes the pending save first** rather than being disabled while dirty.

## 7. Traps

- **No inline hex** — the gate fires on SVG `fill`/`stroke` literals too. Use
  theme-invariant exact-value tokens, never semantic `--feedback-*`.
- **File-length limits** apply per layer (250 LOC components, 200 LOC hooks/lib).
  Regenerate `scripts/file-length-baseline.txt` in the PR that deletes files.
- **Screenshot baselines are linux-only.** Regenerate via the Screenshots
  workflow_dispatch and commit only the changed PNGs — never hand-edit them.
- **Sonar new-code duplication** between the craft and classic skins → shared
  shell + a `styles` prop, not two copies.
- **`BaseModal` children evaluate while closed** — guard data access with `?.`.
- **Review-gate budget** fails on large diffs; raise `RUMI_REVIEW_BUDGET_USD`
  rather than failing open.

## 8. Tests

| Kind | Where | Pins |
|---|---|---|
| Unit | `lib/floorPlan/*.test.ts` | All the maths — snapping, gestures, wall reshaping, zones |
| Component | `components/floor-plan/**/*.test.tsx` | Rendered geometry, roles, accessible names |
| **Mirroring** | `FloorPlanScene.mirroring.test.tsx` | Guest and admin emit identical geometry |
| Visual | `e2e/screenshots/` | Per-template full-page baselines (linux-only) |
| E2E | `e2e/tests/public/reservations-floor-plan.e2e.ts` | Booking through the map, the List alternative, keyboard operation, axe |

`FloorPlanGuestMap.test.tsx` also pins **the accessible names the e2e queries
by**, so a rename fails fast in jest instead of timing out in Playwright twenty
minutes later.
