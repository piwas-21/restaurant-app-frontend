'use client';

// Form logic for /reset-password (CLAUDE.md §5 rule 1 — pages orchestrate, hooks decide).
//
// Extracted because the page crossed the 200-LOC gate, but it belongs here for a better
// reason: this is where the mirrored server password policy is applied, and a single owner
// for "what the backend will accept" is what keeps the client from promising something the
// server refuses.

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { PASSWORD_VIOLATION_KEYS, passwordViolation } from '@/lib/passwordPolicy';
import { resetPassword } from '@/services/authService';

export function useResetPasswordForm(email: string, token: string) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState('');

  // The policy is mirrored in ONE place (@/lib/passwordPolicy) because the backend owns it,
  // and there are more rules there than Identity's own options expose.
  const schema = z
    .object({
      newPassword: z.string().superRefine((value, ctx) => {
        const violation = passwordViolation(value);
        if (violation) {
          ctx.addIssue({ code: 'custom', message: t(PASSWORD_VIOLATION_KEYS[violation]) });
        }
      }),
      confirmPassword: z.string().min(1, t('passwords_do_not_match')),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: t('passwords_do_not_match'),
      path: ['confirmPassword'],
    });
  type Values = z.infer<typeof schema>;

  const form = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError('');
    try {
      const res = await resetPassword({
        email,
        token,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      // `success` is the real ApiResponse field (camelCase). An earlier version also read
      // `succeeded`, which the API has never sent.
      if (res?.success) {
        setDone(true);
        return;
      }
      // A LOCAL message for the whole failure class, deliberately — not the server's.
      //
      // `ApiResponse.errors[0]` does carry the specific reason, and surfacing it would be
      // the obvious fix for the untranslated English this used to show. It would also turn
      // this page into an account-enumeration oracle: the backend answers
      // "Invalid reset request" for an unknown or deleted email and Identity's
      // "Invalid token." for a real user with a bad token, so
      // /reset-password?email=<guess>&token=x would distinguish the two with no login
      // attempt and no lockout. `message` is the same wrapper string for both, which is why
      // nothing here reads `errors`.
      //
      // The trade is that an expired link and a rejected password look alike. Mirroring the
      // full policy above is what keeps that from mattering: by the time we POST, the
      // password is one the server accepts, so a failure here really is the link.
      setFormError(t('reset_password_failed'));
    } catch {
      // IGNORED ON PURPOSE, and for a second reason on top of the enumeration one above.
      // `authService.resetPassword` is a raw `fetch` returning the parsed body for every status,
      // so it never throws an `ApiError`: the only things that reach here are `TypeError` from a
      // dead network and `SyntaxError` from `response.json()` on an HTML 502. `getErrorMessage`
      // returns `null` for both by design, so binding the error would add the E9 recipe's shape
      // over a branch that could only ever take its fallback arm — a claim that something is
      // surfaced when nothing is. The paths were checked, not assumed.
      setFormError(t('unexpected_error'));
    }
  });

  return { t, form, onSubmit, done, formError };
}
