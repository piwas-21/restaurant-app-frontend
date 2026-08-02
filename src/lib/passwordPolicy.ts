// The tenant backend's password policy, mirrored once.
//
// It lives in its own module because it is mirrored, not owned: the authority is the
// backend, and a drift in either direction is a user-visible bug. Too strict and we refuse
// a password the server would have taken; too loose — the failure this module was created
// for — and we tell the user their password is fine, then hand them a generic
// "Password reset failed" that reads like an expired link, on the account-recovery path,
// where the retry budget is 3 per hour.
//
// The first version of /reset-password mirrored only ASP.NET Identity's own options and
// claimed to "mirror the backend exactly". It did not: `Program.cs` also registers
// `StrongPasswordValidator`, which adds three more live rules. The branch's own happy-path
// test fixture (`Aa1!aaaa`) was in fact rejected by the server, for the repeated `aaaa`.
//
// ── The authority, file by file ────────────────────────────────────────────────────────
// backend `Program.cs:158-166` (Identity options) and
// `Common/Validation/StrongPasswordValidator.cs`:
//
//   ✔ mirrored: length ≥ 8 · lowercase · uppercase · digit · non-alphanumeric
//   ✔ mirrored: ≥ 4 DISTINCT characters          (StrongPasswordValidator, minUniqueChars = 4)
//     — but note this rule is UNREACHABLE, on the server as much as here: requiring one
//       lowercase, one uppercase, one digit and one non-alphanumeric already forces four
//       distinct characters, and those four classes are disjoint. It is kept because it is
//       the server's rule and becomes live the moment minUniqueChars rises above 4 or a
//       class requirement is dropped — not because it can fire today. The test asserts the
//       subsumption rather than pretending to exercise the branch.
//   ✔ mirrored: no character repeated 3+ times   (StrongPasswordValidator, /(.)\1{2,}/)
//   ✔ mirrored: not a well-known password        (StrongPasswordValidator, exact match, case-insensitive)
//   ✘ NOT mirrored, deliberately: `HasSequentialCharacters` is a stub that returns false
//     (see its own comment — "planned check"). Mirroring an inert rule would reject
//     passwords the server accepts, which is the wrong direction to be wrong in. If that
//     stub is ever implemented, mirror it here and add its cases to the test.
//
// The common-password list is the server's, verbatim. It is short and exact-match — not a
// substring check — so `MyPassword123!` is fine and only `password123` itself is not.

/** Verbatim from `StrongPasswordValidator.cs`; the server compares case-insensitively. */
const COMMON_PASSWORDS = new Set([
  // pragma: allowlist secret -- the server's public reject-list, not credentials
  'password',
  '123456',
  '12345678',
  'qwerty',
  'admin',
  'welcome',
  'letmein',
  'trustno1',
  'password123',
  'admin123',
]);

/** Which rule a password breaks. `null` = the server will accept it. */
// The trailing pragma is required ON this line: detect-secrets' keyword heuristic reads
// `Password… = '…'` as an assignment, and the pragma only applies to the flagged line.
export type PasswordViolation = 'basics' | 'distinct' | 'repeated' | 'common'; // pragma: allowlist secret

/**
 * Exported so a form's `minLength` attribute and this module cannot drift. It is only the LENGTH
 * rule — never treat satisfying it as satisfying the policy; call `passwordViolation`.
 */
export const PASSWORD_MIN_LENGTH = 8;

const MIN_LENGTH = PASSWORD_MIN_LENGTH;
const MIN_DISTINCT = 4;
const REPEATED = /(.)\1{2,}/;

/**
 * First violated rule, or null. Order is presentation, not policy: the server reports
 * every violation at once, and showing "at least 8 characters with…" before "too many
 * repeats" is the more useful order for someone typing.
 */
export function passwordViolation(password: string): PasswordViolation | null {
  if (
    password.length < MIN_LENGTH ||
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^a-zA-Z0-9]/.test(password)
  ) {
    return 'basics';
  }
  // Unreachable while all four classes are required — see the header.
  if (new Set(password).size < MIN_DISTINCT) return 'distinct';
  if (REPEATED.test(password)) return 'repeated';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'common';
  return null;
}

/** i18n key for each violation. Kept beside the rules so a new rule cannot ship mute. */
export const PASSWORD_VIOLATION_KEYS: Record<PasswordViolation, string> = {
  basics: 'password_security_rules_error',
  distinct: 'password_rule_distinct_chars',
  repeated: 'password_rule_repeated_chars',
  common: 'password_rule_too_common',
};
