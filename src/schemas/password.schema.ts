import { z } from 'zod';
import { PASSWORD_VIOLATION_KEYS, passwordViolation } from '@/lib/passwordPolicy';

/**
 * A password field the SERVER will actually accept, for every form that CREATES a password.
 *
 * This exists because three schemas each carried their own `z.string().min(6)` while the backend
 * requires ≥8 with lower + upper + digit + non-alphanumeric (`Program.cs:161-165`, restated in
 * `Register{Staff,Customer}CommandValidator.cs`). A form that accepts `secret1` and a server that
 * refuses it is not a validation gap — it is a guaranteed round-trip failure on every weak password,
 * and the failure arrives as a 400 the caller then has to decode.
 *
 * The rules themselves are NOT restated here. `@/lib/passwordPolicy` is the single mirror of the
 * server's policy (it also covers `StrongPasswordValidator`'s repeat and common-password rules,
 * which Identity's own options do not expose); this file is only the zod wiring over it.
 *
 * **The message is an i18n KEY, not a sentence** — these schemas are module-level constants, so
 * there is no `t` in scope. Render with `t(issue.message)`, the convention `customerInfo.schema.ts`
 * already documents. `useResetPasswordForm` translates inside its schema instead, because it builds
 * the schema inside the hook; both end up calling `t` on the same `PASSWORD_VIOLATION_KEYS` value.
 *
 * Deliberately NOT used by `loginSchema`. Sign-in must accept whatever the account already has —
 * mirroring creation policy onto login would lock out any user whose password predates the rule,
 * and the server is the only thing entitled to reject a login anyway.
 */
export const serverPasswordSchema = z.string().superRefine((value, ctx) => {
  const violation = passwordViolation(value);
  if (violation) {
    ctx.addIssue({ code: 'custom', message: PASSWORD_VIOLATION_KEYS[violation] });
  }
});

/**
 * The confirmation field. Only presence is checked here — equality is a cross-field rule and belongs
 * on the object, so running the full policy twice would report the same violation on both fields.
 */
export const confirmPasswordSchema = z.string().min(1, 'field_required');
