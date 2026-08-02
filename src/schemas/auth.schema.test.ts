import { loginSchema, staffRegistrationSchema, customerRegistrationSchema } from './auth.schema';

// A password the SERVER accepts: 8+, lower, upper, digit, non-alphanumeric, no 3-in-a-row repeat,
// not on the common list. Every fixture below derives from it so a schema change cannot be absorbed
// by a fixture that was already failing for a different reason.
const GOOD_PASSWORD = 'Sofra!2026'; // pragma: allowlist secret -- test fixture, not a credential

describe('Auth Schemas', () => {
  describe('loginSchema', () => {
    it('should validate correct login data', () => {
      const data = { email: 'test@example.com', password: 'password123' };
      expect(() => loginSchema.parse(data)).not.toThrow();
    });

    // Load-bearing: sign-in must NOT mirror the creation policy. `password123` is both too weak for
    // registration and on the server's common-password reject list, yet it has to pass here — an
    // account whose password predates the rule must still be able to attempt a login, and only the
    // server is entitled to refuse the credential.
    it('accepts a password the registration policy would reject', () => {
      const data = { email: 'test@example.com', password: 'password123' };
      expect(() => loginSchema.parse(data)).not.toThrow();
    });

    it('should invalidate an incorrect email', () => {
      const data = { email: 'not-an-email', password: 'password123' };
      expect(() => loginSchema.parse(data)).toThrow();
    });

    it('should invalidate with a missing password', () => {
      const data = { email: 'test@example.com' };
      expect(() => loginSchema.parse(data)).toThrow();
    });
  });

  // Both registration schemas enforce the same mirrored policy, so they are exercised by the same
  // table. The cases are the ones that used to round-trip to a 400 and come back as "An unexpected
  // error occurred" (BUGS-IMPROVEMENTS-PLAN E9).
  describe.each([
    ['staffRegistrationSchema', staffRegistrationSchema, { role: 'Server' }],
    ['customerRegistrationSchema', customerRegistrationSchema, {}],
  ])('%s', (_name, schema, extra) => {
    const validData = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: GOOD_PASSWORD,
      confirmPassword: GOOD_PASSWORD,
      ...extra,
    };

    it('validates a password the server would accept', () => {
      expect(() => schema.parse(validData)).not.toThrow();
    });

    it('should invalidate if passwords do not match', () => {
      const data = { ...validData, confirmPassword: 'Different!2026' }; // pragma: allowlist secret -- test fixture, not a credential
      expect(() => schema.parse(data)).toThrow();
    });

    it.each([
      ['too short', 'Aa1!aaa'],
      ['no uppercase', 'sofra!2026'],
      ['no lowercase', 'SOFRA!2026'],
      ['no digit', 'SofraSofra!'],
      ['no special character', 'Sofra20261'],
      // Not an Identity option — these come from the server's StrongPasswordValidator, which is
      // exactly the half the first mirror of this policy missed.
      ['three-in-a-row repeat', 'Sofraaa!2026'],
      ['a common password', 'Password123'],
    ])('rejects a password with %s', (_case, password) => {
      const data = { ...validData, password, confirmPassword: password };
      expect(() => schema.parse(data)).toThrow();
    });

    // The message is an i18n KEY, not a sentence — the schemas are module-level so there is no `t`
    // in scope, and a caller printing it raw would show `password_security_rules_error` to a user.
    it('reports the violation as an i18n key', () => {
      const data = { ...validData, password: 'weak', confirmPassword: 'weak' }; // pragma: allowlist secret -- test fixture, not a credential
      const result = schema.safeParse(data);
      expect(result.success).toBe(false);
      const issue = result.success ? undefined : result.error.issues.find((i) => i.path[0] === 'password');
      expect(issue?.message).toBe('password_security_rules_error');
    });
  });
});
