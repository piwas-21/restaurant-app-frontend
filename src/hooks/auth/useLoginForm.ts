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
import { useAuth } from '@/components/AuthContext';
import { trackEvent } from '@/lib/analytics';

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
      if (response?.success || response?.succeeded) {
        setResendSucceeded(true);
        setResendMessage(
          t('verification_email_resent', 'Verification email has been resent! Please check your inbox.'),
        );
      } else {
        setResendSucceeded(false);
        setResendMessage(t('resend_failed', 'Failed to resend email. Please try again later.'));
      }
    } catch {
      setResendSucceeded(false);
      setResendMessage(t('resend_error', 'An error occurred. Please try again.'));
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
        router.push(ROLE_ROUTES[userRole] ?? '/');
      } else {
        const msg = `${response.message ?? ''} ${response.errors?.[0] ?? ''}`.toLowerCase();
        const isVerify = msg.includes('verify') || msg.includes('verification');
        if (isVerify) {
          setNeedsVerification(true);
          setError(
            response.errors?.[0] ||
              response.message ||
              t('email_verification_required', 'Please verify your email address before logging in.'),
          );
        } else {
          setError(response.message || t('unknown_error', 'An unknown error occurred.'));
        }
        trackEvent('login_failed', { failureReason: isVerify ? 'needs_verification' : 'invalid_credentials' });
      }
    } catch {
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
