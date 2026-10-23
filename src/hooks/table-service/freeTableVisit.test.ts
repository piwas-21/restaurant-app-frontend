import {
  closeTableServiceSession,
  getTableServiceSession,
  releaseTableServiceSession,
} from '@/services/tableServiceSessionService';
import type { TableServiceSessionDto } from '@/types/order';
import { freeTableVisit } from './freeTableVisit';

jest.mock('@/services/tableServiceSessionService');
const release = jest.mocked(releaseTableServiceSession);
const close = jest.mocked(closeTableServiceSession);
const read = jest.mocked(getTableServiceSession);
const released = {
  serviceSessionId: 'old-visit',
  status: 'Open',
  version: 8,
  isTableReleased: true,
  canClose: true,
} as TableServiceSessionDto;

beforeEach(() => jest.resetAllMocks());

it('frees and readies the table and closes a settled visit with the released version in one action', async () => {
  release.mockResolvedValue(released);
  const closed = { ...released, status: 'Closed', version: 9 };
  close.mockResolvedValue(closed);
  await expect(freeTableVisit('old-visit', 7)).resolves.toEqual(closed);
  expect(release).toHaveBeenCalledWith('old-visit', { expectedVersion: 7, markReady: true });
  expect(close).toHaveBeenCalledWith('old-visit', { expectedVersion: 8 });
});

it('keeps unpaid or unfinished visits available for later settlement without attempting to close', async () => {
  const payable = { ...released, canClose: false, outstanding: 18 };
  release.mockResolvedValue(payable);
  await expect(freeTableVisit('old-visit', 7)).resolves.toEqual(payable);
  expect(close).not.toHaveBeenCalled();
});

it('keeps the committed release successful when exact financial guards refuse finalization', async () => {
  release.mockResolvedValue(released);
  close.mockRejectedValue(new Error('Pending checkout'));
  read.mockResolvedValue({ ...released, canClose: false });
  await expect(freeTableVisit('old-visit', 7)).resolves.toEqual({ ...released, canClose: false });
});

it('reads back a close whose response was lost without issuing another release or close', async () => {
  release.mockResolvedValue(released);
  close.mockRejectedValue(new Error('Network timeout'));
  const closed = { ...released, status: 'Closed', version: 9 };
  read.mockResolvedValue(closed);
  await expect(freeTableVisit('old-visit', 7)).resolves.toEqual(closed);
  expect(release).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
});

it('retains affirmative release evidence if finalization and its readback are unavailable', async () => {
  release.mockResolvedValue(released);
  close.mockRejectedValue(new Error('Timeout'));
  read.mockRejectedValue(new Error('Offline'));
  await expect(freeTableVisit('old-visit', 7)).resolves.toEqual(released);
});

it('propagates a release refusal without trying to close or claiming the table is free', async () => {
  release.mockRejectedValue(new Error('Stale visit'));
  await expect(freeTableVisit('old-visit', 7)).rejects.toThrow('Stale visit');
  expect(close).not.toHaveBeenCalled();
});
