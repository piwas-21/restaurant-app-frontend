import { act, renderHook } from '@testing-library/react';
import type { DeliveryChannelCategorySummary } from '@/types/deliveryChannelMenuSelection';
import { useDeliveryChannelCategoryCandidateFilters } from './useDeliveryChannelCategoryCandidateFilters';

const category = (categoryId: string): DeliveryChannelCategorySummary => ({
  categoryId,
  name: categoryId,
  displayOrder: 1,
  totalItemCount: 1,
  supportedItemCount: 1,
  unsupportedItemCount: 0,
});

it('clears a retired category filter and searches with filters matching the refreshed source', () => {
  const onSearch = jest.fn().mockResolvedValue(true);
  const { result, rerender } = renderHook(
    ({ revision, categories }: { revision: string; categories: readonly DeliveryChannelCategorySummary[] }) =>
      useDeliveryChannelCategoryCandidateFilters(revision, categories, onSearch),
    { initialProps: { revision: 'source-1', categories: [category('mains'), category('drinks')] } },
  );

  act(() => result.current.changeCategory('drinks'));
  expect(result.current.categoryFilter).toBe('drinks');
  expect(onSearch).toHaveBeenLastCalledWith('', 'drinks');

  rerender({ revision: 'source-2', categories: [category('mains')] });

  expect(result.current.categoryFilter).toBe('');
  expect(result.current.appliedQuery).toBe('');
  expect(onSearch).toHaveBeenLastCalledWith('', null);
});
