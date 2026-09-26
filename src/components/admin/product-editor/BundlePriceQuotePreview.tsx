'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { OrderType } from '@/types/order';
import type { ItemAvailability, MenuDefinition } from '@/types/menu';
import { buildDefaultBundleSelection, findBundleSelectionErrors } from '@/utils/bundleSelection';
import { formatPlainCurrency } from '@/utils/currency';
import { serverMessage } from '@/utils/apiFormErrors';
import { quoteProduct } from '@/services/productQuoteService';
import type { ProductQuoteDto } from '@/services/productQuoteService';
import styles from './BundlePriceQuotePreview.module.css';
import { hasTemporarySelectionIds, optionOrderable, ORDER_TYPE_KEYS, toQuoteRequest } from './bundlePriceQuoteUtils';

interface BundlePriceQuotePreviewProps {
  readonly productId: string;
  readonly menuDefinition: MenuDefinition;
  readonly isDirty: boolean;
  readonly isActive: boolean;
  readonly isAvailable: boolean;
  readonly availability?: ItemAvailability;
}

interface QuoteState {
  readonly key: string;
  readonly value: ProductQuoteDto;
}

/** Server prices the saved default guest choices through the same basket item factory. */
export default function BundlePriceQuotePreview({
  productId,
  menuDefinition,
  isDirty,
  isActive,
  isAvailable,
  availability,
}: BundlePriceQuotePreviewProps) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(1);
  const [requestedOrderType, setRequestedOrderType] = useState<OrderType | ''>('');
  const [isPending, setIsPending] = useState(false);
  const [quote, setQuote] = useState<QuoteState | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const requestSequence = useRef(0);
  const defaultSelections = useMemo(
    () => buildDefaultBundleSelection(menuDefinition.sections),
    [menuDefinition.sections],
  );
  const selectionErrors = useMemo(
    () => findBundleSelectionErrors(menuDefinition.sections, defaultSelections),
    [defaultSelections, menuDefinition.sections],
  );
  const hasTemporaryIds = hasTemporarySelectionIds(menuDefinition);
  const selectedOrderable = defaultSelections.every((selection) =>
    optionOrderable(selection, menuDefinition, requestedOrderType),
  );
  const menuOrderable = requestedOrderType
    ? (availability?.allowedOrderTypes.includes(requestedOrderType) ?? true)
    : (availability?.canOrder ?? true);
  const canQuote = Boolean(
    productId &&
    !isDirty &&
    !hasTemporaryIds &&
    isActive &&
    isAvailable &&
    selectionErrors.length === 0 &&
    menuOrderable &&
    selectedOrderable,
  );
  const quoteKey = JSON.stringify({
    productId,
    menuDefinition,
    defaultSelections,
    quantity,
    requestedOrderType,
    isDirty,
    isActive,
    isAvailable,
    availability,
  });
  const currentKey = useRef(quoteKey);
  currentKey.current = quoteKey;

  useEffect(() => {
    requestSequence.current += 1;
    setQuote(null);
    setError(null);
    setIsPending(false);
  }, [quoteKey]);

  useEffect(
    () => () => {
      requestSequence.current += 1;
    },
    [],
  );

  const requestQuote = async () => {
    if (!canQuote || !productId || isPending) return;
    const sequence = ++requestSequence.current;
    setIsPending(true);
    setQuote(null);
    setError(null);
    try {
      const value = await quoteProduct(
        productId,
        toQuoteRequest(defaultSelections, quantity),
        requestedOrderType || undefined,
      );
      if (sequence === requestSequence.current && currentKey.current === quoteKey) {
        setQuote({ key: quoteKey, value });
      }
    } catch (reason: unknown) {
      if (sequence === requestSequence.current && currentKey.current === quoteKey) {
        setError({ key: quoteKey, message: serverMessage(reason) ?? t('bundle_quote_failed') });
      }
    } finally {
      if (sequence === requestSequence.current && currentKey.current === quoteKey) setIsPending(false);
    }
  };

  const currentQuote = quote?.key === quoteKey ? quote.value : null;
  const currentError = error?.key === quoteKey ? error.message : null;

  return (
    <section className={styles.quote} aria-labelledby="bundle-price-quote-title">
      <div>
        <h4 id="bundle-price-quote-title" className={styles.title}>
          {t('bundle_quote_title')}
        </h4>
        <p className={styles.description}>{t('bundle_quote_saved_configuration_note')}</p>
      </div>
      <div className={styles.controls}>
        <FormField label={t('bundle_quote_quantity')}>
          <input
            className={styles.fieldInput}
            type="number"
            min={1}
            max={99}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(1, Math.min(99, Number.parseInt(event.target.value, 10) || 1)))}
          />
        </FormField>
        <FormField label={t('bundle_quote_channel')}>
          <select
            className={styles.fieldInput}
            value={requestedOrderType}
            onChange={(event) => setRequestedOrderType(event.target.value as OrderType | '')}
          >
            <option value="">{t('bundle_quote_any_channel')}</option>
            {Object.values(OrderType).map((channel) => (
              <option
                key={channel}
                value={channel}
                disabled={availability ? !availability.allowedOrderTypes.includes(channel) : false}
              >
                {t(ORDER_TYPE_KEYS[channel])}
              </option>
            ))}
          </select>
        </FormField>
        <button type="button" className={styles.button} disabled={!canQuote || isPending} onClick={requestQuote}>
          {isPending ? t('bundle_quote_pending') : t('bundle_quote_request')}
        </button>
      </div>
      {!productId && (
        <p className={styles.notice} role="status">
          {t('bundle_quote_save_before_preview')}
        </p>
      )}
      {Boolean(productId && (isDirty || hasTemporaryIds)) && (
        <p className={styles.notice} role="status">
          {t('bundle_quote_save_changes_first')}
        </p>
      )}
      {Boolean(productId && !isDirty && !hasTemporaryIds && (!isActive || !isAvailable)) && (
        <p className={styles.notice} role="status">
          {t('bundle_quote_requires_available_menu')}
        </p>
      )}
      {Boolean(productId && !isDirty && !hasTemporaryIds && isActive && isAvailable && selectionErrors.length > 0) && (
        <p className={styles.notice} role="status">
          {t('bundle_quote_defaults_incomplete')}
        </p>
      )}
      {Boolean(
        productId &&
        !isDirty &&
        !hasTemporaryIds &&
        isActive &&
        isAvailable &&
        selectionErrors.length === 0 &&
        (!menuOrderable || !selectedOrderable),
      ) && (
        <p className={styles.notice} role="status">
          {t('bundle_quote_selection_unavailable')}
        </p>
      )}
      {currentError && (
        <p className={styles.error} role="alert">
          {currentError}
        </p>
      )}
      {currentQuote && (
        <div className={styles.result} role="status" aria-live="polite">
          <strong>
            {requestedOrderType
              ? t('bundle_quote_result_heading_channel', { channel: t(ORDER_TYPE_KEYS[requestedOrderType]) })
              : t('bundle_quote_result_heading')}
          </strong>
          <span>{t('bundle_quote_total', { amount: formatPlainCurrency(currentQuote.totalPrice) })}</span>
          <span>{t('bundle_quote_unit', { amount: formatPlainCurrency(currentQuote.unitPrice) })}</span>
        </div>
      )}
    </section>
  );
}
