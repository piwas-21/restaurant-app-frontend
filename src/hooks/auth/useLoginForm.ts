'use client';

// Shared login-form logic (S15 T4-adjacent — craft auth surface). Lifts the
// former inline logic out of the login page so BOTH template renderings
// (classic `templates/classic/LoginPage`, craft `templates/craft/LoginPage`)
// consume ONE implementation and differ only in markup/CSS — mirroring how
// `useCartContents` is shared by the classic + craft cart. Behaviour is a
// verbatim lift (role-based routing, resend-verification flow, error/verify
// states); the classic DOM is unchanged.
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { login as loginUser, sendEmailVerification } from '@/services/authService';
import { getErrorMessage } from '@/utils/apiClient';
import { serverMessage, throwServerRefusal } from '@/utils/apiFormErrors';
import { useAuth } from '@/components/AuthContext';
import { trackEvent } from '@/lib/analytics';
import { moduleForPath } from '@/lib/modules';
import { useModules } from '@/contexts/ModulesContext';

const ROLE_ROUTES: Record<string, string> = {
  admin: '/admin/dashboard',
  customer: '/account',
  cashier: '/cashier',
  kitchenstaff: '/kitchen-staff',
  server: '/server',
};

export function useLoginForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resendSucceeded, setResendSucceeded] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const resendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const { login } = useAuth();
  const modules = useModules();

  useEffect(() => {
    emailInputRef.current?.focus();
    return () => {
      if (resendTimeoutRef.current) clearTimeout(resendTimeoutRef.current);
    };
  }, []);

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage('');

    try {
      const response = await sendEmailVerification({ email });
      // `SendEmailVerificationCommandHandler` answers `SuccessWithData` on every branch it reaches
      // — including a mail-send that threw, which it swallows on purpose so the endpoint cannot be
      // used to probe which addresses exist. So a `success: false` here is not a refusal the
      // handler authored; it is the failure envelope `ExceptionHandlingMiddleware` writes when the
      // request never got that far. Rethrowing it puts both that shape and a thrown one through
      // one catch instead of two branches that each invent their own sentence.
      if (!response?.success) throwServerRefusal(response ?? {});
      setResendSucceeded(true);
      setResendMessage(t('verification_email_resent', 'Verification email has been resent! Please check your inbox.'));
    } catch (error) {
      setResendSucceeded(false);
      // `getErrorMessage` is `null` for anything the server did not author, so a dead network
      // reaches the translated sentence rather than putting `Failed to fetch` in the form.
      setResendMessage(getErrorMessage(error) ?? t('resend_failed', 'Failed to resend email. Please try again later.'));
    } finally {
      setResendLoading(false);
      resendTimeoutRef.current = setTimeout(() => setResendMessage(''), 5000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setResendMessage('');

    if (!email || !password) {
      setError(t('email_and_password_required', 'Email and password are required.'));
      return;
    }

    try {
      const response = await loginUser({ email, password });

      if (response.success) {
        trackEvent('login_succeeded', { loggedIn: true });
        login(response.data);
        // Guard the role lookup: a malformed envelope (missing role) falls back
        // to the home route rather than crashing on `.toLowerCase()`.
        const userRole = response.data.role?.toLowerCase() ?? '';
        // A staff role whose surface this tenant did not buy would otherwise land on the
        // blocked page as its FIRST screen after login, with a nav that has nothing left in
        // it (O5). Send them home instead — it is the one combination that produces a
        // genuinely bare screen.
        const target = ROLE_ROUTES[userRole] ?? '/';
        const targetModule = moduleForPath(target);
        router.push(targetModule === null || modules.has(targetModule) ? target : '/');
      } else {
        // `AuthController.Login` returns `Ok(result)` and the handler answers
        // `ApiResponse.Failure(reason, summary)` — so a refused login is a **200** carrying
        // `{success:false}`, and `errors[0]` is where the reason lives while `message` holds the
        // two-word summary. The lockout case is the one that showed: `Failure("Too many failed
        // attempts. This account is temporarily locked. Please try again later.", "Account
        // locked")` rendered as **"Account locked"**, dropping the only sentence that tells the
        // user to wait rather than keep guessing.
        // ALL the reasons, not `[0]`: backend #291 splits a validator failure per rule, and
        // `LoginCommandValidator` can refuse email AND password in one request. The verification
        // check below reads the same string, so joining can only make it match MORE, never less.
        const reason = serverMessage(response);
        // Both slots, unchanged from before this slice — but NOT because either alone is
        // insufficient. The real refusal is `Failure("Please verify your email address before
        // logging in. Check your inbox for the verification link.", "Email verification
        // required")`, whose `errors[0]` carries "verify" AND "verification"; and when `errors` is
        // absent `serverMessage` falls through to `message`, which carries "verification". So
        // `reason` alone matches every shape the backend currently produces. Reading both
        // is kept as the pre-existing behaviour rather than narrowed on the strength of one
        // handler's wording — but it is redundancy, not a requirement, and an earlier version of
        // this comment claimed otherwise.
        const msg = `${response.message ?? ''} ${reason ?? ''}`.toLowerCase();
        const isVerify = msg.includes('verify') || msg.includes('verification');
        if (isVerify) {
          setNeedsVerification(true);
          setError(reason ?? t('email_verification_required', 'Please verify your email address before logging in.'));
        } else {
          setError(reason ?? t('unknown_error', 'An unknown error occurred.'));
        }
        trackEvent('login_failed', { failureReason: isVerify ? 'needs_verification' : 'invalid_credentials' });
      }
    } catch {
      // IGNORED ON PURPOSE — binding would buy nothing here, and the paths were enumerated rather
      // than assumed. `authService.login` is a raw `fetch` that returns the parsed body for EVERY
      // status, so no `ApiError` is ever thrown on this path and `getErrorMessage` returns `null`
      // for every class that lands here, which means the E9 recipe's `?? t(…)` arm is the only one
      // reachable. The classes, in full:
      //
      //   1. `TypeError` from a dead network, `SyntaxError` from `response.json()` on an HTML 502.
      //      Client-authored, and strictly worse to show than the sentence below.
      //   2. A `TypeError` from `response.data.role` when the server answers `success: true` with
      //      no `data`. Mis-diagnosed as network, but unreachable in practice —
      //      `SuccessWithData` always populates `Data`.
      //   3. A `localStorage` refusal, which was REAL and had TWO halves, not one. The write:
      //      Safari private mode throws on `setItem`, so a sign-in the server had already granted
      //      threw on its way out. The read: with site data blocked outright, reading the
      //      `localStorage` PROPERTY throws, and `getSessionId()` is the first line of `login()`
      //      — so the throw beat the request entirely and "Failed to connect to the server" was
      //      reported by a browser that never reached the network. Both are now caught where they
      //      happen (`authService.readStoredValue`/`persistSession`, `AuthContext.login`).
      setError(t('failed_to_connect_server', 'Failed to connect to the server.'));
      trackEvent('login_failed', { failureReason: 'network' });
    }
  };

  return {
    t,
    email,
    setEmail,
    password,
    setPassword,
    error,
    needsVerification,
    resendLoading,
    resendMessage,
    resendSucceeded,
    emailInputRef,
    handleSubmit,
    handleResendVerification,
  };
}
