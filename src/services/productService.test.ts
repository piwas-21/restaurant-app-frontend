import { apiClient } from '@/utils/apiClient';
import { searchProducts } from './productService';

/**
 * `searchProducts` and the OPTION-ONLY opt-in (frontend #631).
 *
 * One function serves two pickers that must NOT see the same catalog. The bundle option picker
 * chooses which products a section offers, so it has to find an option-only item; the side-item
 * picker suggests something a guest orders ALONGSIDE a dish, so it must not offer one — an
 * option-only item is by definition unorderable on its own.
 *
 * The assertion is on the outgoing URL and not on the argument, because the argument is only a
 * request to send the parameter: a call that passed the option and built the URL without it would
 * satisfy an argument check and change nothing on the wire.
 */
const mockedGet = apiClient.get as jest.Mock;

function requestedUrl(): string {
  return mockedGet.mock.calls[0][0] as string;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGet.mockResolvedValue({ success: true, data: { items: [] } });
});

describe('searchProducts — includeComponents', () => {
  it('asks for option-only items when the caller opts in', async () => {
    await searchProducts('viande', { includeComponents: true });

    expect(requestedUrl()).toContain('includeComponents=true');
  });

  /**
   * The negative control, and the one that matters most: this is the request the SIDE-ITEM picker
   * sends. If it ever grows the parameter, an option-only item becomes suggestable beside a dish
   * and therefore orderable on its own — the exact thing the flag exists to prevent.
   */
  it('leaves the request byte-identical for a caller that passes no options', async () => {
    await searchProducts('frites');

    expect(requestedUrl()).toBe('/api/Products?search=frites&pageSize=20');
  });

  it('sends nothing when the option is present but false', async () => {
    await searchProducts('frites', { includeComponents: false });

    expect(requestedUrl()).toBe('/api/Products?search=frites&pageSize=20');
  });

  it('still encodes the search term when it opts in', async () => {
    await searchProducts('viande hachée & co', { includeComponents: true });

    expect(requestedUrl()).toBe(
      `/api/Products?search=${encodeURIComponent('viande hachée & co')}&pageSize=20&includeComponents=true`,
    );
  });
});
