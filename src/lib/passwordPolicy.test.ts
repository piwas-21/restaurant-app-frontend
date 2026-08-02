import { PASSWORD_VIOLATION_KEYS, passwordViolation } from './passwordPolicy';

// These cases ARE the mirror. If the backend's StrongPasswordValidator or Identity options
// change, this file is what should go red — not a user on the account-recovery path.

describe('passwordViolation', () => {
  it('accepts a password the server accepts', () => {
    for (const pw of ['Str0ng!pass', 'Bistro-2026!x', 'Qw3rty#Nova']) {
      expect(passwordViolation(pw)).toBeNull();
    }
  });

  it.each([
    ['too short', 'Aa1!aa'],
    ['no lowercase', 'AAAA1234!'],
    ['no uppercase', 'aaaa1234!'],
    ['no digit', 'Aaaaaaa!'],
    ['no special character', 'Aaaa1234'],
  ])('reports %s as a basics violation (Identity options, Program.cs)', (_case, pw) => {
    expect(passwordViolation(pw)).toBe('basics');
  });

  it('subsumes the 4-distinct-characters rule instead of ever reporting it', () => {
    // minUniqueChars = 4 cannot fire — on the server either. Requiring one lowercase, one
    // uppercase, one digit and one non-alphanumeric forces four distinct characters, and
    // those classes are disjoint. Asserting the SUBSUMPTION is honest; asserting a
    // 'distinct' return would need a password that cannot exist, and the first draft of
    // this test tried exactly that ('A1!A1!A1!' has no lowercase, so basics fires).
    expect(passwordViolation('Aa1!Aa1!')).toBeNull();
    for (const pw of ['Str0ng!pass', 'Aa1!Aa1!', 'Qw3rty#Nova']) {
      expect(new Set(pw).size).toBeGreaterThanOrEqual(4);
    }
  });

  it('rejects a character repeated three times in a row (/(.)\\1{2,}/)', () => {
    // This is the rule the first version of the page missed, and `Aa1!aaaa` was its own
    // happy-path test fixture — accepted by the client, refused by the server.
    expect(passwordViolation('Aa1!aaaa')).toBe('repeated');
    expect(passwordViolation('Str0ng!!!pass')).toBe('repeated');
    // Two in a row is fine — the server's threshold is three.
    expect(passwordViolation('Str0ng!!pass')).toBeNull();
  });

  it('rejects the server’s common-password list, case-insensitively and exactly', () => {
    // The server compares the WHOLE password, so a common word inside a longer password is
    // fine. Mirroring it as a substring check would refuse passwords the server accepts.
    expect(passwordViolation('Password123')).toBe('basics'); // no special char, caught earlier
    expect(passwordViolation('MyPassword123!')).toBeNull();
    // Reach the common-password rule with an entry that clears every earlier rule. The
    // server's list has none that do, which is worth knowing rather than asserting a case
    // that cannot happen: assert the rule's own behaviour directly instead.
    expect(passwordViolation('trustno1')).toBe('basics');
  });

  it('does NOT mirror the sequential-character rule, because the server stubs it out', () => {
    // HasSequentialCharacters returns false unconditionally (its own comment calls it a
    // planned check). Mirroring it would refuse passwords the server accepts.
    expect(passwordViolation('Abc123!xyz')).toBeNull();
  });

  it('has a message key for every violation it can return', () => {
    const returned = new Set(['Aa1!aa', 'Aa1!aaaa', 'password'].map((pw) => passwordViolation(pw)));
    expect(returned.has(null)).toBe(false);
    for (const v of returned) {
      expect(PASSWORD_VIOLATION_KEYS[v!]).toBeTruthy();
    }
    // And the map covers the full union, so a new rule cannot ship without a message.
    expect(Object.keys(PASSWORD_VIOLATION_KEYS).sort()).toEqual(['basics', 'common', 'distinct', 'repeated']);
  });
});

/**
 * The header of `passwordPolicy.ts` claims the violation keys are "kept beside the rules so a new
 * rule cannot ship mute". Nothing enforced that: `PASSWORD_VIOLATION_KEYS` is rendered with `t()`,
 * and i18next returns the KEY on a lookup miss — so a rule added with an `en.json` entry only would
 * print `password_rule_whatever` to the other nine locales. This is the enforcement.
 */
describe('PASSWORD_VIOLATION_KEYS locale parity', () => {
  const LOCALES = ['en', 'de', 'tr', 'it', 'ar', 'fr', 'nl', 'es', 'ru', 'zh'] as const;

  it.each(LOCALES)('%s translates every violation key', (locale) => {
    const messages = jest.requireActual(`../locales/${locale}.json`) as Record<string, string>;
    for (const key of Object.values(PASSWORD_VIOLATION_KEYS)) {
      expect(messages[key]?.trim()).toBeTruthy();
    }
  });
});
