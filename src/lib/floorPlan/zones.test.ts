import type { FloorPlanTableGeometry, FloorPlanWall } from '@/types/floorPlan';
import { planZones, pointInPolygon, tableRoom } from './zones';

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

describe('floorPlan/zones — pointInPolygon', () => {
  it('detects points inside and outside a polygon', () => {
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    expect(pointInPolygon({ x: 5, y: 12 }, square)).toBe(false);
  });
});

describe('floorPlan/zones — tableRoom', () => {
  const main = room('Main room', square);
  const terrace = room('Terrace', [
    { x: 10, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 10 },
    { x: 10, y: 10 },
  ]);

  it('returns the room a table sits in', () => {
    expect(tableRoom(tableAt('1', 5, 5), [main, terrace])).toBe('Main room');
    expect(tableRoom(tableAt('2', 15, 5), [main, terrace])).toBe('Terrace');
  });

  it('returns null for a table in no room and ignores open / unnamed walls', () => {
    expect(tableRoom(tableAt('3', 30, 30), [main, terrace])).toBeNull();
    expect(tableRoom(tableAt('4', 5, 5), [room('Open', square, false)])).toBeNull();
    expect(tableRoom(tableAt('5', 5, 5), [room(null, square)])).toBeNull();
  });
});

describe('floorPlan/zones — planZones', () => {
  it('lists the distinct room zones present among tables, first-seen order', () => {
    const main = room('Main room', square);
    const terrace = room('Terrace', [
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
      { x: 10, y: 10 },
    ]);
    const tables = [tableAt('a', 15, 5), tableAt('b', 5, 5), tableAt('c', 6, 6), tableAt('d', 99, 99)];
    expect(planZones(tables, [main, terrace])).toEqual(['Terrace', 'Main room']);
  });
});
