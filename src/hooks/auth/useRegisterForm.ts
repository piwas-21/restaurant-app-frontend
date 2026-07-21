'use client';

// Shared register-form logic (craft auth surface). Lifted verbatim from the
// former inline register page so the classic + craft `RegisterPage`
// renderings share ONE implementation (Zod validation, translated field
// errors, backend register, email-verification success + resend). Classic
// DOM is unchanged; only markup/CSS differ between templates.
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { customerRegistrationSchema } from '@/schemas/auth.schema';
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

  const getTranslatedError = (message: string): string => {
    if (message.includes('Invalid') || message.includes('email')) {
      return t('validation_invalid_email', 'Invalid email address');
    }
    if (message.includes('at least 6')) {
      return t('validation_min_6_chars', 'Must be at least 6 characters');
    }
    if (message.includes('at least 2')) {
      return t('validation_min_2_chars', 'Must be at least 2 characters');
    }
    if (message.includes('do not match') || message.includes('Passwords')) {
      return t('validation_passwords_match', 'Passwords do not match');
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
        const apiErrors = Array.isArray(response?.errors) ? response.errors.join(', ') : '';
        setGeneralError(apiErrors || response?.message || t('failed_to_register', 'Failed to register.'));
      }
    } catch {
      setGeneralError(t('unexpected_error', 'An unexpected error occurred.'));
    }
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
