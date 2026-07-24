import type { FloorPlanDocument } from '@/types/floorPlan';

/**
 * A compact but representative floor-plan document for scene tests — one closed
 * room with a window and a door, a symbol item, a tape label, the entrance
 * marker, and two tables (a round one and a rotated rectangle). Exercises every
 * layer.
 */
export function floorPlanFixture(): FloorPlanDocument {
  return {
    id: 'plan-1',
    name: 'Test floor',
    widthMeters: 6,
    heightMeters: 5,
    gridSizeCm: 25,
    backgroundStyle: 'plain',
    isDefault: true,
    displayOrder: 0,
    updatedAt: '2026-07-24T00:00:00Z',
    walls: [
      {
        id: 'w1',
        points: [
          { x: 0.2, y: 0.2 },
          { x: 5.8, y: 0.2 },
          { x: 5.8, y: 4.8 },
          { x: 0.2, y: 4.8 },
        ],
        thicknessMeters: 0.15,
        isClosed: true,
        roomName: 'Dining',
        floorStyle: 'wood',
        zIndex: 0,
        openings: [
          { id: 'o1', segmentIndex: 0, offsetMeters: 2, widthMeters: 1, kind: 'window', swingDirection: 'none' },
          { id: 'o2', segmentIndex: 2, offsetMeters: 2, widthMeters: 1, kind: 'door', swingDirection: 'in' },
          { id: 'o3', segmentIndex: 1, offsetMeters: 1.5, widthMeters: 1.2, kind: 'opening', swingDirection: 'none' },
        ],
      },
    ],
    items: [
      { id: 'i1', kind: 'bar_counter', x: 2, y: 0.7, widthMeters: 2, heightMeters: 0.5, rotationDegrees: 0, zIndex: 0 },
      { id: 'i2', kind: 'plant_small', x: 5, y: 4, widthMeters: 0.5, heightMeters: 0.5, rotationDegrees: 0, zIndex: 1 },
      {
        id: 'i3',
        kind: 'label',
        x: 1,
        y: 0.5,
        widthMeters: 1,
        heightMeters: 0.34,
        rotationDegrees: 0,
        zIndex: 2,
        label: 'Bar',
      },
      { id: 'i4', kind: 'entrance', x: 3, y: 4.7, widthMeters: 0.9, heightMeters: 0.6, rotationDegrees: 0, zIndex: 3 },
      // wc (ellipse) + bar_stool (circle) exercise the remaining primitive tags;
      // a zone region and a plain wall opening cover their layer branches.
      { id: 'i5', kind: 'wc', x: 5.3, y: 1, widthMeters: 0.8, heightMeters: 1, rotationDegrees: 0, zIndex: 4 },
      { id: 'i6', kind: 'bar_stool', x: 2, y: 1.3, widthMeters: 0.4, heightMeters: 0.4, rotationDegrees: 0, zIndex: 5 },
      {
        id: 'i7',
        kind: 'zone',
        x: 4.5,
        y: 3.8,
        widthMeters: 2,
        heightMeters: 1.5,
        rotationDegrees: 0,
        zIndex: 6,
        label: 'Lounge',
      },
    ],
    tables: [
      {
        id: 't1',
        tableNumber: '1',
        maxGuests: 4,
        isActive: true,
        isOutdoor: false,
        positionX: 1.5,
        positionY: 2.5,
        width: 1,
        height: 1,
        shape: 'round',
        rotation: 0,
      },
      {
        id: 't2',
        tableNumber: '2',
        maxGuests: 6,
        isActive: true,
        isOutdoor: false,
        positionX: 3.5,
        positionY: 2.5,
        width: 1.65,
        height: 0.85,
        shape: 'rectangle',
        rotation: 30,
      },
    ],
  };
}
