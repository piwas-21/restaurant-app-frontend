import type { FloorPlanItem, FloorPlanTableGeometry, FloorPlanWall } from '@/types/floorPlan';
import { planZones, pointInPolygon, tableZone, zoneAt } from './zones';

const square = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

const room = (name: string | null, points: { x: number; y: number }[], isClosed = true): FloorPlanWall => ({
  points,
  thicknessMeters: 0.15,
  isClosed,
  roomName: name,
  zIndex: 0,
  openings: [],
});

const zone = (label: string | null, over: Partial<FloorPlanItem> = {}): FloorPlanItem => ({
  id: 'z1',
  kind: 'zone',
  x: 3,
  y: 3,
  widthMeters: 4,
  heightMeters: 4,
  rotationDegrees: 0,
  zIndex: 0,
  label,
  ...over,
});

const tableAt = (id: string, x: number, y: number, maxGuests = 2): FloorPlanTableGeometry => ({
  id,
  tableNumber: id,
  maxGuests,
  isActive: true,
  isOutdoor: false,
  positionX: x,
  positionY: y,
  width: 0.7,
  height: 0.7,
  shape: 'round',
  rotation: 0,
});

const plan = (walls: FloorPlanWall[], items: FloorPlanItem[] = []) => ({ walls, items });

const main = room('Main room', square);
const terrace = room('Terrace', [
  { x: 10, y: 0 },
  { x: 20, y: 0 },
  { x: 20, y: 10 },
  { x: 10, y: 10 },
]);

describe('floorPlan/zones — pointInPolygon', () => {
  it('detects points inside and outside a polygon', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: 5, y: 12 }, square)).toBe(false);
  });
});

describe('floorPlan/zones — tableZone from the rooms', () => {
  it('returns the room a table sits in', () => {
    expect(tableZone(tableAt('1', 5, 5), plan([main, terrace]))).toBe('Main room');
    expect(tableZone(tableAt('2', 15, 5), plan([main, terrace]))).toBe('Terrace');
  });

  it('returns null for a table in no room and ignores open / unnamed walls', () => {
    expect(tableZone(tableAt('3', 30, 30), plan([main, terrace]))).toBeNull();
    expect(tableZone(tableAt('4', 5, 5), plan([room('Open', square, false)]))).toBeNull();
    expect(tableZone(tableAt('5', 5, 5), plan([room(null, square)]))).toBeNull();
  });
});

describe('floorPlan/zones — a drawn zone region', () => {
  // A zone region exists precisely to name a place the walls do not, so one
  // inside a room has to beat that room — otherwise drawing it does nothing.
  it('beats the room it sits inside', () => {
    expect(tableZone(tableAt('1', 2, 2), plan([main], [zone('Lounge')]))).toBe('Lounge');
    expect(tableZone(tableAt('2', 8, 8), plan([main], [zone('Lounge')]))).toBe('Main room');
  });

  it('names a place with no walls around it at all', () => {
    expect(tableZone(tableAt('1', 2, 2), plan([], [zone('Window row')]))).toBe('Window row');
  });

  it('is ignored without a name — an unnamed region is decoration', () => {
    expect(tableZone(tableAt('1', 2, 2), plan([main], [zone(null)]))).toBe('Main room');
  });

  it('respects its rotation, so a turned region is not tested against its bounds', () => {
    // A 4 × 1 strip through (3, 3), turned 90°: (3, 4.4) is inside it once
    // rotated and outside its unrotated footprint.
    const strip = zone('Bar', { heightMeters: 1, rotationDegrees: 90 });
    expect(zoneAt({ x: 3, y: 4.4 }, plan([main], [strip]))).toBe('Bar');
    expect(zoneAt({ x: 4.4, y: 3 }, plan([main], [strip]))).toBe('Main room');
  });

  it('leaves other item kinds out of it', () => {
    const plant = zone('Not a zone', { kind: 'plant_small' });
    expect(tableZone(tableAt('1', 2, 2), plan([main], [plant]))).toBe('Main room');
  });
});

describe('floorPlan/zones — planZones', () => {
  it('lists the distinct zones present among tables, first-seen order', () => {
    const tables = [tableAt('a', 15, 5), tableAt('b', 5, 5), tableAt('c', 6, 6), tableAt('d', 99, 99)];
    expect(planZones(tables, plan([main, terrace]))).toEqual(['Terrace', 'Main room']);
  });

  it('includes a drawn region alongside the rooms', () => {
    const tables = [tableAt('a', 2, 2), tableAt('b', 8, 8)];
    expect(planZones(tables, plan([main], [zone('Lounge')]))).toEqual(['Lounge', 'Main room']);
  });
});
