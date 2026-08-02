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

  /**
   * The expiry window is the other half of unguessability: an id that never expires is an id an
   * attacker has unlimited time to find. These pin the boundary, and the third one pins a bug the
   * E9 sweep surfaced — `isSessionExpired` guarded `new Date(str)` with a `try/catch`, but that
   * constructor does NOT throw on garbage, it returns `Invalid Date`. The catch was unreachable
   * and the live path compared against `NaN`, which is `false`, so a corrupted or tampered
   * `rumi_session_expiry` read as NOT EXPIRED and the 7-day window became unbounded.
   */
  describe('expiry', () => {
    const withStoredSession = (expiry: string) => {
      localStorage.setItem('rumi_session_id', getOrCreateSessionId());
      localStorage.setItem('rumi_session_expiry', expiry);
    };

    it('keeps a session whose expiry is in the future', () => {
      withStoredSession(new Date(Date.now() + 60_000).toISOString());
      expect(getSessionId()).not.toBeNull();
    });

    it('drops a session whose expiry has passed', () => {
      withStoredSession(new Date(Date.now() - 60_000).toISOString());
      expect(getSessionId()).toBeNull();
    });

    it.each(['not-a-date', '', 'NaN', '2026-13-45T99:99:99Z'])(
      'treats an unreadable expiry (%p) as EXPIRED rather than as never-expiring',
      (garbage) => {
        withStoredSession(garbage);
        expect(getSessionId()).toBeNull();
      },
    );
  });
});
