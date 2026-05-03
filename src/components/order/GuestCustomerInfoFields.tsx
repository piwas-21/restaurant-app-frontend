'use client';

import React, { useId } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type { ZodType } from 'zod';
import FormField from '@/components/design-system/FormField';
import { customerInfoSchema } from '@/schemas/customerInfo.schema';
import styles from './GuestCustomerInfoFields.module.css';

export type CustomerInfoField = 'name' | 'email' | 'phone';

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

interface GuestCustomerInfoFieldsProps {
  /** Current field values. */
  value: GuestCustomerInfoValue;
  /** Replace one field's value (errors are not cleared here — parent owns blur). */
  onChange: (field: CustomerInfoField, next: string) => void;
  /** Validate one field on blur. Parent decides what to surface. */
  onBlur: (field: CustomerInfoField) => void;
  /** Per-field error strings (already translated). Empty string == valid. */
  errors: GuestCustomerInfoErrors;
  /**
   * Fields that must be visible + editable. Anything not in this list is
   * hidden — used for logged-in users who only need to fill the missing
   * piece (e.g. just `phone`).
   */
  visibleFields: ReadonlyArray<CustomerInfoField>;
  /**
   * If true, the "Don't have an account?" CTA renders below the inputs.
   * False for logged-in users (they already have an account).
   */
  showRegisterCta: boolean;
  /** Disable all inputs (e.g. while a parent is saving). */
  disabled?: boolean;
}

/**
 * Reusable customer-info inputs for the order-type modals
 * (BUGS-IMPROVEMENTS-PLAN §C1.5.e). Used inside TableSelectionModal,
 * DeliveryAddressModal, and TakeawayInfoModal.
 *
 * Validation is owned by the parent: this component only emits change
 * and blur events. The parent calls `validateGuestCustomerInfoField()`
 * (exported below) to keep error keys consistent across all three modals
 * and matching the existing `customerInfoSchema` used by /checkout/customer-info.
 */
export default function GuestCustomerInfoFields({
  value,
  onChange,
  onBlur,
  errors,
  visibleFields,
  showRegisterCta,
  disabled,
}: GuestCustomerInfoFieldsProps) {
  const { t } = useTranslation();
  const reactId = useId();
  const nameId = `${reactId}-name`;
  const emailId = `${reactId}-email`;
  const phoneId = `${reactId}-phone`;

  if (visibleFields.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby={`${reactId}-heading`}>
      <h3 id={`${reactId}-heading`} className={styles.heading}>
        {t('tell_us_how_to_reach_you', 'Tell us how to reach you')}
      </h3>

      {visibleFields.includes('name') && (
        <FormField label={t('full_name', 'Full Name')} error={errors.name} htmlFor={nameId}>
          <input
            id={nameId}
            type="text"
            value={value.name}
            onChange={(e) => onChange('name', e.target.value)}
            onBlur={() => onBlur('name')}
            disabled={disabled}
            autoComplete="name"
            className={styles.input}
            required
          />
        </FormField>
      )}

      {visibleFields.includes('email') && (
        <FormField label={t('email', 'Email')} error={errors.email} htmlFor={emailId}>
          <input
            id={emailId}
            type="email"
            value={value.email}
            onChange={(e) => onChange('email', e.target.value)}
            onBlur={() => onBlur('email')}
            disabled={disabled}
            autoComplete="email"
            className={styles.input}
            required
          />
        </FormField>
      )}

      {visibleFields.includes('phone') && (
        <FormField label={t('phone', 'Phone')} error={errors.phone} htmlFor={phoneId}>
          <input
            id={phoneId}
            type="tel"
            value={value.phone}
            onChange={(e) => onChange('phone', e.target.value)}
            onBlur={() => onBlur('phone')}
            disabled={disabled}
            autoComplete="tel"
            className={styles.input}
          />
        </FormField>
      )}

      {showRegisterCta && (
        <p className={styles.registerCta}>
          {t('no_account_yet', "Don't have an account yet?")}{' '}
          <Link href="/auth/register" className={styles.registerLink}>
            {t('register_link_text', 'Register')}
          </Link>
        </p>
      )}
    </section>
  );
}

/**
 * Validate a single customer-info field against the shared Zod schema
 * and return a translated error string ('' == valid). Exported so
 * parent modals can blur-validate without duplicating the resolver.
 *
 * `phoneRequired` lets Takeaway/Delivery callers reject empty phone
 * even though the underlying schema treats it as optional (it is, per
 * the customer-info page's pre-existing UX). DineIn does not pass it.
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
