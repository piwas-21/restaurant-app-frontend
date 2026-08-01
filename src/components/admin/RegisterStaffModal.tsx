import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { staffRegistrationSchema } from '@/schemas/auth.schema';
import styles from '@/app/styles/RegisterStaffModal.module.css';
import { useTranslation } from 'react-i18next';
import { registerStaff } from '@/services/userService';
import { useRoleHelpers } from '@/hooks/useRoleHelpers';
import { STAFF_REGISTRATION_MATCHERS, routeApiError, type RoutedApiError } from '@/utils/apiFormErrors';

type RegisterStaffFormValues = z.infer<typeof staffRegistrationSchema>;
type RegistrationField = (typeof STAFF_REGISTRATION_MATCHERS)[number][0];

interface RegisterStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStaffRegistered: () => void;
}

const RegisterStaffModal: React.FC<RegisterStaffModalProps> = ({ isOpen, onClose, onStaffRegistered }) => {
  const { t } = useTranslation();
  const { getRoleLabel, staffRoles } = useRoleHelpers();
  const modalContentRef = useRef<HTMLDivElement>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<RegisterStaffFormValues>({
    resolver: zodResolver(staffRegistrationSchema),
  });

  /**
   * Put each routed message where the user can act on it; never leave a failure unreported.
   *
   * `||`, never `??`: a blank server message is absence dressed as a value, and
   * `'' ?? fallback` is `''` — which renders an empty `role="alert"` paragraph, i.e. a live region
   * that announces nothing. That is the same class of bug as the one this file was opened to fix.
   */
  const applyErrors = ({ fieldErrors, rootMessage }: RoutedApiError<RegistrationField>) => {
    fieldErrors.forEach(({ field, message }) => setError(field, { message }));
    if (rootMessage || fieldErrors.length === 0) {
      setError('root', { message: rootMessage || t('unexpected_error', 'An unexpected error occurred.') });
    }
  };

  /**
   * The parent mounts this modal unconditionally and toggles `isOpen`, so `useForm` state outlives
   * a close. Without this, reopening after a failure shows the PREVIOUS attempt's error over the
   * previous attempt's values — and since the error paragraph carries `role="alert"`, re-inserting
   * it makes assistive tech announce a stale failure as though it had just happened.
   */
  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const onSubmit = async (data: RegisterStaffFormValues) => {
    try {
      const response = (await registerStaff(data)) as { success: boolean; message?: string; errors?: string[] };
      if (!response.success) {
        // Reachable for handler-level failures, which `UserController` returns as
        // `Ok(ApiResponse.Failure(...))`, i.e. a 200. Identity's own rejections ("Passwords must
        // have at least one non alphanumeric character") arrive here; FluentValidation's arrive as
        // a 400 in the catch below.
        applyErrors(routeApiError(response, STAFF_REGISTRATION_MATCHERS));
        return;
      }
    } catch (error) {
      // This is where the reported "An unexpected error occurred." came from. `apiClient` throws
      // `ApiError` for every non-2xx, and this catch used to be unbound (`} catch {`) — so the 400
      // carrying "Password must contain at least one uppercase letter" was thrown away in full and
      // replaced with a sentence that says nothing.
      applyErrors(routeApiError(error, STAFF_REGISTRATION_MATCHERS));
      return;
    }
    // Success side effects live OUTSIDE the try. Inside it, a throw from any of them would be
    // caught above and reported as a registration failure — on a modal that already closed, for a
    // staff member who WAS created.
    onStaffRegistered();
    onClose();
    reset();
  };

  /**
   * Field messages arrive from two places with two conventions: the schema emits i18n KEYS
   * (`password.schema.ts`), the server emits English prose. Translate the first, pass the second
   * through.
   *
   * The `defaultValue` is not decoration. i18next returns the KEY on a lookup miss, so without it a
   * key present in `en.json` but missing from a locale would print `password_rule_whatever` at the
   * user. The regex also matches a single-lowercase-word SERVER message (`'not_found'`), which is
   * the other way a raw token could reach the screen — passing the original as the default means
   * the worst case is the server's own word rather than a mistranslation of it.
   */
  const fieldMessage = (message?: string) =>
    message && /^[a-z][a-z0-9_]*$/.test(message) ? t(message, { defaultValue: message }) : message;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (modalContentRef.current && !modalContentRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={handleOverlayClick}>
      <div className={styles.modalContent} ref={modalContentRef}>
        <h2>{t('register_staff')}</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          {errors.root && (
            <p className={styles.errorMessage} role="alert">
              {fieldMessage(errors.root.message)}
            </p>
          )}
          <div className={styles.formGroup}>
            <label htmlFor="firstName">{t('first_name')}</label>
            <input id="firstName" {...register('firstName')} />
            {errors.firstName && (
              <p className={styles.errorMessage} role="alert">
                {fieldMessage(errors.firstName.message)}
              </p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="lastName">{t('last_name')}</label>
            <input id="lastName" {...register('lastName')} />
            {errors.lastName && (
              <p className={styles.errorMessage} role="alert">
                {fieldMessage(errors.lastName.message)}
              </p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email">{t('email_label')}</label>
            <input id="email" type="email" {...register('email')} />
            {errors.email && (
              <p className={styles.errorMessage} role="alert">
                {fieldMessage(errors.email.message)}
              </p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="password">{t('password_label')}</label>
            <input id="password" type="password" {...register('password')} />
            {errors.password && (
              <p className={styles.errorMessage} role="alert">
                {fieldMessage(errors.password.message)}
              </p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">{t('confirm_password_label')}</label>
            <input id="confirmPassword" type="password" {...register('confirmPassword')} />
            {errors.confirmPassword && (
              <p className={styles.errorMessage} role="alert">
                {fieldMessage(errors.confirmPassword.message)}
              </p>
            )}
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="role">{t('role')}</label>
            <select id="role" {...register('role')}>
              {staffRoles.map((role) => (
                <option key={role} value={role}>
                  {getRoleLabel(role)}
                </option>
              ))}
            </select>
            {errors.role && (
              <p className={styles.errorMessage} role="alert">
                {fieldMessage(errors.role.message)}
              </p>
            )}
          </div>
          <div className={styles.buttonGroup}>
            <button type="submit" className={styles.submitButton}>
              {t('register')}
            </button>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              {t('cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterStaffModal;
