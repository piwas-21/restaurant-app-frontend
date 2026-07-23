'use client';

import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ZodType } from 'zod';
import FormField from '@/components/design-system/FormField';
import { customerInfoSchema, registerFieldsSchema } from '@/schemas/customerInfo.schema';
import RegisterAccountBlock from './RegisterAccountBlock';
import styles from './GuestCustomerInfoFields.module.css';

export type CustomerInfoField = 'name' | 'email' | 'phone';
export type RegisterField = 'password' | 'confirmPassword';

export interface GuestCustomerInfoValue {
  name: string;
  email: string;
  phone: string;
}

export interface GuestCustomerInfoErrors {
  name: string;
  email: string;
  phone: string;
}

export interface RegisterFieldsValue {
  password: string;
  confirmPassword: string;
}

export interface RegisterFieldsErrors {
  password: string;
  confirmPassword: string;
}

interface GuestCustomerInfoFieldsProps {
  /** Current contact-field values. */
  value: GuestCustomerInfoValue;
  onChange: (field: CustomerInfoField, next: string) => void;
  onBlur: (field: CustomerInfoField) => void;
  errors: GuestCustomerInfoErrors;
  /** Contact fields to render (merged shown set minus profile-prefilled). */
  visibleFields: ReadonlyArray<CustomerInfoField>;
  /**
   * Effective-required fields (config-required OR order-type floor —
   * see `mergeContactFieldRules`). Drives the `*` marker + HTML
   * `required`; a visible field absent here renders as optional.
   */
  requiredFields: ReadonlyArray<CustomerInfoField>;
  /**
   * If true, the benefits block + opt-in registration checkbox render
   * below the contact fields. Hidden for logged-in users (they already
   * have an account).
   */
  showRegisterCta: boolean;
  /** Disable all inputs (parent is saving). */
  disabled?: boolean;

  /** Inline-registration state — owned by the parent hook. */
  wantsRegister: boolean;
  setWantsRegister: (next: boolean) => void;
  registerValue: RegisterFieldsValue;
  registerErrors: RegisterFieldsErrors;
  onRegisterChange: (field: RegisterField, next: string) => void;
  onRegisterBlur: (field: RegisterField) => void;
}

/**
 * Reusable contact-info inputs + opt-in registration block for the
 * order-type modals (BUGS-IMPROVEMENTS-PLAN §C1.5.e + §C1.5.g).
 *
 * Validation is owned by the parent (`useGuestCustomerInfo`); this
 * component only emits change/blur events. Required indicators (*)
 * follow the effective-required set (admin config merged with the
 * order-type floor) — a config-visible optional field (e.g. phone on
 * Dine-In) renders without the marker and without HTML `required`.
 */
export default function GuestCustomerInfoFields({
  value,
  onChange,
  onBlur,
  errors,
  visibleFields,
  requiredFields,
  showRegisterCta,
  disabled,
  wantsRegister,
  setWantsRegister,
  registerValue,
  registerErrors,
  onRegisterChange,
  onRegisterBlur,
}: GuestCustomerInfoFieldsProps) {
  const { t } = useTranslation();
  const reactId = useId();
  const nameId = `${reactId}-name`;
  const emailId = `${reactId}-email`;
  const phoneId = `${reactId}-phone`;
  const isRequired = (field: CustomerInfoField) => requiredFields.includes(field);
  const mark = (field: CustomerInfoField) => (isRequired(field) ? ' *' : '');

  if (visibleFields.length === 0 && !showRegisterCta) return null;

  return (
    <section className={styles.section} aria-labelledby={`${reactId}-heading`}>
      {visibleFields.length > 0 && (
        <>
          <h3 id={`${reactId}-heading`} className={styles.heading}>
            {t('tell_us_how_to_reach_you', 'Tell us how to reach you')}
          </h3>

          {visibleFields.includes('name') && (
            <FormField label={`${t('full_name', 'Full Name')}${mark('name')}`} error={errors.name} htmlFor={nameId}>
              <input
                id={nameId}
                type="text"
                value={value.name}
                onChange={(e) => onChange('name', e.target.value)}
                onBlur={() => onBlur('name')}
                disabled={disabled}
                autoComplete="name"
                className={styles.input}
                required={isRequired('name')}
              />
            </FormField>
          )}

          {visibleFields.includes('email') && (
            <FormField label={`${t('email', 'Email')}${mark('email')}`} error={errors.email} htmlFor={emailId}>
              <input
                id={emailId}
                type="email"
                value={value.email}
                onChange={(e) => onChange('email', e.target.value)}
                onBlur={() => onBlur('email')}
                disabled={disabled}
                autoComplete="email"
                className={styles.input}
                required={isRequired('email')}
              />
            </FormField>
          )}

          {visibleFields.includes('phone') && (
            <FormField label={`${t('phone', 'Phone')}${mark('phone')}`} error={errors.phone} htmlFor={phoneId}>
              <input
                id={phoneId}
                type="tel"
                value={value.phone}
                onChange={(e) => onChange('phone', e.target.value)}
                onBlur={() => onBlur('phone')}
                disabled={disabled}
                autoComplete="tel"
                className={styles.input}
                required={isRequired('phone')}
              />
            </FormField>
          )}
        </>
      )}

      {showRegisterCta && (
        <RegisterAccountBlock
          fieldIdPrefix={reactId}
          wantsRegister={wantsRegister}
          setWantsRegister={setWantsRegister}
          value={registerValue}
          errors={registerErrors}
          onChange={onRegisterChange}
          onBlur={onRegisterBlur}
          disabled={disabled}
        />
      )}
    </section>
  );
}

/**
 * Validate a single contact-info field against the shared Zod schema
 * and return a translated error string ('' == valid). Exported so the
 * shared hook can blur-validate without duplicating the resolver.
 *
 * `phoneRequired` rejects empty phone when phone is effectively
 * required (order-type floor — Takeaway/Delivery — OR config-required)
 * even though the underlying schema treats phone as optional.
 */
export function validateGuestCustomerInfoField(
  field: CustomerInfoField,
  raw: string,
  t: TFunction,
  opts?: { phoneRequired?: boolean },
): string {
  const trimmed = raw.trim();
  if (field === 'phone' && opts?.phoneRequired && trimmed === '') {
    return t('phone_required', 'Phone is required');
  }
  const shape: ZodType = customerInfoSchema.shape[field];
  const result = shape.safeParse(raw);
  if (result.success) return '';
  const key = result.error.issues[0]?.message ?? 'invalid';
  return t(key, key);
}

/**
 * Validate one of the two register-only fields. Length / required
 * rules come from the shared `registerFieldsSchema` (Zod, mirrors the
 * customerInfoSchema pattern); the cross-field equality check stays
 * here so we don't re-run an `.refine` on every password keystroke.
 */
export function validateRegisterField(field: RegisterField, value: string, other: string, t: TFunction): string {
  const result = registerFieldsSchema[field].safeParse(value);
  if (!result.success) {
    const key = result.error.issues[0]?.message ?? 'invalid';
    return t(key, key);
  }
  if (field === 'confirmPassword' && value !== other) {
    return t('passwords_do_not_match', 'Passwords do not match.');
  }
  return '';
}
