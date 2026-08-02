'use client';

// Shared register-form logic (craft auth surface). Lifted verbatim from the
// former inline register page so the classic + craft `RegisterPage`
// renderings share ONE implementation (Zod validation, translated field
// errors, backend register, email-verification success + resend). Classic
// DOM is unchanged; only markup/CSS differ between templates.
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { customerRegistrationSchema } from '@/schemas/auth.schema';
import { CUSTOMER_REGISTRATION_MATCHERS, formLevelMessage, routeApiError } from '@/utils/apiFormErrors';
import { registerCustomer, sendEmailVerification } from '@/services/authService';
import { trackEvent } from '@/lib/analytics';

export function useRegisterForm() {
  const { t } = useTranslation();

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [generalError, setGeneralError] = useState('');
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const firstNameInputRef = useRef<HTMLInputElement>(null);
  const resendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    firstNameInputRef.current?.focus();
    return () => {
      if (resendTimeoutRef.current) clearTimeout(resendTimeoutRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fieldName = e.target.id;
    setFormData({ ...formData, [fieldName]: e.target.value });
    // Clear error for this field when user starts typing
    if (errors[fieldName]) {
      setErrors({ ...errors, [fieldName]: '' });
    }
  };

  // An i18n key as zod emits one: lower snake_case, no spaces. The password fields now carry keys
  // (`password.schema.ts`) rather than English sentences, so they are translated directly instead of
  // being substring-matched. The ladder below stays for zod's own built-in messages, which are still
  // English prose — but a key must never fall into it: `field_required` contains neither "Invalid"
  // nor "email", yet `password_security_rules_error` does contain neither and would sail past to be
  // returned raw.
  const isI18nKey = (message: string): boolean => /^[a-z][a-z0-9_]*$/.test(message);

  const getTranslatedError = (message: string): string => {
    if (isI18nKey(message)) {
      // `defaultValue` because i18next returns the KEY on a miss — without it, a key that reaches
      // `en.json` but not the other nine prints a raw snake_case token at the user.
      return t(message, { defaultValue: message });
    }
    if (message.includes('Invalid') || message.includes('email')) {
      return t('validation_invalid_email', 'Invalid email address');
    }
    if (message.includes('at least 2')) {
      return t('validation_min_2_chars', 'Must be at least 2 characters');
    }
    return message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setGeneralError('');

    const validationResult = customerRegistrationSchema.safeParse(formData);
    if (!validationResult.success) {
      const fieldErrors: { [key: string]: string } = {};
      validationResult.error.issues.forEach((issue) => {
        const fieldName = issue.path[0] as string;
        fieldErrors[fieldName] = getTranslatedError(issue.message);
      });
      setErrors(fieldErrors);
      return;
    }

    try {
      const response = await registerCustomer(formData);
      if (response?.success) {
        // Fire on backend-confirmed registration only; the inline-checkout
        // variant fires `register_inline_completed` from useInlineRegistration.
        trackEvent('register_completed', { source: 'register_page', loggedIn: false });
        setRegistrationSuccess(true);
      } else {
        // THE failure branch on this path, not an edge case. `registerCustomer` does NOT go through
        // `apiClient` — `authService.ts` is a raw `fetch` that parses the body and returns it for
        // every status — so a FluentValidation 400 RESOLVES here rather than throwing. Routing it is
        // what actually puts "Password must contain at least one uppercase letter" under the
        // password field instead of joining every message into one blob above the form.
        report(response, t('failed_to_register', 'Failed to register.'));
      }
    } catch (error) {
      // Only two things can reach this catch, precisely because of the above: `TypeError` from a
      // dead network and `SyntaxError` from `response.json()` when the box serves an HTML 502
      // mid-deploy. Neither is the server's prose, so `routeApiError` returns a null root and the
      // translated fallback wins — otherwise a customer reads `Failed to fetch`.
      report(error, t('unexpected_error', 'An unexpected error occurred.'));
    }
  };

  /**
   * Put a failure where the user can act on it. The form-level decision comes from
   * `formLevelMessage`, shared with `useApiError` and `RegisterStaffModal` — the three screens hold
   * their errors in three different places (local state, a hook, react-hook-form's `setError`), and
   * the rule for whether there IS a form-level message must not follow the state around.
   */
  const report = (failure: unknown, fallback: string) => {
    const routed = routeApiError(failure, CUSTOMER_REGISTRATION_MATCHERS);
    if (routed.fieldErrors.length > 0) {
      setErrors(Object.fromEntries(routed.fieldErrors.map(({ field, message }) => [field, message])));
    }
    const rootMessage = formLevelMessage(routed, fallback);
    if (rootMessage) setGeneralError(rootMessage);
  };

  const handleResendEmail = async () => {
    setResendLoading(true);
    setResendMessage('');

    try {
      const response = await sendEmailVerification({ email: formData.email });
      if (response?.success || response?.succeeded) {
        setResendMessage(
          t('verification_email_resent', 'Verification email has been resent! Please check your inbox.'),
        );
      } else {
        setResendMessage(t('resend_failed', 'Failed to resend email. Please try again later.'));
      }
    } catch {
      setResendMessage(t('resend_error', 'An error occurred. Please try again.'));
    } finally {
      setResendLoading(false);
      // Clear message after 5 seconds
      resendTimeoutRef.current = setTimeout(() => setResendMessage(''), 5000);
    }
  };

  return {
    t,
    formData,
    errors,
    generalError,
    registrationSuccess,
    resendLoading,
    resendMessage,
    firstNameInputRef,
    handleChange,
    handleSubmit,
    handleResendEmail,
  };
}
