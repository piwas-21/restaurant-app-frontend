import { apiClient } from '@/utils/apiClient';
import { getTenantPartner } from './tenantPartnerService';

jest.mock('@/utils/apiClient', () => ({ apiClient: { get: jest.fn() } }));
const get = apiClient.get as jest.Mock;

it('aborts a hanging branding request and allows the next attempt', async () => {
  jest.useFakeTimers();
  get
    .mockImplementationOnce(
      (_route: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    )
    .mockResolvedValueOnce({ data: { name: 'Recovered', url: null } });
  const pending = getTenantPartner();
  const rejection = expect(pending).rejects.toThrow('Aborted');
  jest.advanceTimersByTime(5000);
  await rejection;
  expect(get.mock.calls[0][1]).toMatchObject({ skipAuth: true, skipSession: true });
  await expect(getTenantPartner()).resolves.toMatchObject({ data: { name: 'Recovered' } });
  jest.useRealTimers();
});
