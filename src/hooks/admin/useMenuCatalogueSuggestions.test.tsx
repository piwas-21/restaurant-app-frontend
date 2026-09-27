import { act, renderHook, waitFor } from '@testing-library/react';
import { listCatalogueTemplates } from '@/services/catalogueTemplateService';
import { useMenuCatalogueSuggestions } from './useMenuCatalogueSuggestions';

jest.mock('@/services/catalogueTemplateService', () => ({ listCatalogueTemplates: jest.fn() }));
jest.mock('@/utils/apiFormErrors', () => ({ serverMessage: jest.fn() }));

const template = {
  templateId: 'meal',
  revision: 2,
  type: 'bundle' as const,
  cuisines: ['turkish'],
  displayName: 'Meal',
  sourceLocale: 'tr' as const,
  displayLocale: 'en' as const,
  usedSourceFallback: false,
  reviewedTranslationLocales: ['en' as const],
  dependencyCount: 2,
  compatibleTenantContractVersions: [1],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.mocked(listCatalogueTemplates).mockResolvedValue({ items: [template], nextCursor: null });
});

afterEach(() => jest.useRealTimers());

describe('useMenuCatalogueSuggestions', () => {
  it('keeps the overlay quiet for short queries', () => {
    const { result } = renderHook(() => useMenuCatalogueSuggestions('x', 'en'));
    act(() => jest.advanceTimersByTime(500));
    expect(result.current.isVisible).toBe(false);
    expect(listCatalogueTemplates).not.toHaveBeenCalled();
  });

  it('debounces a bounded item and bundle lookup and merges exact revisions', async () => {
    const { result } = renderHook(() => useMenuCatalogueSuggestions('  taco  ', 'en'));
    act(() => jest.advanceTimersByTime(299));
    expect(listCatalogueTemplates).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.templates).toEqual([template]));

    expect(listCatalogueTemplates).toHaveBeenCalledTimes(2);
    expect(listCatalogueTemplates).toHaveBeenNthCalledWith(
      1,
      { type: 'item', q: 'taco', locale: 'en', limit: 6 },
      expect.any(AbortSignal),
    );
    expect(listCatalogueTemplates).toHaveBeenNthCalledWith(
      2,
      { type: 'bundle', q: 'taco', locale: 'en', limit: 6 },
      expect.any(AbortSignal),
    );
  });
});
