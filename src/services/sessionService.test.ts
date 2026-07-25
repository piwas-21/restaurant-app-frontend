import { getSessionId, getOrCreateSessionId, clearSessionId } from './sessionService';

/**
 * The session id is the *only* thing that identifies an anonymous guest's basket to
 * the backend (`X-Session-Id`), so these tests are about unguessability first and
 * shape second. It used to be built from `Math.random()`.
 */
describe('sessionService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it('mints a v4 UUID', () => {
    expect(getOrCreateSessionId()).toMatch(UUID_V4);
  });

  // The point of the change: entropy comes from the CSPRNG, never from Math.random.
  it('never falls back to Math.random', () => {
    const mathRandom = jest.spyOn(Math, 'random');
    getOrCreateSessionId();
    expect(mathRandom).not.toHaveBeenCalled();
  });

  it('uses Web Crypto', () => {
    const fromCrypto = jest.spyOn(crypto, 'randomUUID');
    getOrCreateSessionId();
    expect(fromCrypto).toHaveBeenCalled();
  });

  // A browser on plain http has getRandomValues but not randomUUID; the id must still
  // be CSPRNG-derived rather than silently degrading to something guessable.
  it('builds a conforming v4 from getRandomValues when randomUUID is unavailable', () => {
    const original = crypto.randomUUID;
    // @ts-expect-error — simulating a non-secure context, where this is undefined.
    crypto.randomUUID = undefined;
    const bytes = jest.spyOn(crypto, 'getRandomValues');
    const mathRandom = jest.spyOn(Math, 'random');
    try {
      const id = getOrCreateSessionId();
      expect(id).toMatch(UUID_V4);
      expect(bytes).toHaveBeenCalled();
      expect(mathRandom).not.toHaveBeenCalled();
    } finally {
      crypto.randomUUID = original;
    }
  });

  it('reuses the stored id rather than minting a new one', () => {
    const first = getOrCreateSessionId();
    expect(getOrCreateSessionId()).toBe(first);
    expect(getSessionId()).toBe(first);
  });

  it('mints a different id for a different guest', () => {
    const a = getOrCreateSessionId();
    clearSessionId();
    expect(getOrCreateSessionId()).not.toBe(a);
  });

  it('has no session before one is created', () => {
    expect(getSessionId()).toBeNull();
  });
});
