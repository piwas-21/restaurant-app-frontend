'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { createAddress, type AddressDto } from '@/services/addressService';
import { getErrorMessage } from '@/utils/apiClient';
import { buildDeliveryAddressSchema } from '@/schemas/deliveryAddress.schema';
import { useCustomerFormFields } from '@/hooks/useCustomerFormFields';
import { FORM_KEYS } from '@/types/formFieldConfig';
import { useSavedAddressList } from './useSavedAddressList';

const DEFAULT_COUNTRY = 'Switzerland';

export interface DeliveryAddressInitial {
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  additionalInfo?: string;
}

/**
 * Owns the delivery address form state, the saved-addresses list (only
 * fetched when the caller signals delivery is selected), and the
 * "save-this-address" persistence call. Returns a single object so the
 * page can spread props into the form component. The admin-configured
 * `delivery_address` rules (D3) drive `country`/`additionalInfo`
 * visibility (via `fieldRules`) and requiredness (via the Zod schema);
 * a hidden country keeps its 'Switzerland' default so the payload
 * stays valid. Safe fallback = today's rules.
 */
export function useDeliveryAddress(initial?: DeliveryAddressInitial, deliverySelected = false) {
  const { t } = useTranslation();
  const { rules: fieldRules } = useCustomerFormFields(FORM_KEYS.deliveryAddress);
  const schema = useMemo(() => buildDeliveryAddressSchema(fieldRules), [fieldRules]);

  const [street, setStreet] = useState(initial?.street || '');
  const [city, setCity] = useState(initial?.city || '');
  const [postalCode, setPostalCode] = useState(initial?.postalCode || '');
  const [country, setCountry] = useState(initial?.country || DEFAULT_COUNTRY);
  const [additionalInfo, setAdditionalInfo] = useState(initial?.additionalInfo || '');
  const [addressError, setAddressError] = useState('');

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [saveThisAddress, setSaveThisAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);

  // `listError` is kept SEPARATE from `addressError` on purpose — see `SavedAddressList.listError`.
  const { isLoggedIn, savedAddresses, loadingAddresses, showNewAddressForm, setShowNewAddressForm, listError } =
    useSavedAddressList(deliverySelected);

  const selectSavedAddress = (address: AddressDto) => {
    setSelectedAddressId(address.id);
    setStreet(address.addressLine1);
    setCity(address.city);
    setPostalCode(address.postalCode);
    setCountry(address.country || DEFAULT_COUNTRY);
    setAdditionalInfo(address.deliveryInstructions || '');
    setShowNewAddressForm(false);
  };

  const showAddNewAddress = () => {
    setShowNewAddressForm(true);
    setSelectedAddressId(null);
    setStreet('');
    setCity('');
    setPostalCode('');
    setCountry(DEFAULT_COUNTRY);
    setAdditionalInfo('');
  };

  const validate = (): boolean => {
    const result = schema.safeParse({ street, city, postalCode, country, additionalInfo });
    if (!result.success) {
      // Surface the first issue's i18n key, matching pre-extraction UX
      // (the form shows one error at a time below the fields).
      const key = result.error.issues[0]?.message ?? 'street_required';
      setAddressError(t(key, key));
      return false;
    }
    setAddressError('');
    return true;
  };

  const persistIfRequested = async (): Promise<boolean> => {
    if (!saveThisAddress || !isLoggedIn) return true;
    setSavingAddress(true);
    try {
      await createAddress({
        label: `${city.trim()}, ${postalCode.trim()}`,
        addressLine1: street.trim(),
        city: city.trim(),
        postalCode: postalCode.trim(),
        country: country.trim(),
        deliveryInstructions: additionalInfo.trim(),
      });
      return true;
    } catch (error) {
      // The server's refusal is the useful sentence: a rejected postcode tells the customer what to
      // change, the generic tells them to retry the same thing. Null for a client-side throw.
      setAddressError(
        getErrorMessage(error) ?? t('failed_to_save_address', 'Failed to save address. Please try again.'),
      );
      return false;
    } finally {
      setSavingAddress(false);
    }
  };

  const trimmed = () => ({
    street: street.trim(),
    city: city.trim(),
    postalCode: postalCode.trim(),
    country: country.trim(),
    additionalInfo: additionalInfo.trim(),
  });

  return {
    street,
    city,
    postalCode,
    country,
    additionalInfo,
    /** Admin-configured `delivery_address` rules — the section derives field visibility/markers. */
    fieldRules,
    addressError,
    /** Why the saved-address list is missing — a page-level notice, NOT a per-field error. */
    listError,
    isLoggedIn,
    savedAddresses,
    selectedAddressId,
    showNewAddressForm,
    saveThisAddress,
    loadingAddresses,
    savingAddress,
    setStreet,
    setCity,
    setPostalCode,
    setCountry,
    setAdditionalInfo,
    setAddressError,
    setSaveThisAddress,
    selectSavedAddress,
    showAddNewAddress,
    validate,
    persistIfRequested,
    trimmed,
  };
}
