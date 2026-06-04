'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  type AddressDto,
  type CreateAddressCommand,
  type UpdateAddressCommand,
} from '@/services/addressService';

/**
 * State + handlers for the delivery-address manager: load/create/update/delete addresses, set the
 * default, and drive the add/edit form + delete-confirm modals. The component renders from this
 * hook's return value. Extracted from AddressManagement.tsx (Sprint 4/6 god-file decomposition);
 * behaviour unchanged.
 */
export function useAddressManagement() {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<AddressDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AddressDto | null>(null);
  const [error, setError] = useState<string>('');
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{ show: boolean; addressId: string | null }>({
    show: false,
    addressId: null,
  });

  const loadAddresses = async () => {
    try {
      setLoading(true);
      const data = await getMyAddresses();
      setAddresses(data);
      setError('');
    } catch (err) {
      console.error('Failed to load addresses:', err);
      setError(t('address_load_error', 'Failed to load addresses. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Load addresses
  useEffect(() => {
    // loadAddresses has its own try/catch (sets error state); fire-and-forget.
    void loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddNew = () => {
    setEditingAddress(null);
    setShowAddressForm(true);
  };

  const handleEdit = (address: AddressDto) => {
    setEditingAddress(address);
    setShowAddressForm(true);
  };

  const handleDelete = (addressId: string) => {
    setDeleteConfirmModal({ show: true, addressId });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmModal.addressId) return;

    try {
      await deleteAddress(deleteConfirmModal.addressId);
      await loadAddresses();
      setDeleteConfirmModal({ show: false, addressId: null });
    } catch (err) {
      console.error('Failed to delete address:', err);
      setError(t('address_delete_error', 'Failed to delete address. Please try again.'));
      setDeleteConfirmModal({ show: false, addressId: null });
    }
  };

  const handleSetDefault = async (addressId: string) => {
    try {
      await setDefaultAddress(addressId);
      await loadAddresses();
    } catch (err) {
      console.error('Failed to set default address:', err);
      setError(t('address_set_default_error', 'Failed to set default address. Please try again.'));
    }
  };

  const handleSaveAddress = async (formData: CreateAddressCommand | UpdateAddressCommand) => {
    try {
      if (editingAddress) {
        await updateAddress(editingAddress.id, formData as UpdateAddressCommand);
      } else {
        await createAddress(formData as CreateAddressCommand);
      }
      await loadAddresses();
      setShowAddressForm(false);
      setEditingAddress(null);
      setError('');
    } catch (err) {
      console.error('Failed to save address:', err);
      throw err; // Let the form handle the error
    }
  };

  const closeForm = () => {
    setShowAddressForm(false);
    setEditingAddress(null);
  };

  const closeDeleteModal = () => setDeleteConfirmModal({ show: false, addressId: null });

  return {
    addresses,
    loading,
    error,
    showAddressForm,
    editingAddress,
    deleteConfirmModal,
    handleAddNew,
    handleEdit,
    handleDelete,
    confirmDelete,
    handleSetDefault,
    handleSaveAddress,
    closeForm,
    closeDeleteModal,
  };
}
