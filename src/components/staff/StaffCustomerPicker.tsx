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
    onChange(customerSelectionFromLookup(customer));
  };
  const clear = () => {
    setSearch('');
    setResults([]);
    onChange(undefined);
  };
  const balance = Math.max(0, Math.floor(value?.currentPoints ?? 0));
  const maximum = Math.max(0, Math.floor(Math.min(balance, maxPointsToRedeem ?? balance)));
  const points = Math.max(0, Math.min(maximum, value?.pointsToRedeem ?? 0));

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
        <div id={resultsId} role="region" aria-live="polite" aria-label={t('staff_customer.results')}>
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
        </div>
      )}
      <div className={styles.manual}>
        <FormField label={t('staff_customer.name')} htmlFor={`staff-customer-name-${id}`}>
          <input
            id={`staff-customer-name-${id}`}
            value={value?.customerName ?? ''}
            onChange={(e) =>
              update({
                customerName: e.target.value,
                customerUserId: undefined,
                currentPoints: undefined,
                pointsToRedeem: undefined,
              })
            }
          />
        </FormField>
        <FormField label={t('staff_customer.email')} htmlFor={`staff-customer-email-${id}`}>
          <input
            id={`staff-customer-email-${id}`}
            type="email"
            value={value?.customerEmail ?? ''}
            onChange={(e) =>
              update({
                customerEmail: e.target.value,
                customerUserId: undefined,
                currentPoints: undefined,
                pointsToRedeem: undefined,
              })
            }
          />
        </FormField>
        <FormField label={t('staff_customer.phone')} htmlFor={`staff-customer-phone-${id}`}>
          <input
            id={`staff-customer-phone-${id}`}
            type="tel"
            value={value?.customerPhone ?? ''}
            onChange={(e) =>
              update({
                customerPhone: e.target.value,
                customerUserId: undefined,
                currentPoints: undefined,
                pointsToRedeem: undefined,
              })
            }
          />
        </FormField>
      </div>
      {loyaltyEnabled && value?.customerUserId && (
        <div className={styles.selected} aria-live="polite">
          <span>
            {t('staff_customer.selected')}: {value.customerName}
          </span>
          <span>{t('staff_customer.points_balance', { points: balance })}</span>
          <FormField label={t('staff_customer.points_to_redeem')} htmlFor={`staff-customer-points-${id}`}>
            <input
              id={`staff-customer-points-${id}`}
              type="number"
              min={0}
              max={maximum}
              step={1}
              value={points}
              onChange={(event) =>
                update({
                  pointsToRedeem: Math.max(0, Math.min(maximum, Math.floor(Number(event.target.value) || 0))),
                })
              }
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
