import { getFloorPlan, saveFloorPlan } from './floorPlanService';
import { apiClient } from '@/utils/apiClient';
import type { FloorPlanDocument, FloorPlanWall } from '@/types/floorPlan';

jest.mock('@/utils/apiClient');

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const doc: FloorPlanDocument = {
  id: 'plan-1',
  name: 'Main floor',
  widthMeters: 14,
  heightMeters: 9,
  gridSizeCm: 25,
  backgroundStyle: 'plain',
  isDefault: true,
  displayOrder: 0,
  updatedAt: '2026-07-24T00:00:00Z',
  walls: [],
  items: [],
  tables: [],
};

beforeEach(() => jest.clearAllMocks());

describe('floorPlanService', () => {
  it('getFloorPlan reads the anonymous default plan', async () => {
    mockApiClient.get.mockResolvedValue({ success: true, data: doc });

    const result = await getFloorPlan();

    expect(mockApiClient.get).toHaveBeenCalledWith('/api/floorplan');
    expect(result.data).toEqual(doc);
  });

  it('saveFloorPlan PUTs the whole document to its id, authenticated', async () => {
    mockApiClient.put.mockResolvedValue({ success: true, data: doc });

    await saveFloorPlan('plan-1', doc);

    expect(mockApiClient.put).toHaveBeenCalledWith('/api/floorplan/plan-1', doc, {
      requireAuth: true,
    });
  });

  it('strips a client-minted item id, which the API would reject as a non-Guid', async () => {
    mockApiClient.put.mockResolvedValue({ success: true, data: doc });
    const placed = {
      id: 'local-item-1',
      kind: 'column',
      x: 4,
      y: 3,
      widthMeters: 0.4,
      heightMeters: 0.4,
      rotationDegrees: 0,
      zIndex: 1,
    };
    const stored = { ...placed, id: 'e3f1c2d4-0000-4000-8000-000000000001', kind: 'tree' };

    await saveFloorPlan('plan-1', { ...doc, items: [placed, stored] });

    const sent = mockApiClient.put.mock.calls[0][1] as FloorPlanDocument;
    // The new item goes up as a new item; the stored one keeps its server id.
    expect(sent.items[0].id).toBeUndefined();
    expect(sent.items[1].id).toBe(stored.id);
    // Everything else about the placed item survives the trip.
    expect(sent.items[0]).toMatchObject({ kind: 'column', x: 4, y: 3 });
    expect(JSON.stringify(sent)).not.toContain('local-item-');
  });

  it('strips a client-minted id from EVERY collection, so a new wall or opening cannot 400 either', async () => {
    mockApiClient.put.mockResolvedValue({ success: true, data: doc });
    // The shape the wall tool (S7) will produce: local ids on a wall AND its
    // openings. Both DTO `Id` fields are `Guid?`, exactly like the item's.
    const wall: FloorPlanWall = {
      id: 'local-item-7',
      points: [{ x: 0, y: 0 }],
      thicknessMeters: 0.12,
      isClosed: false,
      zIndex: 0,
      openings: [
        {
          id: 'local-item-8',
          segmentIndex: 0,
          offsetMeters: 1,
          widthMeters: 0.9,
          kind: 'door' as const,
          swingDirection: 'in',
        },
        {
          id: 'aa11bb22-0000-4000-8000-000000000009',
          segmentIndex: 0,
          offsetMeters: 2,
          widthMeters: 0.9,
          kind: 'window' as const,
          swingDirection: 'none',
        },
      ],
    };

    await saveFloorPlan('plan-1', { ...doc, walls: [wall] });

    const sent = mockApiClient.put.mock.calls[0][1] as FloorPlanDocument;
    expect(sent.walls[0].id).toBeUndefined();
    expect(sent.walls[0].openings[0].id).toBeUndefined();
    // A stored id still round-trips — stripping must not orphan existing rows.
    expect(sent.walls[0].openings[1].id).toBe('aa11bb22-0000-4000-8000-000000000009');
    // The guard that fails the day a new collection is added without stripping.
    expect(JSON.stringify(sent)).not.toContain('local-');
  });

  it('propagates a save conflict envelope to the caller', async () => {
    mockApiClient.put.mockResolvedValue({
      success: false,
      message: 'The plan was changed by someone else. Reload and try again.',
    });

    const result = await saveFloorPlan('plan-1', doc);

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
  });
});
