'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { adminFidelityService, UpdateCustomerDiscountDto } from '@/services/adminFidelityService';
import { fetchUsers, UserDto } from '@/services/userService';
import { UserRole } from '@/types/user';
import type { CustomerDiscountRule } from '@/types/fidelity';
import {
  CustomerDiscountFormData,
  validateCustomerDiscountForm,
  buildCustomerDiscountDto,
  parseCustomerDiscountError,
} from '@/utils/customerDiscountForm';

const EMPTY_FORM: CustomerDiscountFormData = {
  userId: '',
  name: '',
  discountType: 'Percentage',
  discountValue: '',
  minOrderAmount: '',
  maxOrderAmount: '',
  hasMaxOrderAmount: false,
  maxUsageCount: '',
  hasMaxUsageCount: false,
  isActive: true,
  validFrom: '',
  validUntil: '',
  hasValidFrom: false,
  hasValidUntil: false,
};

/**
 * State + handlers for CustomerDiscountForm: debounced customer search, the discount form fields,
 * validation, and create/update submit. Pure validate / build-DTO / error-parse logic lives in
 * utils/customerDiscountForm. Extracted from CustomerDiscountForm (Sprint 6); behaviour unchanged.
 */
export function useCustomerDiscountForm(discount: CustomerDiscountRule | null, onSuccess: () => void) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserDto[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [formData, setFormData] = useState<CustomerDiscountFormData>(EMPTY_FORM);

  useEffect(() => {
    if (discount) {
      setFormData({
        userId: discount.userId,
        name: discount.name,
        discountType: discount.discountType,
        discountValue: discount.discountValue.toString(),
        minOrderAmount: discount.minOrderAmount ? discount.minOrderAmount.toString() : '',
        maxOrderAmount: discount.maxOrderAmount ? discount.maxOrderAmount.toString() : '',
        hasMaxOrderAmount: !!discount.maxOrderAmount,
        maxUsageCount: discount.maxUsageCount ? discount.maxUsageCount.toString() : '',
        hasMaxUsageCount: !!discount.maxUsageCount,
        isActive: discount.isActive,
        validFrom: discount.validFrom ? new Date(discount.validFrom).toISOString().slice(0, 16) : '',
        validUntil: discount.validUntil ? new Date(discount.validUntil).toISOString().slice(0, 16) : '',
        hasValidFrom: !!discount.validFrom,
        hasValidUntil: !!discount.validUntil,
      });
      setSelectedUser({
        id: discount.userId,
        email: discount.userEmail || '',
        firstName: '',
        lastName: '',
        fullName: discount.userName || discount.userEmail || `User ${discount.userId}`,
        role: UserRole.Customer,
        isEmailConfirmed: false,
        createdAt: '',
        metadata: {},
        orderLimitAmount: 0,
        discountPercentage: 0,
        isDiscountActive: false,
        isDeleted: false,
      });
    }
  }, [discount]);

  // Clear any pending debounced search on unmount (avoids setState-after-unmount).
  useEffect(() => () => clearTimeout(searchTimeoutRef.current ?? undefined), []);
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);

      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (query.trim().length < 2) {
        setSearchResults([]);
        setShowSearchResults(false);
        return;
      }

      setSearchLoading(true);
      setShowSearchResults(true);

      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const response = (await fetchUsers('', false, query, 1, 10)) as {
            success: boolean;
            data?: { items: UserDto[] };
          };
          if (response.success && response.data?.items) {
            setSearchResults(response.data.items);
          } else {
            setSearchResults([]);
          }
        } catch (error) {
          console.error('Error searching users:', error);
          setSearchResults([]);
          enqueueSnackbar(t('failed_search_users', 'Failed to search users'), { variant: 'error' });
        } finally {
          setSearchLoading(false);
        }
      }, 500); // 500ms debounce
    },
    [enqueueSnackbar, t],
  );

  const handleUserSelect = useCallback((user: UserDto) => {
    setSelectedUser(user);
    setFormData((prev) => ({ ...prev, userId: user.id }));
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  }, []);

  const handleClearUser = useCallback(() => {
    setSelectedUser(null);
    setFormData((prev) => ({ ...prev, userId: '' }));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validateCustomerDiscountForm(formData, t);
    if (validationError) {
      enqueueSnackbar(validationError, { variant: 'warning' });
      return;
    }

    setLoading(true);

    try {
      const dto = buildCustomerDiscountDto(formData);

      if (discount) {
        await adminFidelityService.updateCustomerDiscount(discount.id, dto as UpdateCustomerDiscountDto);
        enqueueSnackbar(t('discount_updated_successfully', 'Discount updated successfully'), { variant: 'success' });
      } else {
        await adminFidelityService.createCustomerDiscount(dto);
        enqueueSnackbar(t('discount_created_successfully', 'Discount created successfully'), { variant: 'success' });
      }

      onSuccess();
    } catch (error) {
      enqueueSnackbar(parseCustomerDiscountError(error, !!discount, formData.userId, t), {
        variant: 'error',
        autoHideDuration: 8000, // Show longer for complex messages
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    formData,
    handleChange,
    handleSubmit,
    // customer search
    searchQuery,
    searchResults,
    searchLoading,
    showSearchResults,
    selectedUser,
    handleSearchChange,
    handleUserSelect,
    handleClearUser,
  };
}
