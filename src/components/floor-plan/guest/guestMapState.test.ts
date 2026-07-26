import type { FloorPlanTableGeometry, FloorPlanWall } from '@/types/floorPlan';
import { statesById, tableInfos, type GuestMapContext } from './guestMapState';

const room: FloorPlanWall = {
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
  thicknessMeters: 0.15,
  isClosed: true,
  roomName: 'Main room',
  zIndex: 0,
  openings: [],
};

const table = (id: string, maxGuests: number, x = 5, y = 5): FloorPlanTableGeometry => ({
  id,
  tableNumber: id,
  maxGuests,
  isActive: true,
  isOutdoor: false,
  positionX: x,
  positionY: y,
  width: 1,
  height: 1,
  shape: 'round',
  rotation: 0,
});

const ctx = (overrides: Partial<GuestMapContext> = {}): GuestMapContext => ({
  plan: { walls: [room], items: [] },
  selectedIds: [],
  bookedIds: [],
  party: 2,
  zoneFilter: null,
  ...overrides,
});

describe('guestMapState — tableInfos', () => {
  it('marks a selected table selected and a booked table booked', () => {
    const infos = tableInfos([table('a', 4), table('b', 4)], ctx({ selectedIds: ['a'], bookedIds: ['b'] }));
    expect(infos[0].state).toBe('selected');
    expect(infos[1].state).toBe('booked');
    expect(infos[0].bookable).toBe(true);
    expect(infos[1].bookable).toBe(false);
  });

  it('flags a table smaller than the party but keeps it BOOKABLE', () => {
    // The flow's answer to a large party is combining tables ("select multiple
    // tables and request to combine them"), so `small` must warn, never forbid.
    const [info] = tableInfos([table('a', 2)], ctx({ party: 4 }));
    expect(info.state).toBe('small');
    expect(info.bookable).toBe(true);
  });

  it('leaves EVERY table bookable when the party exceeds all of them', () => {
    // The dead end this fixes: a party of 10 in a room whose largest table seats 6
    // used to grey out every table with nothing selectable and no explanation.
    const infos = tableInfos([table('a', 6), table('b', 4)], ctx({ party: 10 }));
    expect(infos.map((i) => i.state)).toEqual(['small', 'small']);
    expect(infos.every((i) => i.bookable)).toBe(true);
  });

  it('still refuses a booked table, whatever its size', () => {
    const [info] = tableInfos([table('a', 8)], ctx({ party: 2, bookedIds: ['a'] }));
    expect(info.bookable).toBe(false);
  });

  it('dims a table outside the active zone filter', () => {
    const outside = table('a', 4, 99, 99); // in no room
    const [info] = tableInfos([outside], ctx({ zoneFilter: 'Main room' }));
    expect(info.zone).toBeNull();
    expect(info.state).toBe('dim');
  });

  it('leaves an in-zone table available under a matching filter', () => {
    const [info] = tableInfos([table('a', 4)], ctx({ zoneFilter: 'Main room' }));
    expect(info.zone).toBe('Main room');
    expect(info.state).toBe('available');
  });

  it('resolves the zone from the containing room', () => {
    const [info] = tableInfos([table('a', 4)], ctx());
    expect(info.zone).toBe('Main room');
  });
});

describe('guestMapState — statesById', () => {
  it('keys the render states by table id', () => {
    const infos = tableInfos([table('a', 4), table('b', 4)], ctx({ selectedIds: ['a'] }));
    expect(statesById(infos)).toEqual({ a: 'selected', b: 'available' });
  });
});
