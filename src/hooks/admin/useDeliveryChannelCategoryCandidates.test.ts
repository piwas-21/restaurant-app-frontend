import { act, renderHook, waitFor } from '@testing-library/react';
import { deliveryChannelManagementService } from '@/services/deliveryChannelManagementService';
import { ApiError } from '@/utils/apiClient';
import type {
  DeliveryChannelCategoryCandidate,
  DeliveryChannelCategoryCandidatePage,
} from '@/types/deliveryChannelMenuSelection';
import { useDeliveryChannelCategoryCandidates } from './useDeliveryChannelCategoryCandidates';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

const item = (selectionKey: string, name: string): DeliveryChannelCategoryCandidate => ({
  selectionKey,
  productId: selectionKey,
  variationId: null,
  categoryId: 'mains',
  categoryName: 'Mains',
  categoryDisplayOrder: 1,
  itemDisplayOrder: 1,
  name,
  variationName: null,
  priceMinor: 500,
  available: true,
  supported: true,
  blockReason: null,
});

const page = (
  items: readonly DeliveryChannelCategoryCandidate[],
  nextCursor: string | null,
  sourceRevision = 'source-1',
): DeliveryChannelCategoryCandidatePage => ({
  sourceRevision,
  language: 'en',
  nextCursor,
  items,
});

afterEach(() => jest.restoreAllMocks());

it('ignores an older candidate query response that arrives after a newer filter result', async () => {
  const older = deferred<DeliveryChannelCategoryCandidatePage>();
  const getCandidates = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockReturnValueOnce(older.promise)
    .mockResolvedValueOnce(page([item('falafel', 'Falafel')], null));
  const { result } = renderHook(() => useDeliveryChannelCategoryCandidates(true, 'source-1'));
  await waitFor(() => expect(getCandidates).toHaveBeenCalledTimes(1));

  await act(async () => {
    expect(await result.current.search('Falafel', 'mains')).toBe(true);
  });
  expect(result.current.candidates.map((candidate) => candidate.name)).toEqual(['Falafel']);

  await act(async () => {
    older.resolve(page([item('old', 'Old result')], 'old-cursor'));
    await older.promise;
  });
  expect(result.current.candidates.map((candidate) => candidate.name)).toEqual(['Falafel']);
  expect(result.current.cursor).toBeNull();
});

it('binds load-more requests to the exact search, category and source revision', async () => {
  const getCandidates = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockResolvedValueOnce(page([], null))
    .mockResolvedValueOnce(page([item('first', 'First')], 'page-two'))
    .mockResolvedValueOnce(page([item('second', 'Second')], null));
  const { result } = renderHook(() => useDeliveryChannelCategoryCandidates(true, 'source-1'));
  await waitFor(() => expect(getCandidates).toHaveBeenCalledTimes(1));

  await act(async () => result.current.search('soup', 'mains'));
  await waitFor(() => expect(result.current.cursor).toBe('page-two'));
  await act(async () => result.current.loadMore());

  expect(getCandidates).toHaveBeenNthCalledWith(1, '', null, null, 'source-1');
  expect(getCandidates).toHaveBeenNthCalledWith(2, 'soup', 'mains', null, 'source-1');
  expect(getCandidates).toHaveBeenNthCalledWith(3, 'soup', 'mains', 'page-two', 'source-1');
  expect(result.current.candidates.map((candidate) => candidate.selectionKey)).toEqual(['first', 'second']);
});

it('preserves the selected search and category when the source revision changes', async () => {
  const getCandidates = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockResolvedValueOnce(page([], null))
    .mockResolvedValueOnce(page([item('soup', 'Soup')], null))
    .mockResolvedValueOnce(page([item('soup-new', 'Soup new')], null, 'source-2'));
  const { result, rerender } = renderHook(
    ({ revision }: { revision: string }) => useDeliveryChannelCategoryCandidates(true, revision),
    { initialProps: { revision: 'source-1' } },
  );
  await waitFor(() => expect(getCandidates).toHaveBeenCalledTimes(1));
  await act(async () => result.current.search('soup', 'mains'));
  await waitFor(() => expect(result.current.candidates).toHaveLength(1));

  rerender({ revision: 'source-2' });
  await waitFor(() => expect(getCandidates).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(result.current.candidates[0]?.selectionKey).toBe('soup-new'));
  expect(getCandidates).toHaveBeenLastCalledWith('soup', 'mains', null, 'source-2');
  expect(result.current.candidates.map((candidate) => candidate.selectionKey)).toEqual(['soup-new']);
  expect(result.current.knownCandidates.map((candidate) => candidate.selectionKey)).toEqual(['soup-new']);
});

it('drops a stale cursor after a revision conflict and reloads the first page on refresh', async () => {
  const getCandidates = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockResolvedValueOnce(page([item('first', 'First')], 'cursor-1'))
    .mockRejectedValueOnce(new ApiError(409, '', undefined, 'SourceRevisionChanged'))
    .mockResolvedValueOnce(page([item('fresh', 'Fresh')], 'cursor-2'));
  const { result } = renderHook(() => useDeliveryChannelCategoryCandidates(true, 'source-1'));
  await waitFor(() => expect(result.current.cursor).toBe('cursor-1'));

  await act(async () => result.current.loadMore());
  expect(result.current.cursor).toBeNull();
  expect(result.current.cursorStale).toBe(true);
  expect(getCandidates).toHaveBeenCalledTimes(2);

  await act(async () => result.current.refreshCurrentQuery('source-1'));
  expect(getCandidates).toHaveBeenCalledTimes(3);
  expect(getCandidates).toHaveBeenLastCalledWith('', null, null, 'source-1');
  expect(result.current.cursorStale).toBe(false);
  expect(result.current.candidates.map((candidate) => candidate.selectionKey)).toEqual(['fresh']);
});

it('keeps a first-page search conflict stale instead of unlocking the selection', async () => {
  const getCandidates = jest
    .spyOn(deliveryChannelManagementService, 'getCategoryCandidates')
    .mockResolvedValueOnce(page([], null))
    .mockRejectedValueOnce(new ApiError(409, '', undefined, 'SourceRevisionChanged'));
  const { result } = renderHook(() => useDeliveryChannelCategoryCandidates(true, 'source-1'));
  await waitFor(() => expect(getCandidates).toHaveBeenCalledTimes(1));

  await act(async () => expect(await result.current.search('drink', 'drinks')).toBe(false));
  expect(result.current.cursorStale).toBe(true);
  expect(result.current.cursor).toBeNull();
});
