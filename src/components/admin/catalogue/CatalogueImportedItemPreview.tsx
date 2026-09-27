'use client';

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import { quoteProduct, type ProductQuoteDto, type ProductQuoteRequest } from '@/services/productQuoteService';
import type { DetailedProduct } from '@/types/menu';
import { OrderType } from '@/types/order';
import { buildProductSteps, stepBlocker } from '@/utils/customizationSteps';
import { buildInitialSheetState } from '@/utils/itemSheetState';
import { isSauce, toSauceGroupRule } from '@/utils/sauceGroup';
import { localizedDescription, localizedName } from '@/utils/localizedContent';
import { formatPlainCurrency } from '@/utils/currency';
import { serverMessage } from '@/utils/apiFormErrors';
import styles from './CatalogueImportGuestReview.module.css';
import CatalogueImportedItemChoices from './CatalogueImportedItemChoices';

interface Props {
  readonly product: DetailedProduct;
  readonly locale: string;
}

const CHANNEL_LABELS: Record<OrderType, string> = {
  [OrderType.DineIn]: 'order_type_dine_in',
  [OrderType.Takeaway]: 'order_type_takeaway',
  [OrderType.Delivery]: 'order_type_delivery',
};

export default function CatalogueImportedItemPreview({ product, locale }: Props) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<OrderType | ''>('');
  const [quote, setQuote] = useState<ProductQuoteDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const initial = useMemo(() => buildInitialSheetState(product), [product]);
  const sauceIds = useMemo(
    () =>
      (product.detailedIngredients ?? [])
        .filter((ingredient) => ingredient.isActive && ingredient.isOptional && isSauce(ingredient))
        .map((ingredient) => ingredient.id),
    [product.detailedIngredients],
  );
  const gate = {
    selectedVariationId: initial.selectedVariationId,
    selectedIngredients: initial.selectedIngredients,
    customizationSelections: initial.customizationSelections,
  };
  const blocked = buildProductSteps(product).some(
    (step) => stepBlocker(step, gate, toSauceGroupRule(product).min, sauceIds) !== null,
  );
  const isOrderable = Boolean(
    product.isActive &&
    product.isAvailable &&
    product.availability?.canOrder &&
    (!channel || product.availability.allowedOrderTypes.includes(channel)),
  );
  const hasPrice = Number.isFinite(product.basePrice) && product.basePrice >= 0;
  const allowedChannels = product.availability?.allowedOrderTypes ?? [];

  const changeChannel = (value: string) => {
    setChannel(value as OrderType | '');
    setQuote(null);
    setError(null);
  };

  const requestQuote = async () => {
    if (!isOrderable || blocked || !hasPrice || pending) return;
    setPending(true);
    setQuote(null);
    setError(null);
    const request: ProductQuoteRequest = {
      quantity: 1,
      selectedIngredients: initial.selectedIngredients,
      ingredientQuantities: initial.ingredientQuantities,
      customizationSelections: initial.customizationSelections,
      selectedSideItems: initial.selectedSideItems,
      ...(initial.selectedVariationId ? { productVariationId: initial.selectedVariationId } : {}),
    };
    try {
      setQuote(await quoteProduct(product.id, request, channel || undefined));
    } catch (reason: unknown) {
      setError(serverMessage(reason) ?? t('bundle_quote_failed'));
    } finally {
      setPending(false);
    }
  };

  return (
    <section className={styles.preview} aria-labelledby="catalogue-import-item-preview-heading">
      <div>
        <h4 id="catalogue-import-item-preview-heading">{t('catalogue_import_guest_product_preview')}</h4>
        <p>{localizedName(product, locale)}</p>
        {localizedDescription(product, locale) && (
          <p className={styles.description}>{localizedDescription(product, locale)}</p>
        )}
      </div>
      <ul className={styles.statusList}>
        <li>
          <StatusBadge tone={product.isActive ? 'success' : 'warning'}>
            {t(product.isActive ? 'active' : 'inactive')}
          </StatusBadge>
        </li>
        <li>
          <StatusBadge tone={product.isAvailable ? 'success' : 'warning'}>
            {t(product.isAvailable ? 'available' : 'unavailable')}
          </StatusBadge>
        </li>
        <li>
          <StatusBadge tone={isOrderable ? 'success' : 'warning'}>
            {t(isOrderable ? 'catalogue_import_guest_orderable' : 'catalogue_import_guest_not_orderable')}
          </StatusBadge>
        </li>
      </ul>
      {hasPrice ? (
        <p className={styles.price}>
          {t('catalogue_import_guest_saved_price')}: {formatPlainCurrency(product.basePrice)}
        </p>
      ) : (
        <p className={styles.error}>{t('catalogue_import_guest_price_missing')}</p>
      )}
      <CatalogueImportedItemChoices product={product} locale={locale} />
      <div className={styles.quote}>
        {allowedChannels.length > 0 && (
          <FormField label={t('bundle_quote_channel')}>
            <select className={styles.select} value={channel} onChange={(event) => changeChannel(event.target.value)}>
              <option value="">{t('bundle_quote_any_channel')}</option>
              {allowedChannels.map((orderType) => (
                <option key={orderType} value={orderType}>
                  {t(CHANNEL_LABELS[orderType])}
                </option>
              ))}
            </select>
          </FormField>
        )}
        {!isOrderable && <p className={styles.quoteNote}>{t('catalogue_import_guest_quote_not_ready')}</p>}
        {isOrderable && blocked && <p className={styles.quoteNote}>{t('bundle_quote_defaults_incomplete')}</p>}
        <button type="button" disabled={!isOrderable || blocked || !hasPrice || pending} onClick={requestQuote}>
          {t(pending ? 'bundle_quote_pending' : 'bundle_quote_request')}
        </button>
        {quote && (
          <div aria-live="polite">
            <p>{t('bundle_quote_result_heading')}</p>
            <p>{t('bundle_quote_total', { amount: formatPlainCurrency(quote.totalPrice) })}</p>
          </div>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
