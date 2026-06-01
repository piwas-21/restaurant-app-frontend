'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AddressDto, CreateAddressCommand, UpdateAddressCommand } from '@/services/addressService';

/**
 * Form state, validation, and submit for the add/edit-address modal. Extracted from the
 * AddressFormModal component in AddressManagement.tsx (Sprint 4/6 god-file decomposition);
 * behaviour unchanged.
 */
export function useAddressForm(
  address: AddressDto | null,
  onSave: (data: CreateAddressCommand | UpdateAddressCommand) => Promise<void>,
) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    label: address?.label || '',
    addressLine1: address?.addressLine1 || '',
    addressLine2: address?.addressLine2 || '',
    city: address?.city || '',
    state: address?.state || '',
    postalCode: address?.postalCode || '',
    country: address?.country || 'Switzerland',
    phone: address?.phone || '',
    deliveryInstructions: address?.deliveryInstructions || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.label.trim()) {
      newErrors.label = t('field_required_error', { fieldName: t('address_label', 'Label') });
    }
    if (!formData.addressLine1.trim()) {
      newErrors.addressLine1 = t('field_required_error', { fieldName: t('address_line1', 'Address Line 1') });
    }
    if (!formData.city.trim()) {
      newErrors.city = t('field_required_error', { fieldName: t('city', 'City') });
    }
    if (!formData.postalCode.trim()) {
      newErrors.postalCode = t('field_required_error', { fieldName: t('postal_code', 'Postal Code') });
    }
    if (!formData.country.trim()) {
      newErrors.country = t('field_required_error', { fieldName: t('country', 'Country') });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      setSaving(true);
      const command = address ? { ...formData, id: address.id } : formData;
      await onSave(command);
    } catch (err) {
      console.error('Failed to save:', err);
      const message = (err as { message?: string })?.message;
      setErrors({ form: message || t('address_save_error', 'Failed to save address. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  return { formData, errors, saving, handleSubmit, handleChange };
}
