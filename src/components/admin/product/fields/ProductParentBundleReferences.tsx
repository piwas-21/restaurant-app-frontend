'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from '@/components/TenantLink';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { Variation } from '@/app/admin/menu-management/interfaces';
import { getProductParentBundles, type ProductParentBundle } from '@/services/productParentBundlesService';
import { serverMessage } from '@/utils/apiFormErrors';
import styles from './ProductParentBundleReferences.module.css';

interface ProductParentBundleReferencesProps {
  readonly productId: string;
  readonly variations: Variation[];
  readonly onNavigate?: (href: string) => void;
}

export default function ProductParentBundleReferences({
  productId,
  variations,
  onNavigate,
}: ProductParentBundleReferencesProps) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  const [items, setItems] = useState<ProductParentBundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    const requestSequence = ++sequence.current;
    const controller = new AbortController();
    setItems([]);
    setError(null);
    setIsLoading(true);

    void getProductParentBundles(productId, controller.signal)
      .then((response) => {
        if (controller.signal.aborted || requestSequence !== sequence.current) return;
        if (!response || !response.success || !response.data) {
          setError(serverMessage(response) ?? tRef.current('error_loading_menu_bundles'));
          return;
        }
        setItems(response.data.items);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || requestSequence !== sequence.current) return;
        setError(serverMessage(reason) ?? tRef.current('error_loading_menu_bundles'));
      })
      .finally(() => {
        if (!controller.signal.aborted && requestSequence === sequence.current) setIsLoading(false);
      });

    return () => {
      sequence.current += 1;
      controller.abort();
    };
  }, [productId]);

  const variationNames = new Map(variations.map((variation) => [variation.id, variation.name]));

  return (
    <section className={styles.section} aria-labelledby="component-parent-bundles-title">
      <h3 id="component-parent-bundles-title">{t('parent_menu_bundles')}</h3>
      {isLoading && <p className={styles.muted}>{t('loading_menu_bundles')}</p>}
      {!isLoading && !error && items.length === 0 && <p className={styles.muted}>{t('no_parent_menu_bundles')}</p>}
      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((bundle) => {
            const href = `/admin/menu-management/${bundle.id}`;
            return (
              <li className={styles.bundle} key={bundle.id}>
                <div className={styles.bundleHeader}>
                  <Link
                    className={styles.bundleName}
                    href={href}
                    onClick={(event) => {
                      if (!onNavigate) return;
                      event.preventDefault();
                      onNavigate(href);
                    }}
                  >
                    {bundle.name}
                  </Link>
                  <StatusBadge tone={bundle.isActive ? 'success' : 'neutral'}>
                    {bundle.isActive ? t('active') : t('inactive')}
                  </StatusBadge>
                </div>
                <ul className={styles.references}>
                  {bundle.references.map((reference) => {
                    const variationName = reference.productVariationId
                      ? variationNames.get(reference.productVariationId)
                      : undefined;
                    const label = reference.productVariationId
                      ? `${t('variation')}: ${variationName ?? reference.productVariationId}`
                      : t('base_product_reference');
                    return <li key={`${reference.sectionId}:${reference.productVariationId ?? 'base'}`}>{label}</li>;
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
