'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import { OrderType } from '@/types/order';
import type { CashierNewSaleContact } from '@/lib/cashierNewSaleContact';
import { cashierNewSaleContactSchema } from '@/schemas/cashierNewSaleContact.schema';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import styles from './CashierNewSaleDetailsModal.module.css';

interface CashierNewSaleDetailsModalProps {
  readonly isOpen: boolean;
  readonly channel: OrderType | null;
  readonly contact?: CashierNewSaleContact;
  readonly onApply: (contact: CashierNewSaleContact) => void;
  readonly onClose: () => void;
}

type FieldName = 'customerName' | 'customerPhone' | 'addressLine1' | 'city' | 'postalCode' | 'country';

/**
 * Per-channel details for the counter composer (pilot feedback: modeled on the public menu's
 * per-type panels, but every field the channel does not REQUIRE is skippable — a counter
 * cashier usually is not handed a customer email).
 */
export default function CashierNewSaleDetailsModal({
  isOpen,
  channel,
  contact,
  onApply,
  onClose,
}: CashierNewSaleDetailsModalProps) {
  const { t } = useTranslation();
  const { info } = useRestaurantInfo();
  const [values, setValues] = useState({
    customerName: contact?.customerName ?? '',
    customerPhone: contact?.customerPhone ?? '',
    addressLine1: contact?.deliveryAddress?.addressLine1 ?? '',
    addressLine2: contact?.deliveryAddress?.addressLine2 ?? '',
    city: contact?.deliveryAddress?.city ?? '',
    postalCode: contact?.deliveryAddress?.postalCode ?? '',
    country: contact?.deliveryAddress?.country ?? info?.country ?? '',
    deliveryInstructions: contact?.deliveryAddress?.deliveryInstructions ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  useEffect(() => {
    if (!isOpen) return;
    setValues({
      customerName: contact?.customerName ?? '',
      customerPhone: contact?.customerPhone ?? '',
      addressLine1: contact?.deliveryAddress?.addressLine1 ?? '',
      addressLine2: contact?.deliveryAddress?.addressLine2 ?? '',
      city: contact?.deliveryAddress?.city ?? '',
      postalCode: contact?.deliveryAddress?.postalCode ?? '',
      country: contact?.deliveryAddress?.country ?? info?.country ?? '',
      deliveryInstructions: contact?.deliveryAddress?.deliveryInstructions ?? '',
    });
    setFieldErrors({});
    // Re-seed from the stored contact each time the sheet opens; the tenant country fills the
    // otherwise-skippable field once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const set = (field: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const apply = () => {
    const parsed = cashierNewSaleContactSchema(channel).safeParse(values);
    if (!parsed.success) {
      const errors: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === 'string' && !(field in errors)) {
          errors[field as FieldName] = t('cashier.new_sale.details_required');
        }
      }
      setFieldErrors(errors);
      return;
    }
    const v = parsed.data;
    const deliveryOnly = channel === OrderType.Delivery;
    onApply({
      ...(v.customerName.trim() !== '' ? { customerName: v.customerName.trim() } : {}),
      ...(v.customerPhone.trim() !== '' ? { customerPhone: v.customerPhone.trim() } : {}),
      ...(deliveryOnly && v.addressLine1.trim() !== ''
        ? {
            deliveryAddress: {
              addressLine1: v.addressLine1.trim(),
              addressLine2: v.addressLine2.trim() || undefined,
              city: v.city.trim(),
              postalCode: v.postalCode.trim(),
              country: v.country.trim(),
              deliveryInstructions: v.deliveryInstructions.trim() || undefined,
            },
          }
        : {}),
    });
    onClose();
  };

  const delivery = channel === OrderType.Delivery;

  return (
    <BaseModal
      isOpen
      onClose={onClose}
      title={delivery ? t('cashier.new_sale.details_delivery_title') : t('cashier.new_sale.details_title')}
      size="md"
      footer={
        <div className={styles.footer}>
          <button type="button" className={styles.secondaryButton} onClick={onClose}>
            {t('cancel')}
          </button>
          <button type="button" className={styles.applyButton} onClick={apply}>
            {t('cashier.new_sale.details_apply')}
          </button>
        </div>
      }
    >
      <div className={styles.fields}>
        <FormField label={t('cashier.new_sale.details_name')} htmlFor="cashier-contact-name">
          <input id="cashier-contact-name" value={values.customerName} onChange={set('customerName')} />
        </FormField>
        <FormField label={t('cashier.new_sale.details_phone')} htmlFor="cashier-contact-phone">
          <input id="cashier-contact-phone" type="tel" value={values.customerPhone} onChange={set('customerPhone')} />
        </FormField>
        {delivery && (
          <>
            <FormField
              label={t('cashier.new_sale.details_address')}
              htmlFor="cashier-contact-address1"
              error={fieldErrors.addressLine1}
            >
              <input id="cashier-contact-address1" value={values.addressLine1} onChange={set('addressLine1')} />
            </FormField>
            <FormField label={t('cashier.new_sale.details_address2')} htmlFor="cashier-contact-address2">
              <input id="cashier-contact-address2" value={values.addressLine2} onChange={set('addressLine2')} />
            </FormField>
            <div className={styles.postalRow}>
              <FormField
                label={t('cashier.new_sale.details_city')}
                htmlFor="cashier-contact-city"
                error={fieldErrors.city}
              >
                <input id="cashier-contact-city" value={values.city} onChange={set('city')} />
              </FormField>
              <FormField
                label={t('cashier.new_sale.details_postal')}
                htmlFor="cashier-contact-postal"
                error={fieldErrors.postalCode}
              >
                <input id="cashier-contact-postal" value={values.postalCode} onChange={set('postalCode')} />
              </FormField>
              <FormField
                label={t('cashier.new_sale.details_country')}
                htmlFor="cashier-contact-country"
                error={fieldErrors.country}
              >
                <input id="cashier-contact-country" value={values.country} onChange={set('country')} />
              </FormField>
            </div>
            <FormField label={t('cashier.new_sale.details_instructions')} htmlFor="cashier-contact-instructions">
              <textarea
                id="cashier-contact-instructions"
                rows={2}
                value={values.deliveryInstructions}
                onChange={set('deliveryInstructions')}
              />
            </FormField>
          </>
        )}
      </div>
    </BaseModal>
  );
}
