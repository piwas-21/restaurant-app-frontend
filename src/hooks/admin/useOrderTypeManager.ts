import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { enqueueSnackbar } from 'notistack';
import {
  DEFAULT_REVIEW_WINDOW_MINUTES,
  MAX_REVIEW_WINDOW_MINUTES,
  MIN_REVIEW_WINDOW_MINUTES,
  orderTypeConfigurationService,
  type ConfirmationFlow,
  type OrderTypeConfigurationDto,
} from '@/services/orderTypeConfigurationService';
import { OrderType } from '@/types/order';
import { getErrorMessage } from '@/utils/apiClient';

interface ConfirmationSettingsUpdate {
  confirmationFlow?: ConfirmationFlow;
  reviewWindowMinutes?: number;
}

export function confirmationFlowOf(configuration: OrderTypeConfigurationDto): ConfirmationFlow {
  return configuration.confirmationFlow === 'acknowledge' ? 'acknowledge' : 'direct';
}

export function reviewWindowOf(configuration: OrderTypeConfigurationDto): number {
  const value = configuration.reviewWindowMinutes;
  return typeof value === 'number' && isValidReviewWindow(value) ? value : DEFAULT_REVIEW_WINDOW_MINUTES;
}

export function isValidReviewWindow(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_REVIEW_WINDOW_MINUTES && value <= MAX_REVIEW_WINDOW_MINUTES;
}

export function useOrderTypeManager() {
  const { t } = useTranslation();
  const [configurations, setConfigurations] = useState<OrderTypeConfigurationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchConfigurations = async () => {
      try {
        setLoading(true);
        const rows = await orderTypeConfigurationService.getAll();
        if (!cancelled) setConfigurations(rows);
      } catch (error) {
        if (!cancelled) {
          enqueueSnackbar(
            getErrorMessage(error) ?? t('failed_to_load_configurations', 'Failed to load order type configurations'),
            { variant: 'error' },
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchConfigurations();
    return () => {
      cancelled = true;
    };
    // Mount-only load. `t` can change identity when i18next renders; re-fetching on that change
    // would overwrite an in-flight admin edit with the older server response.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (
    configuration: OrderTypeConfigurationDto,
    isEnabled: boolean,
    settings: ConfirmationSettingsUpdate = {},
  ): Promise<boolean> => {
    try {
      setSaving(true);
      const updated = await orderTypeConfigurationService.update({
        orderType: configuration.orderType,
        isEnabled,
        ...settings,
      });

      setConfigurations((current) =>
        current.map((item) =>
          item.orderType === configuration.orderType ? { ...item, ...settings, ...updated } : item,
        ),
      );
      enqueueSnackbar(t('order_type_updated_successfully', 'Order type updated successfully'), {
        variant: 'success',
      });
      return true;
    } catch (error) {
      enqueueSnackbar(getErrorMessage(error) ?? t('failed_to_update_order_type', 'Failed to update order type'), {
        variant: 'error',
      });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateEnabled = async (orderType: OrderType, isEnabled: boolean): Promise<boolean> => {
    const configuration = configurations.find((item) => item.orderType === orderType);
    return configuration ? persist(configuration, isEnabled) : false;
  };

  const updateConfirmationFlow = async (orderType: OrderType, confirmationFlow: ConfirmationFlow) => {
    const configuration = configurations.find((item) => item.orderType === orderType);
    if (!configuration) return false;

    const settings: ConfirmationSettingsUpdate = { confirmationFlow };
    if (confirmationFlow === 'acknowledge') {
      settings.reviewWindowMinutes = reviewWindowOf(configuration);
    }
    return persist(configuration, configuration.isEnabled, settings);
  };

  const updateReviewWindow = async (orderType: OrderType, reviewWindowMinutes: number) => {
    const configuration = configurations.find((item) => item.orderType === orderType);
    if (!configuration || !isValidReviewWindow(reviewWindowMinutes)) return false;
    return persist(configuration, configuration.isEnabled, { reviewWindowMinutes });
  };

  return {
    configurations,
    loading,
    saving,
    updateEnabled,
    updateConfirmationFlow,
    updateReviewWindow,
  };
}
