'use client';

import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { adminTaxConfigurationService } from '@/services/adminTaxConfigurationService';
import type { TaxConfiguration } from '@/services/adminTaxConfigurationService';
import { OrderType } from '@/types/order';

export interface TaxFormData {
  name: string;
  rate: number;
  isEnabled: boolean;
  description: string;
  applicableOrderTypes: OrderType[];
}

const INITIAL_TAX_FORM: TaxFormData = {
  name: '',
  rate: 0,
  isEnabled: false,
  description: '',
  applicableOrderTypes: [],
};

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

  const fetchTaxConfigs = async () => {
    try {
      setLoading(true);
      const data = await adminTaxConfigurationService.getAllTaxConfigurations();
      setTaxConfigs(data);
    } catch {
      enqueueSnackbar(t('tax_failed_to_load', 'Failed to load tax configurations'), { variant: 'error' });
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
      enqueueSnackbar(t('tax_deleted_successfully', 'Tax configuration deleted successfully'), { variant: 'success' });
      fetchTaxConfigs();
    } catch {
      enqueueSnackbar(t('tax_failed_to_delete', 'Failed to delete tax configuration'), { variant: 'error' });
    } finally {
      setIsDeleteModalOpen(false);
      setDeletingTaxId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingConfig) {
        await adminTaxConfigurationService.updateTaxConfiguration({ ...formData, id: editingConfig.id });
      } else {
        await adminTaxConfigurationService.createTaxConfiguration(formData);
      }
      enqueueSnackbar(
        t(
          editingConfig ? 'tax_updated_successfully' : 'tax_created_successfully',
          `Tax configuration ${editingConfig ? 'updated' : 'created'} successfully`,
        ),
        { variant: 'success' },
      );
      setIsFormOpen(false);
      fetchTaxConfigs();
    } catch {
      enqueueSnackbar(t('tax_failed_to_save', 'Failed to save tax configuration'), { variant: 'error' });
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
      enqueueSnackbar(
        t(
          config.isEnabled ? 'tax_disabled_successfully' : 'tax_enabled_successfully',
          `Tax ${!config.isEnabled ? 'enabled' : 'disabled'} successfully`,
        ),
        { variant: 'success' },
      );
      fetchTaxConfigs();
    } catch {
      enqueueSnackbar(t('tax_failed_to_toggle', 'Failed to toggle tax configuration'), { variant: 'error' });
    }
  };

  const handleRateChange = (value: string) => {
    setRateInput(value);
    if (value === '') {
      setIsRateValid(true);
      setFormData({ ...formData, rate: 0 });
      return;
    }
    const numValue = Number.parseFloat(value);
    if (Number.isNaN(numValue) || numValue < 0 || numValue > 100) {
      setIsRateValid(false);
      return;
    }
    setIsRateValid(true);
    setFormData({ ...formData, rate: numValue });
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
