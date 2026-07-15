'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus } from 'lucide-react';
import { formatPlainCurrency } from '@/utils/currency';
import BaseModal from '@/components/design-system/BaseModal';
import ProductSheetBody, { type ProductSheetController } from '@/components/menu/customization/ProductSheetBody';
import BundleSheetBody, { type BundleSheetController } from '@/components/menu/customization/BundleSheetBody';
import styles from './ItemCustomizationSheet.module.css';

export type SheetController = ProductSheetController | BundleSheetController;

/**
 * The single customer customization surface (menu-bundles redesign #175, slice 6) — a `BaseModal`
 * sheet that replaces `CustomizationModal`, `ProductDetailsModal` and `MenuCustomizationModal`.
 * One chrome (title, description, sticky quantity + live-priced "Add • CHF X" footer) over a body
 * that varies by `controller.kind`; both controllers price through the same backend-faithful
 * `useLinePrice`, so a product line and a bundle line can never drift apart again.
 */
export default function ItemCustomizationSheet({ controller }: Readonly<{ controller: SheetController }>) {
  const { t } = useTranslation();
  const { isOpen, title, description, quantity, setQuantity, linePrice, isSubmitting, addToCart, close } = controller;

  if (!isOpen) return null;

  const footer = (
    <div className={styles.footer}>
      <div className={styles.quantityStepper} aria-label={t('quantity')}>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => setQuantity(Math.max(1, quantity - 1))}
          disabled={quantity <= 1}
          aria-label={t('decrease_quantity', 'Decrease quantity')}
        >
          <Minus size={16} />
        </button>
        <span className={styles.quantityValue}>{quantity}</span>
        <button
          type="button"
          className={styles.stepperButton}
          onClick={() => setQuantity(quantity + 1)}
          aria-label={t('increase_quantity', 'Increase quantity')}
        >
          <Plus size={16} />
        </button>
      </div>
      <button type="button" className={styles.addButton} onClick={addToCart} disabled={isSubmitting}>
        {t('add_to_order')} • {formatPlainCurrency(linePrice.total)}
      </button>
    </div>
  );

  return (
    <BaseModal isOpen={isOpen} onClose={close} title={title} size="lg" footer={footer}>
      <div className={styles.body}>
        {description && <p className={styles.description}>{description}</p>}
        {controller.kind === 'bundle' ? (
          <BundleSheetBody controller={controller} />
        ) : (
          <ProductSheetBody controller={controller} />
        )}
      </div>
    </BaseModal>
  );
}
