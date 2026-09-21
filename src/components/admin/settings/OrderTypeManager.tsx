'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { Store, Truck, Utensils } from 'lucide-react';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import FormField from '@/components/design-system/FormField';
import {
  MAX_REVIEW_WINDOW_MINUTES,
  MIN_REVIEW_WINDOW_MINUTES,
  type OrderTypeConfigurationDto,
} from '@/services/orderTypeConfigurationService';
import { OrderType } from '@/types/order';
import { confirmationFlowOf, reviewWindowOf, useOrderTypeManager } from '@/hooks/admin/useOrderTypeManager';
import styles from './OrderTypeManager.module.css';
import flowStyles from './OrderTypeConfirmationSettings.module.css';

const confirmationFlowSchema = z.enum(['direct', 'acknowledge']);
const reviewWindowSchema = z.coerce.number().int().min(MIN_REVIEW_WINDOW_MINUTES).max(MAX_REVIEW_WINDOW_MINUTES);

export default function OrderTypeManager() {
  const { t } = useTranslation();
  const { configurations, loading, saving, updateEnabled, updateConfirmationFlow, updateReviewWindow } =
    useOrderTypeManager();
  const [pendingOrderType, setPendingOrderType] = useState<OrderType | null>(null);
  const [reviewWindowDrafts, setReviewWindowDrafts] = useState<Partial<Record<OrderType, string>>>({});
  const [reviewWindowErrors, setReviewWindowErrors] = useState<Partial<Record<OrderType, string>>>({});
  const handleToggle = async (orderType: OrderType, currentlyEnabled: boolean) => {
    if (currentlyEnabled) {
      setPendingOrderType(orderType);
      return;
    }
    await updateEnabled(orderType, true);
  };

  const handleConfirmDisable = async () => {
    if (!pendingOrderType) return;
    const orderType = pendingOrderType;
    setPendingOrderType(null);
    await updateEnabled(orderType, false);
  };

  const clearReviewWindowDraft = (orderType: OrderType) => {
    setReviewWindowDrafts((current) => {
      const next = { ...current };
      delete next[orderType];
      return next;
    });
  };

  const handleReviewWindowBlur = async (configuration: OrderTypeConfigurationDto) => {
    const draft = reviewWindowDrafts[configuration.orderType];
    if (draft === undefined) return;

    const parsed = reviewWindowSchema.safeParse(draft);
    if (!parsed.success) {
      setReviewWindowErrors((current) => ({
        ...current,
        [configuration.orderType]: t(
          'admin.order_type.review_window_error',
          'Enter a whole number from {{min}} to {{max}} minutes.',
          { min: MIN_REVIEW_WINDOW_MINUTES, max: MAX_REVIEW_WINDOW_MINUTES },
        ),
      }));
      return;
    }

    setReviewWindowErrors((current) => ({ ...current, [configuration.orderType]: undefined }));
    if (parsed.data !== reviewWindowOf(configuration)) {
      await updateReviewWindow(configuration.orderType, parsed.data);
    }
    clearReviewWindowDraft(configuration.orderType);
  };

  const handleFlowChange = (configuration: OrderTypeConfigurationDto, value: string) => {
    const parsed = confirmationFlowSchema.safeParse(value);
    if (parsed.success) void updateConfirmationFlow(configuration.orderType, parsed.data);
  };

  const getOrderTypeName = (orderType: OrderType): string => {
    switch (orderType) {
      case OrderType.DineIn:
        return t('order_type_dine_in', 'Dine In');
      case OrderType.Takeaway:
        return t('order_type_takeaway', 'Takeaway');
      case OrderType.Delivery:
        return t('order_type_delivery', 'Delivery');
    }
  };

  const getOrderTypeIcon = (orderType: OrderType) => {
    switch (orderType) {
      case OrderType.DineIn:
        return <Utensils size={28} />;
      case OrderType.Takeaway:
        return <Store size={28} />;
      case OrderType.Delivery:
        return <Truck size={28} />;
    }
  };

  const getOrderTypeDescription = (orderType: OrderType): string => {
    switch (orderType) {
      case OrderType.DineIn:
        return t('order_type_dine_in_desc', 'Enjoy your meal at our restaurant');
      case OrderType.Takeaway:
        return t('order_type_takeaway_desc', 'Pick up your order');
      case OrderType.Delivery:
        return t('order_type_delivery_desc', 'We deliver to your address');
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <p>{t('common.loading', 'Loading...')}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.configurationsGrid}>
        {configurations.map((configuration) => {
          const titleId = `order-type-${configuration.orderType}`;
          const flow = confirmationFlowOf(configuration);
          const supportsConfirmationFlow = configuration.orderType !== OrderType.DineIn;
          const reviewWindow = reviewWindowDrafts[configuration.orderType] ?? String(reviewWindowOf(configuration));

          return (
            <div
              key={configuration.orderType}
              className={`${styles.configCard} ${configuration.isEnabled ? styles.enabled : styles.disabled}`}
            >
              <div className={styles.cardHeader}>
                <div className={styles.iconWrapper}>{getOrderTypeIcon(configuration.orderType)}</div>
                <div className={styles.cardInfo}>
                  <h3 id={titleId} className={styles.cardTitle}>
                    {getOrderTypeName(configuration.orderType)}
                  </h3>
                  <p className={styles.cardDescription}>{getOrderTypeDescription(configuration.orderType)}</p>
                </div>
              </div>

              {supportsConfirmationFlow && (
                <div className={flowStyles.settings}>
                  <FormField
                    label={`${getOrderTypeName(configuration.orderType)} ${t(
                      'admin.order_type.confirmation_flow',
                      'Confirmation flow',
                    )}`}
                    className={flowStyles.field}
                  >
                    <select
                      className={flowStyles.select}
                      value={flow}
                      disabled={saving}
                      onChange={(event) => handleFlowChange(configuration, event.target.value)}
                    >
                      <option value="direct">{t('admin.order_type.flow_direct', 'Confirm directly')}</option>
                      <option value="acknowledge">
                        {t('admin.order_type.flow_acknowledge', 'Review before accepting')}
                      </option>
                    </select>
                  </FormField>
                  <p className={flowStyles.hint}>
                    {t(
                      flow === 'acknowledge'
                        ? 'admin.order_type.flow_acknowledge_help'
                        : 'admin.order_type.flow_direct_help',
                    )}
                  </p>

                  {flow === 'acknowledge' && (
                    <FormField
                      label={`${getOrderTypeName(configuration.orderType)} ${t(
                        'admin.order_type.review_window_minutes',
                        'Review target (minutes)',
                      )}`}
                      error={reviewWindowErrors[configuration.orderType]}
                      className={flowStyles.field}
                    >
                      <input
                        className={flowStyles.numberInput}
                        type="number"
                        inputMode="numeric"
                        min={MIN_REVIEW_WINDOW_MINUTES}
                        max={MAX_REVIEW_WINDOW_MINUTES}
                        step={1}
                        value={reviewWindow}
                        disabled={saving}
                        onChange={(event) => {
                          setReviewWindowDrafts((current) => ({
                            ...current,
                            [configuration.orderType]: event.target.value,
                          }));
                          setReviewWindowErrors((current) => ({
                            ...current,
                            [configuration.orderType]: undefined,
                          }));
                        }}
                        onBlur={() => void handleReviewWindowBlur(configuration)}
                      />
                    </FormField>
                  )}
                </div>
              )}

              <div className={styles.cardActions}>
                <div
                  className={`${styles.statusBadge} ${
                    configuration.isEnabled ? styles.statusEnabled : styles.statusDisabled
                  }`}
                >
                  {configuration.isEnabled ? t('order_type_enabled', 'Enabled') : t('order_type_disabled', 'Disabled')}
                </div>
                <label className={styles.toggleSwitch}>
                  <input
                    type="checkbox"
                    aria-label={getOrderTypeName(configuration.orderType)}
                    checked={configuration.isEnabled}
                    onChange={() => void handleToggle(configuration.orderType, configuration.isEnabled)}
                    disabled={saving}
                  />
                  <span className={styles.toggleSlider}></span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmationModal
        isOpen={pendingOrderType !== null}
        onClose={() => setPendingOrderType(null)}
        onConfirm={() => void handleConfirmDisable()}
        message={
          pendingOrderType
            ? t(
                'confirm_disable_order_type',
                'Are you sure you want to disable {{orderType}}? Customers will not be able to select this option.',
                { orderType: getOrderTypeName(pendingOrderType) },
              )
            : ''
        }
      />
    </div>
  );
}
