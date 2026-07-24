import { renderHook, act, waitFor } from '@testing-library/react';
import { useEditorTables } from './useEditorTables';
import { tableLayoutService } from '@/services/tableLayoutService';
import type { TableDto } from '@/types/reservation';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k, i18n: { language: 'en' } }),
}));

jest.mock('@/services/tableLayoutService', () => ({
  tableLayoutService: {
    getAllTables: jest.fn(),
    updateTable: jest.fn(),
    createTable: jest.fn(),
    deleteTable: jest.fn(),
  },
}));
jest.mock('@/services/tableQRService', () => ({ generateTableQRCode: jest.fn() }));

const svc = tableLayoutService as jest.Mocked<typeof tableLayoutService>;
const dto = (over: Partial<TableDto> = {}): TableDto => ({
  id: 't1',
  tableNumber: '1',
  maxGuests: 4,
  isActive: true,
  isOutdoor: false,
  positionX: 5,
  positionY: 5,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  svc.getAllTables.mockResolvedValue([dto()]);
  svc.updateTable.mockResolvedValue(dto());
});

describe('useEditorTables — saveProperties position sourcing', () => {
  it('sends the authoritative geometry position, not the /api/tables cache', async () => {
    const { result } = renderHook(() => useEditorTables(jest.fn()));
    await waitFor(() => expect(result.current.tables).toHaveLength(1));

    // The cache has X/Y = 5; the plan document moved the table to (8, 3).
    await act(async () => {
      await result.current.saveProperties('t1', { maxGuests: 6 }, { x: 8, y: 3 });
    });

    expect(svc.updateTable).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ maxGuests: 6, positionX: 8, positionY: 3 }),
    );
  });
});
