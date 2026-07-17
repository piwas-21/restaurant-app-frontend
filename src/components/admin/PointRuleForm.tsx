'use client';

import { TENANT_CURRENCY } from '@/utils/currency';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminFidelityService, CreatePointRuleDto } from '@/services/adminFidelityService';
import type { PointEarningRule } from '@/types/fidelity';
import { X, Loader2 } from 'lucide-react';
import { useSnackbar } from 'notistack';
import styles from './PointRuleForm.module.css';

interface PointRuleFormProps {
  rule: PointEarningRule | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function PointRuleForm({ rule, onSuccess, onCancel }: PointRuleFormProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    minOrderAmount: '',
    maxOrderAmount: '',
    pointsAwarded: '',
    isActive: true,
    priority: '',
  });

  useEffect(() => {
    if (rule) {
      setFormData({
        name: rule.name,
        minOrderAmount: rule.minOrderAmount.toString(),
        maxOrderAmount: rule.maxOrderAmount?.toString() || '',
        pointsAwarded: rule.pointsAwarded.toString(),
        isActive: rule.isActive,
        priority: rule.priority.toString(),
      });
    }
  }, [rule]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name.trim()) {
      enqueueSnackbar(t('name_required', 'Name is required'), { variant: 'error' });
      return;
    }

    // Parse and validate minOrderAmount
    const minOrderAmount = parseFloat(formData.minOrderAmount);
    if (!formData.minOrderAmount || isNaN(minOrderAmount)) {
      enqueueSnackbar(t('min_order_amount_required', 'Minimum order amount is required'), {
        variant: 'error',
      });
      return;
    }

    if (minOrderAmount < 0) {
      enqueueSnackbar(t('min_amount_invalid', 'Minimum order amount must be >= 0'), {
        variant: 'error',
      });
      return;
    }

    // Parse and validate maxOrderAmount (optional)
    let maxOrderAmount: number | undefined = undefined;
    if (formData.maxOrderAmount) {
      maxOrderAmount = parseFloat(formData.maxOrderAmount);
      if (isNaN(maxOrderAmount)) {
        enqueueSnackbar(t('max_order_amount_must_be_number', 'Maximum order amount must be a valid number'), {
          variant: 'error',
        });
        return;
      }

      if (maxOrderAmount <= minOrderAmount) {
        enqueueSnackbar(t('max_amount_invalid', 'Maximum order amount must be greater than minimum'), {
          variant: 'error',
        });
        return;
      }
    }

    // Parse and validate pointsAwarded
    const pointsAwarded = parseInt(formData.pointsAwarded);
    if (!formData.pointsAwarded || isNaN(pointsAwarded)) {
      enqueueSnackbar(t('points_awarded_required', 'Points awarded is required'), {
        variant: 'error',
      });
      return;
    }

    if (pointsAwarded <= 0) {
      enqueueSnackbar(t('points_invalid', 'Points awarded must be greater than 0'), {
        variant: 'error',
      });
      return;
    }

    // Parse and validate priority
    const priority = parseInt(formData.priority);
    if (!formData.priority || isNaN(priority)) {
      enqueueSnackbar(t('priority_required', 'Priority is required'), {
        variant: 'error',
      });
      return;
    }

    if (priority < 0) {
      enqueueSnackbar(t('min_amount_invalid', 'Priority must be >= 0'), {
        variant: 'error',
      });
      return;
    }

    try {
      setSubmitting(true);

      // Prepare DTO with parsed numbers
      const dto: CreatePointRuleDto = {
        name: formData.name,
        minOrderAmount,
        maxOrderAmount,
        pointsAwarded,
        isActive: formData.isActive,
        priority,
      };

      if (rule) {
        // Update existing rule
        await adminFidelityService.updatePointRule(rule.id, {
          ...dto,
          id: rule.id,
        });
        enqueueSnackbar(t('rule_updated', 'Point rule updated successfully'), {
          variant: 'success',
        });
      } else {
        // Create new rule
        await adminFidelityService.createPointRule(dto);
        enqueueSnackbar(t('rule_created', 'Point rule created successfully'), {
          variant: 'success',
        });
      }

      onSuccess();
    } catch (error: any) {
      // Parse error message for better user feedback
      let errorMessage = t('error_saving_rule', 'Failed to save point rule');

      if (error?.response?.data) {
        const errorData = error.response.data;

        // Check if errors array exists (our API format)
        if (Array.isArray(errorData.errors) && errorData.errors.length > 0) {
          const firstError = errorData.errors[0];

          // Check for overlap error
          if (firstError.toLowerCase().includes('overlap')) {
            // Extract range information, e.g. "Rule overlaps with existing rule. Range: <code> 0 - <code> 11"
            const rangeMatch = firstError.match(/Range:\s*\$?([\d.]+)\s*-\s*\$?([\d.]+|unlimited)/i);

            if (rangeMatch) {
              const minAmount = rangeMatch[1];
              const maxAmount = rangeMatch[2];
              errorMessage = `This rule overlaps with an existing rule covering ${TENANT_CURRENCY} ${minAmount} - ${maxAmount === 'unlimited' ? 'unlimited' : `${TENANT_CURRENCY} ${maxAmount}`}. Please adjust your order amount range to avoid conflicts with existing rules.`;
            } else {
              errorMessage = `This rule overlaps with an existing rule. Please adjust the order amount range to avoid conflicts.`;
            }
          } else {
            // Use the first error message directly
            errorMessage = firstError;
          }
        }
        // Check if errorData is a string
        else if (typeof errorData === 'string') {
          errorMessage = errorData;
        }
        // Check for message property
        else if (errorData.message) {
          errorMessage = errorData.message;
        }
        // Check if errors is an object (validation errors)
        else if (errorData.errors && typeof errorData.errors === 'object') {
          const errorMessages = Object.values(errorData.errors).flat();
          errorMessage = errorMessages.join(', ');
        }
      }
      // Check if error has a message property directly
      else if (error?.message) {
        errorMessage = error.message;
      }

      enqueueSnackbar(errorMessage, {
        variant: 'error',
        autoHideDuration: 8000, // Show longer for complex messages
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {rule ? t('edit_point_rule', 'Edit Point Rule') : t('create_point_rule', 'Create Point Rule')}
          </h2>
          <button onClick={onCancel} className={styles.closeButton} aria-label={t('close', 'Close')}>
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.label}>
              {t('rule_name', 'Rule Name')} *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder={t('rule_name_placeholder', 'e.g., Bronze Tier')}
              className={styles.input}
              required
            />
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="minOrderAmount" className={styles.label}>
                {t('min_order_amount', 'Min Order Amount')} * ({TENANT_CURRENCY})
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="minOrderAmount"
                name="minOrderAmount"
                value={formData.minOrderAmount}
                onChange={handleChange}
                placeholder="0.00"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="maxOrderAmount" className={styles.label}>
                {t('max_order_amount', 'Max Order Amount')} ({TENANT_CURRENCY})
              </label>
              <input
                type="text"
                inputMode="decimal"
                id="maxOrderAmount"
                name="maxOrderAmount"
                value={formData.maxOrderAmount ?? ''}
                onChange={handleChange}
                placeholder={t('unlimited', 'Unlimited')}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="pointsAwarded" className={styles.label}>
                {t('points_awarded', 'Points Awarded')} *
              </label>
              <input
                type="text"
                inputMode="numeric"
                id="pointsAwarded"
                name="pointsAwarded"
                value={formData.pointsAwarded}
                onChange={handleChange}
                placeholder="0"
                className={styles.input}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="priority" className={styles.label}>
                {t('priority', 'Priority')} *
              </label>
              <input
                type="text"
                inputMode="numeric"
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                placeholder="0"
                className={styles.input}
                required
              />
              <small className={styles.helpText}>{t('priority_help', 'Lower numbers have higher priority')}</small>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                className={styles.checkbox}
              />
              {t('active', 'Active')}
            </label>
          </div>

          <div className={styles.formActions}>
            <button type="button" onClick={onCancel} className={styles.cancelButton} disabled={submitting}>
              {t('cancel', 'Cancel')}
            </button>
            <button type="submit" className={styles.submitButton} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={18} className={styles.spinner} />
                  {t('saving', 'Saving...')}
                </>
              ) : (
                t('save', 'Save')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
