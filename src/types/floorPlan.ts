/**
 * Floor-plan document types — the frontend mirror of the backend
 * `Features/FloorPlan/Dtos/*` contract (FLOOR-PLAN-REVAMP S3). One document is
 * the whole scene the guest map renders and the admin editor saves: room
 * dimensions, walls (with openings), decor/structure items, and table geometry.
 * All coordinates are in real-world metres (origin top-left, x → right, y →
 * down); a table's `positionX/Y` is its centre and rotation is about that centre.
 */

/** A wall vertex in metres. */
export interface FloorPlanPoint {
  x: number;
  y: number;
}

/** Table footprint shape vocabulary (backend enum). */
export type FloorPlanTableShape = 'round' | 'square' | 'rectangle' | 'booth';

/** Opening kind on a wall segment. */
export type FloorPlanOpeningKind = 'door' | 'window' | 'opening';

/** A door / window / gap pinned to one segment of its parent wall polyline. */
export interface FloorPlanOpening {
  /** Server id when echoing a stored opening; absent for a new one. */
  id?: string;
  segmentIndex: number;
  offsetMeters: number;
  widthMeters: number;
  kind: FloorPlanOpeningKind;
  /** Door swing hint (e.g. "in" / "out" / "left" / "right" / "none"). */
  swingDirection: string;
}

/** A wall chain (polyline of vertices in metres); a closed chain is a room. */
export interface FloorPlanWall {
  id?: string;
  points: FloorPlanPoint[];
  thicknessMeters: number;
  isClosed: boolean;
  roomName?: string | null;
  floorStyle?: string | null;
  zIndex: number;
  openings: FloorPlanOpening[];
}

/** A structure / decor / wayfinding element placed on the plan (metres). */
export interface FloorPlanItem {
  id?: string;
  /** Renderer symbol token (e.g. "bar_counter", "plant_small", "entrance"). */
  kind: string;
  x: number;
  y: number;
  widthMeters: number;
  heightMeters: number;
  rotationDegrees: number;
  zIndex: number;
  label?: string | null;
  styleVariant?: string | null;
}

/** A table's identity + geometry as it sits on the plan. */
export interface FloorPlanTableGeometry {
  id: string;
  tableNumber: string;
  maxGuests: number;
  isActive: boolean;
  isOutdoor: boolean;
  notes?: string | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  shape: FloorPlanTableShape;
  rotation: number;
}

/**
 * The whole floor-plan document. `updatedAt` is the optimistic-concurrency
 * token — echo it back unchanged on a save (a mismatch is a 409).
 */
export interface FloorPlanDocument {
  id: string;
  name: string;
  widthMeters: number;
  heightMeters: number;
  gridSizeCm: number;
  backgroundStyle: string;
  isDefault: boolean;
  displayOrder: number;
  updatedAt?: string | null;
  walls: FloorPlanWall[];
  items: FloorPlanItem[];
  tables: FloorPlanTableGeometry[];
}
