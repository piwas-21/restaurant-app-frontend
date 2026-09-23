'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { useModuleEnabled } from '@/contexts/ModulesContext';
import { lookupStaffCustomers } from '@/services/staffCustomerLookupService';
import {
  customerSelectionFromLookup,
  customerSelectionIsEmpty,
  type StaffCustomerLookup,
  type StaffCustomerSelection,
} from '@/types/staffCustomer';
import styles from './StaffCustomerPicker.module.css';
import { staffCustomerPickerSchema } from './staffCustomerPickerSchema';

interface Props {
  readonly value?: StaffCustomerSelection;
  readonly onChange: (value: StaffCustomerSelection | undefined) => void;
  readonly disabled?: boolean;
  readonly maxPointsToRedeem?: number;
}

export default function StaffCustomerPicker({ value, onChange, disabled = false, maxPointsToRedeem }: Props) {
  const { t } = useTranslation();
  const id = useId();
  const searchId = `staff-customer-search-${id}`;
  const resultsId = `staff-customer-results-${id}`;
  const loyaltyEnabled = useModuleEnabled('loyalty');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<StaffCustomerLookup[]>([]);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState(false);
  const [draft, setDraft] = useState({ customerName: '', customerEmail: '', customerPhone: '', pointsToRedeem: '0' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof typeof draft, string>>>({});
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    const normalized = search.trim();
    if (normalized.length < 2) {
      setResults([]);
      setLoading(false);
      return () => {
        requestRef.current += 1;
      };
    }
    setLoading(true);
    setLookupError(false);
    const timer = window.setTimeout(() => {
      void lookupStaffCustomers(normalized)
        .then((customers) => {
          if (requestRef.current === requestId) setResults(customers);
        })
        .catch(() => {
          if (requestRef.current === requestId) {
            setResults([]);
            setLookupError(true);
          }
        })
        .finally(() => {
          if (requestRef.current === requestId) setLoading(false);
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      requestRef.current += 1;
    };
  }, [search]);

  const update = (patch: StaffCustomerSelection) => {
    const next = { ...value, ...patch };
    onChange(customerSelectionIsEmpty(next) ? undefined : next);
  };
  const select = (customer: StaffCustomerLookup) => {
    setSearch('');
    setResults([]);
    setFieldErrors({});
    onChange(customerSelectionFromLookup(customer));
  };
  const clear = () => {
    setSearch('');
    setResults([]);
    setFieldErrors({});
    setDraft({ customerName: '', customerEmail: '', customerPhone: '', pointsToRedeem: '0' });
    onChange(undefined);
  };
  const balance = Math.max(0, Math.floor(value?.currentPoints ?? 0));
  const maximum = Math.max(0, Math.floor(Math.min(balance, maxPointsToRedeem ?? balance)));
  const points = Math.max(0, Math.min(maximum, value?.pointsToRedeem ?? 0));

  useEffect(() => {
    setDraft({
      customerName: value?.customerName ?? '',
      customerEmail: value?.customerEmail ?? '',
      customerPhone: value?.customerPhone ?? '',
      pointsToRedeem: String(points),
    });
  }, [points, value?.customerEmail, value?.customerName, value?.customerPhone]);

  const updateManualText = (field: 'customerName' | 'customerEmail' | 'customerPhone', raw: string) => {
    setDraft((current) => ({ ...current, [field]: raw }));
    const parsed = staffCustomerPickerSchema(maximum).shape[field].safeParse(raw);
    setFieldErrors((current) => ({ ...current, [field]: parsed.success ? undefined : `${field}_invalid` }));
    if (!parsed.success) return;
    update({
      [field]: parsed.data || undefined,
      customerUserId: undefined,
      currentPoints: undefined,
      pointsToRedeem: undefined,
    });
  };

  const updatePoints = (raw: string) => {
    setDraft((current) => ({ ...current, pointsToRedeem: raw }));
    const parsed = staffCustomerPickerSchema(maximum).shape.pointsToRedeem.safeParse(raw);
    setFieldErrors((current) => ({ ...current, pointsToRedeem: parsed.success ? undefined : 'points_invalid' }));
    if (parsed.success) update({ pointsToRedeem: parsed.data });
  };

  return (
    <fieldset className={styles.picker} disabled={disabled}>
      <legend>{t('staff_customer.title')}</legend>
      <FormField label={t('staff_customer.search_label')} htmlFor={searchId}>
        <input
          id={searchId}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('staff_customer.search_placeholder')}
          autoComplete="off"
        />
      </FormField>
      <p className={styles.hint}>{t('staff_customer.search_hint')}</p>
      {loading && (
        <p className={styles.status} aria-live="polite">
          {t('staff_customer.searching')}
        </p>
      )}
      {lookupError && (
        <p className={styles.error} role="alert">
          {t('staff_customer.lookup_error')}
        </p>
      )}
      {!loading && search.trim().length >= 2 && !lookupError && results.length === 0 && (
        <p className={styles.status} aria-live="polite">
          {t('staff_customer.no_matches')}
        </p>
      )}
      {results.length > 0 && (
        <section id={resultsId} aria-live="polite" aria-label={t('staff_customer.results')}>
          <ul className={styles.results}>
            {results.map((customer) => (
              <li key={customer.id}>
                <button type="button" onClick={() => select(customer)}>
                  <strong>{customer.fullName}</strong>
                  <span>{customer.email || customer.phoneNumber}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className={styles.manual}>
        <FormField
          label={t('staff_customer.name')}
          htmlFor={`staff-customer-name-${id}`}
          error={fieldErrors.customerName ? t('name_too_long') : undefined}
        >
          <input
            id={`staff-customer-name-${id}`}
            value={draft.customerName}
            onChange={(event) => updateManualText('customerName', event.target.value)}
          />
        </FormField>
        <FormField
          label={t('staff_customer.email')}
          htmlFor={`staff-customer-email-${id}`}
          error={fieldErrors.customerEmail ? t('email_invalid') : undefined}
        >
          <input
            id={`staff-customer-email-${id}`}
            type="email"
            value={draft.customerEmail}
            onChange={(event) => updateManualText('customerEmail', event.target.value)}
          />
        </FormField>
        <FormField
          label={t('staff_customer.phone')}
          htmlFor={`staff-customer-phone-${id}`}
          error={fieldErrors.customerPhone ? t('phone_invalid') : undefined}
        >
          <input
            id={`staff-customer-phone-${id}`}
            type="tel"
            value={draft.customerPhone}
            onChange={(event) => updateManualText('customerPhone', event.target.value)}
          />
        </FormField>
      </div>
      {loyaltyEnabled && value?.customerUserId && (
        <div className={styles.selected} aria-live="polite">
          <span>
            {t('staff_customer.selected')}: {value.customerName}
          </span>
          <span>{t('staff_customer.points_balance', { points: balance })}</span>
          <FormField
            label={t('staff_customer.points_to_redeem')}
            htmlFor={`staff-customer-points-${id}`}
            error={fieldErrors.pointsToRedeem ? t('staff_customer.points_invalid', { maximum }) : undefined}
          >
            <input
              id={`staff-customer-points-${id}`}
              type="number"
              min={0}
              max={maximum}
              step={1}
              value={draft.pointsToRedeem}
              onChange={(event) => updatePoints(event.target.value)}
            />
          </FormField>
        </div>
      )}
      {value && !customerSelectionIsEmpty(value) && (
        <button type="button" className={styles.clear} onClick={clear}>
          {t('staff_customer.clear')}
        </button>
      )}
    </fieldset>
  );
}
