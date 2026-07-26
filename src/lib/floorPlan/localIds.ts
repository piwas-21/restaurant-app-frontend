import type { FloorPlanDocument } from '@/types/floorPlan';

/**
 * Client-minted ids for objects the editor creates before a Save exists to give
 * them a server one (FLOOR-PLAN-REVAMP §4.3). Every `Id` on the document DTOs is
 * a `Guid?`, so sending one of these back is a **model-binding 400, not a new
 * object** — `floorPlanService.toWirePayload` strips them on the way out, and
 * {@link isLocalId} is the single predicate it uses.
 *
 * The prefix is deliberately *kind-agnostic at the outer level* (`local-`): items
 * came first, then S7's walls and openings, and a per-kind check would have meant
 * the service silently leaking whichever kind was added last. The kind segment
 * exists only so the counters stay independent and the ids read legibly in a
 * debugger.
 */

export const LOCAL_ID_PREFIX = 'local-';

/** The collections the editor can create into before the first Save. */
export type LocalIdKind = 'item' | 'wall' | 'opening';

const prefixOf = (kind: LocalIdKind): string => `${LOCAL_ID_PREFIX}${kind}-`;

/**
 * Is this id one the editor minted (i.e. not yet persisted)? Covers every kind,
 * so a new local-id collection can never be forgotten by the save path.
 */
export const isLocalId = (id: string): boolean => id.startsWith(LOCAL_ID_PREFIX);

/**
 * The next free local id of a kind. Derived from the ids already present rather
 * than a module counter, so it survives undo/redo and a reload without ever
 * colliding — and so every creation stays a pure function of the document.
 */
export function nextLocalId(kind: LocalIdKind, existing: ReadonlyArray<string | null | undefined>): string {
  const prefix = prefixOf(kind);
  const used = existing.reduce<number>((max, id) => {
    const suffix = id?.startsWith(prefix) ? Number(id.slice(prefix.length)) : Number.NaN;
    return Number.isInteger(suffix) && suffix > max ? suffix : max;
  }, 0);
  return `${prefix}${used + 1}`;
}

/** The next free local id for a placed item. */
export const nextLocalItemId = (doc: FloorPlanDocument): string =>
  nextLocalId(
    'item',
    doc.items.map((item) => item.id),
  );

/** The next free local id for a wall. */
export const nextLocalWallId = (doc: FloorPlanDocument): string =>
  nextLocalId(
    'wall',
    doc.walls.map((wall) => wall.id),
  );

/**
 * The next free local id for an opening. Openings are numbered across the WHOLE
 * plan, not per wall: an opening can be moved between walls (its `segmentIndex`
 * is just data), and a per-wall counter would mint a colliding id the moment it
 * was.
 */
export const nextLocalOpeningId = (doc: FloorPlanDocument): string =>
  nextLocalId(
    'opening',
    doc.walls.flatMap((wall) => wall.openings.map((opening) => opening.id)),
  );
