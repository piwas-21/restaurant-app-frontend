import type { FloorPlanDocument, FloorPlanItem, FloorPlanWall } from '@/types/floorPlan';
import {
  addItem,
  addWall,
  findMovable,
  removeItem,
  removeWall,
  setPlanSize,
  updateItem,
  updateTable,
  updateWall,
} from './document';

const doc = (): FloorPlanDocument => ({
  id: 'p',
  name: 'Plan',
  widthMeters: 10,
  heightMeters: 8,
  gridSizeCm: 25,
  backgroundStyle: 'plain',
  isDefault: true,
  displayOrder: 0,
  walls: [{ id: 'w1', points: [], thicknessMeters: 0.1, isClosed: false, zIndex: 0, openings: [] }],
  items: [
    { id: 'i1', kind: 'plant_small', x: 1, y: 1, widthMeters: 0.5, heightMeters: 0.5, rotationDegrees: 0, zIndex: 0 },
  ],
  tables: [
    {
      id: 't1',
      tableNumber: '1',
      maxGuests: 4,
      isActive: true,
      isOutdoor: false,
      positionX: 2,
      positionY: 2,
      width: 1,
      height: 1,
      shape: 'round',
      rotation: 0,
    },
  ],
});

describe('floorPlan/document', () => {
  it('patches a table immutably and leaves an unknown id alone', () => {
    const before = doc();
    const after = updateTable(before, 't1', { rotation: 45 });
    expect(after).not.toBe(before);
    expect(after.tables[0].rotation).toBe(45);
    expect(before.tables[0].rotation).toBe(0); // original untouched
    expect(updateTable(before, 'nope', { rotation: 90 }).tables[0].rotation).toBe(0);
  });

  it('patches an item and leaves an unknown id alone', () => {
    expect(updateItem(doc(), 'i1', { x: 3 }).items[0].x).toBe(3);
    const untouched = doc();
    expect(updateItem(untouched, 'nope', { x: 9 })).toEqual(untouched);
  });

  it('adds and removes items', () => {
    const item: FloorPlanItem = {
      id: 'i2',
      kind: 'tree',
      x: 5,
      y: 5,
      widthMeters: 1,
      heightMeters: 1,
      rotationDegrees: 0,
      zIndex: 1,
    };
    expect(addItem(doc(), item).items).toHaveLength(2);
    expect(removeItem(doc(), 'i1').items).toHaveLength(0);
  });

  it('adds, patches and removes walls', () => {
    const wall: FloorPlanWall = {
      id: 'w2',
      points: [],
      thicknessMeters: 0.15,
      isClosed: true,
      roomName: 'X',
      zIndex: 1,
      openings: [],
    };
    expect(addWall(doc(), wall).walls).toHaveLength(2);
    expect(updateWall(doc(), 'w1', { roomName: 'Main' }).walls[0].roomName).toBe('Main');
    expect(updateWall(doc(), 'nope', { roomName: 'X' }).walls[0].roomName).toBeUndefined();
    expect(removeWall(doc(), 'w1').walls).toHaveLength(0);
  });

  it('sets the plan size', () => {
    const after = setPlanSize(doc(), 12, 9);
    expect(after.widthMeters).toBe(12);
    expect(after.heightMeters).toBe(9);
  });

  it('finds a movable table or item by id, or null', () => {
    expect(findMovable(doc(), 't1')).toEqual({ kind: 'table', table: doc().tables[0] });
    expect(findMovable(doc(), 'i1')).toEqual({ kind: 'item', item: doc().items[0] });
    expect(findMovable(doc(), 'zzz')).toBeNull();
  });
});
