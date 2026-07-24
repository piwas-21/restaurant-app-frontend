import { getFloorPlan, saveFloorPlan } from './floorPlanService';
import { apiClient } from '@/utils/apiClient';
import type { FloorPlanDocument } from '@/types/floorPlan';

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
