'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { adminTaxConfigurationService } from '@/services/adminTaxConfigurationService';
import type { TaxConfiguration } from '@/services/adminTaxConfigurationService';
import { OrderType } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';
import { validateRateInput } from './taxRate';
import { INITIAL_TAX_FORM, type TaxFormData } from './taxForm';

// Re-exported so existing importers keep working; `taxForm.ts` is the definition.
export type { TaxFormData };

// Owns all state + data-access logic for the tax-configuration admin panel;
// the list, form modal and thin orchestrator consume the returned object.
export function useTaxConfigurations() {
  const { enqueueSnackbar } = useSnackbar();
  const { t } = useTranslation();
  const [taxConfigs, setTaxConfigs] = useState<TaxConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TaxConfiguration | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingTaxId, setDeletingTaxId] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState<string>('0');
  const [isRateValid, setIsRateValid] = useState(true);
  const [formData, setFormData] = useState<TaxFormData>(INITIAL_TAX_FORM);

  useEffect(() => {
    // fetchTaxConfigs has its own try/catch (toasts on failure); fire-and-forget
    // mount-only initial fetch (see OrderTypeManager for the same pattern).
    void fetchTaxConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The E9 shape, in one place: the server's own sentence when it authored one, the contextual
  // fallback when it did not. Four callsites had it copied out.
  const reportFailure = (e: unknown, fallback: string) =>
    enqueueSnackbar(getErrorMessage(e) ?? fallback, { variant: 'error' });
  const reportSuccess = (message: string) => enqueueSnackbar(message, { variant: 'success' });

  const fetchTaxConfigs = async () => {
    try {
      setLoading(true);
      const data = await adminTaxConfigurationService.getAllTaxConfigurations();
      setTaxConfigs(data);
    } catch (e) {
      reportFailure(e, t('tax_failed_to_load', 'Failed to load tax configurations'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingConfig(null);
    setRateInput('');
    setIsRateValid(true);
    setFormData(INITIAL_TAX_FORM);
    setIsFormOpen(true);
  };

  const handleEdit = (config: TaxConfiguration) => {
    setEditingConfig(config);
    setRateInput(config.rate.toString());
    setIsRateValid(true);
    setFormData({
      name: config.name,
      rate: config.rate,
      isEnabled: config.isEnabled,
      description: config.description,
      applicableOrderTypes: config.applicableOrderTypes || [],
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingTaxId(id);
    setIsDeleteModalOpen(true);
  };
  const confirmDelete = async () => {
    if (!deletingTaxId) return;
    try {
      await adminTaxConfigurationService.deleteTaxConfiguration(deletingTaxId);
      reportSuccess(t('tax_deleted_successfully', 'Tax configuration deleted successfully'));
      fetchTaxConfigs();
    } catch (e) {
      // The server's reason matters most here — a refused delete usually names what still
      // references the tax, which "Failed to delete tax configuration" cannot.
      reportFailure(e, t('tax_failed_to_delete', 'Failed to delete tax configuration'));
    } finally {
      setIsDeleteModalOpen(false);
      setDeletingTaxId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Mirror the submit button's disabled guard so an Enter keypress in another
    // field can't submit a stale/previous rate while the input is invalid/empty.
    if (!isRateValid || !rateInput) return;
    try {
      if (editingConfig) {
        await adminTaxConfigurationService.updateTaxConfiguration({ ...formData, id: editingConfig.id });
      } else {
        await adminTaxConfigurationService.createTaxConfiguration(formData);
      }
      reportSuccess(
        t(
          editingConfig ? 'tax_updated_successfully' : 'tax_created_successfully',
          `Tax configuration ${editingConfig ? 'updated' : 'created'} successfully`,
        ),
      );
      setIsFormOpen(false);
      fetchTaxConfigs();
    } catch (e) {
      reportFailure(e, t('tax_failed_to_save', 'Failed to save tax configuration'));
    }
  };

  const handleToggle = async (config: TaxConfiguration) => {
    try {
      await adminTaxConfigurationService.updateTaxConfiguration({
        id: config.id,
        name: config.name,
        rate: config.rate,
        isEnabled: !config.isEnabled,
        description: config.description,
        applicableOrderTypes: config.applicableOrderTypes || [],
      });
      reportSuccess(
        t(
          config.isEnabled ? 'tax_disabled_successfully' : 'tax_enabled_successfully',
          `Tax ${!config.isEnabled ? 'enabled' : 'disabled'} successfully`,
        ),
      );
      fetchTaxConfigs();
    } catch (e) {
      reportFailure(e, t('tax_failed_to_toggle', 'Failed to toggle tax configuration'));
    }
  };

  const handleRateChange = (value: string) => {
    setRateInput(value);
    const { valid, rate } = validateRateInput(value);
    setIsRateValid(valid);
    if (rate !== undefined) {
      setFormData({ ...formData, rate });
    }
  };
  const getOrderTypeLabel = (orderType: OrderType): string => {
    switch (orderType) {
      case OrderType.DineIn:
        return t('order_type_dine_in', 'Dine-In');
      case OrderType.Takeaway:
        return t('order_type_takeaway', 'Takeaway');
      case OrderType.Delivery:
        return t('order_type_delivery', 'Delivery');
      default:
        return orderType;
    }
  };
  const closeForm = () => setIsFormOpen(false);
  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setDeletingTaxId(null);
  };

  return {
    taxConfigs,
    loading,
    isFormOpen,
    editingConfig,
    isDeleteModalOpen,
    rateInput,
    isRateValid,
    formData,
    setFormData,
    closeForm,
    closeDeleteModal,
    handleCreate,
    handleEdit,
    handleDelete,
    confirmDelete,
    handleSubmit,
    handleToggle,
    handleRateChange,
    getOrderTypeLabel,
  };
}
