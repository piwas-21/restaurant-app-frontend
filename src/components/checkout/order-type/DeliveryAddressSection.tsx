'use client';

import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import type { useDeliveryAddress } from '@/hooks/checkout/useDeliveryAddress';
import styles from '@/app/styles/OrderTypePage.module.css';

const POSTAL_CODE_MAX_LENGTH = 4;

/** The two admin-configurable fields; street/postalCode/city are locked-required. */
type ConfigurableField = 'country' | 'additionalInfo';

interface DeliveryAddressSectionProps {
  address: ReturnType<typeof useDeliveryAddress>;
}

/**
 * Saved-addresses list (logged-in only) + the new-address form, rendered
 * inside `DeliveryAddressModal` (BUGS-IMPROVEMENTS-PLAN §C1.5.b). All
 * state lives in `useDeliveryAddress`; this component is pure JSX +
 * onChange wiring. Inputs are wrapped in `FormField` (CLAUDE.md §5.3).
 * `country`/`additionalInfo` visibility + required markers follow the
 * admin `delivery_address` config (D3); a config-required field can
 * never be hidden.
 */
export default function DeliveryAddressSection({ address }: DeliveryAddressSectionProps) {
  const { t } = useTranslation();
  const a = address;

  const isRequired = (field: ConfigurableField) => a.fieldRules[field]?.isRequired === true;
  const isVisible = (field: ConfigurableField) => a.fieldRules[field]?.isVisible !== false || isRequired(field);

  // The form has a single shared error slot; surface it on whichever
  // required field is currently empty so the highlight aligns.
  const errorOn = (field: 'street' | 'city' | 'postalCode' | ConfigurableField): string | undefined =>
    a.addressError && !a[field].trim() ? a.addressError : undefined;

  // Fields whose FormField renders the shared error inline (locked-required
  // ones always; configurable ones only when config-required).
  const inlineErrorFields: ReadonlyArray<'street' | 'city' | 'postalCode' | ConfigurableField> = [
    'street',
    'postalCode',
    'city',
    ...(['country', 'additionalInfo'] as const).filter(isRequired),
  ];
  const errorShownInline = inlineErrorFields.some((field) => !!errorOn(field));

  return (
    <div className={styles.detailsSection}>
      <h3 className={styles.sectionTitle}>
        <MapPin size={20} />
        {t('delivery_address', 'Delivery Address')}
      </h3>

      {a.isLoggedIn && !a.loadingAddresses && a.savedAddresses.length > 0 && (
        <div className={styles.savedAddressesSection}>
          <h4 className={styles.savedAddressesTitle}>{t('saved_addresses', 'Your Saved Addresses')}</h4>
          <div className={styles.savedAddressesList}>
            {a.savedAddresses.map((saved) => (
              <button
                key={saved.id}
                className={`${styles.savedAddressCard} ${a.selectedAddressId === saved.id ? styles.selected : ''}`}
                onClick={() => a.selectSavedAddress(saved)}
                type="button"
              >
                <div className={styles.addressContent}>
                  <p className={styles.addressLabel}>{saved.label}</p>
                  <p className={styles.addressDetails}>
                    {saved.addressLine1}, {saved.postalCode} {saved.city}
                  </p>
                </div>
              </button>
            ))}
          </div>
          {!a.showNewAddressForm && (
            <button className={styles.addNewAddressBtn} onClick={a.showAddNewAddress} type="button">
              {t('add_new_address', 'Add New Address')}
            </button>
          )}
        </div>
      )}

      {a.showNewAddressForm && (
        <div className={styles.addressForm}>
          <FormField label={`${t('street_address', 'Street Address')} *`} error={errorOn('street')} htmlFor="street">
            <input
              type="text"
              id="street"
              value={a.street}
              onChange={(e) => {
                a.setStreet(e.target.value);
                a.setAddressError('');
              }}
              placeholder={t('enter_street', 'Enter street address')}
              className={`${styles.input} ${errorOn('street') ? styles.inputError : ''}`}
            />
          </FormField>

          <div className={styles.inputRow}>
            <FormField
              label={`${t('postal_code', 'Postal Code')} *`}
              error={errorOn('postalCode')}
              htmlFor="postalCode"
            >
              <input
                type="text"
                id="postalCode"
                value={a.postalCode}
                onChange={(e) => {
                  a.setPostalCode(e.target.value);
                  a.setAddressError('');
                }}
                placeholder={t('enter_postal_code', '1234')}
                className={`${styles.input} ${errorOn('postalCode') ? styles.inputError : ''}`}
                maxLength={POSTAL_CODE_MAX_LENGTH}
              />
            </FormField>

            <FormField label={`${t('city', 'City')} *`} error={errorOn('city')} htmlFor="city">
              <input
                type="text"
                id="city"
                value={a.city}
                onChange={(e) => {
                  a.setCity(e.target.value);
                  a.setAddressError('');
                }}
                placeholder={t('enter_city', 'Enter city')}
                className={`${styles.input} ${errorOn('city') ? styles.inputError : ''}`}
              />
            </FormField>
          </div>

          {isVisible('country') && (
            <FormField
              label={`${t('country', 'Country')}${isRequired('country') ? ' *' : ''}`}
              error={isRequired('country') ? errorOn('country') : undefined}
              htmlFor="country"
            >
              <input
                type="text"
                id="country"
                value={a.country}
                onChange={(e) => {
                  a.setCountry(e.target.value);
                  a.setAddressError('');
                }}
                placeholder={t('enter_country', 'Switzerland')}
                className={`${styles.input} ${isRequired('country') && errorOn('country') ? styles.inputError : ''}`}
                required={isRequired('country')}
              />
            </FormField>
          )}

          {isVisible('additionalInfo') && (
            <FormField
              label={
                isRequired('additionalInfo')
                  ? `${t('additional_info', 'Additional Information')} *`
                  : `${t('additional_info', 'Additional Information')} (${t('optional', 'optional')})`
              }
              error={isRequired('additionalInfo') ? errorOn('additionalInfo') : undefined}
              htmlFor="additionalInfo"
            >
              <textarea
                id="additionalInfo"
                value={a.additionalInfo}
                onChange={(e) => {
                  a.setAdditionalInfo(e.target.value);
                  a.setAddressError('');
                }}
                placeholder={t('additional_info_placeholder', 'Floor, apartment number, building, etc.')}
                className={styles.textarea}
                rows={3}
                required={isRequired('additionalInfo')}
              />
            </FormField>
          )}

          {a.addressError && !errorShownInline && <p className={styles.error}>{a.addressError}</p>}

          {a.isLoggedIn && (
            <div className={styles.checkboxGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={a.saveThisAddress}
                  onChange={(e) => a.setSaveThisAddress(e.target.checked)}
                  className={styles.checkbox}
                />
                <span>{t('save_this_address', 'Save this address for future orders')}</span>
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
