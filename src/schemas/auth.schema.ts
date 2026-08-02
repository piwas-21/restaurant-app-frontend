import { z } from 'zod';
import { UserRole } from '@/types/user';
import { confirmPasswordSchema, serverPasswordSchema } from '@/schemas/password.schema';

/**
 * Sign-in keeps a bare length floor and does NOT use `serverPasswordSchema`. The account's password
 * already exists, so the creation policy is not this form's to enforce: applying it would refuse to
 * even attempt a login for anyone whose password predates the rule. Rejecting a credential is the
 * server's job.
 */
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

/**
 * i18n KEYS, not prose. zod's built-in messages are English sentences ("String must contain at
 * least 2 character(s)"), and the staff modal renders field messages straight to screen — so an
 * Arabic or Chinese admin was reading zod's English. Naming the keys here lets the same
 * `t(message)` path that handles the password policy handle these too.
 */
const INVALID_EMAIL = 'validation_invalid_email';
const TOO_SHORT = 'validation_min_2_chars';

export const staffRegistrationSchema = z
  .object({
    email: z.string().email(INVALID_EMAIL),
    // Was `min(6)`, which the backend refuses — see `password.schema.ts`.
    password: serverPasswordSchema,
    confirmPassword: confirmPasswordSchema,
    firstName: z.string().min(2, TOO_SHORT),
    lastName: z.string().min(2, TOO_SHORT),
    role: z.nativeEnum(UserRole),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwords_do_not_match',
    path: ['confirmPassword'],
  });

export const customerRegistrationSchema = z
  .object({
    email: z.string().email(INVALID_EMAIL),
    password: serverPasswordSchema,
    confirmPassword: confirmPasswordSchema,
    firstName: z.string().min(2, TOO_SHORT),
    lastName: z.string().min(2, TOO_SHORT),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'passwords_do_not_match',
    path: ['confirmPassword'], // path of error
  });
