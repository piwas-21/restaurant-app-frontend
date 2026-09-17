'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { getProducts } from '@/services/menuService';
import { unlinkMenuOffer } from '@/services/menuOfferFamilyService';
import { isMenuBundle } from '@/utils/productTypeFilter';
import { serverMessage } from '@/utils/apiFormErrors';
import type { Product, ProductDetails } from '@/app/admin/menu-management/interfaces';
import QuickMenuVersionModal from './QuickMenuVersionModal';
import LinkExistingMenuModal from './LinkExistingMenuModal';
import styles from './OfferVersionsSection.module.css';
import adminStyles from '@/app/styles/AdminPage.module.css';

interface OfferVersionsSectionProps {
  readonly product: ProductDetails;
  readonly onCreated?: (menuId: string) => void;
}

const parentId = (menu: Product): string | null =>
  menu.parentOfferProductId ?? menu.menuDefinition?.parentOfferProductId ?? null;

export default function OfferVersionsSection({ product, onCreated }: OfferVersionsSectionProps) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  const [offers, setOffers] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | 'link' | null>(null);
  const [unlinking, setUnlinking] = useState<Product | null>(null);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getProducts(1, 100, null, { type: 'Menu', includeComponents: true });
      if (!response.success) {
        setError(response.message || tRef.current('error_loading_menu_bundles'));
      } else {
        setOffers(response.data.items.filter((menu) => isMenuBundle(menu) && parentId(menu) === product.id));
      }
    } catch (caught) {
      setError(serverMessage(caught) ?? tRef.current('error_loading_menu_bundles'));
    } finally {
      setIsLoading(false);
    }
  }, [product.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlink = async () => {
    if (!unlinking) return;
    try {
      const response = await unlinkMenuOffer(unlinking.id);
      if (!response.success) {
        setError(serverMessage(response) ?? tRef.current('error_loading_menu_bundles'));
      } else {
        setUnlinking(null);
        await load();
      }
    } catch (caught) {
      setError(serverMessage(caught) ?? tRef.current('error_loading_menu_bundles'));
    }
  };

  const handleCreated = (menuId: string) => {
    setModal(null);
    onCreated?.(menuId);
  };

  return (
    <section className={styles.section} aria-labelledby="offer-versions-heading">
      <div className={styles.header}>
        <div>
          <h3 id="offer-versions-heading">{t('menu_bundles')}</h3>
          <p className={styles.muted}>{t('show_bundles_on_all_tab_hint')}</p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={`${adminStyles.adminButton} ${adminStyles.add}`}
            onClick={() => setModal('link')}
          >
            {t('menu_bundles')}
          </button>
          <button
            type="button"
            className={`${adminStyles.adminButton} ${adminStyles.add}`}
            onClick={() => setModal('create')}
          >
            {t('create_menu_bundle')}
          </button>
        </div>
      </div>

      {isLoading && <p>{t('loading_menu_bundles')}</p>}
      {!isLoading && offers.length === 0 && <p className={styles.muted}>{t('no_menu_bundles_found')}</p>}
      {offers.length > 0 && (
        <ul className={styles.list}>
          {offers.map((offer) => (
            <li className={styles.offer} key={offer.id}>
              <div>
                <span className={styles.offerName}>{offer.name}</span>
                <span className={styles.offerMeta}>
                  {offer.basePrice} · {offer.isAvailable ? t('available') : t('no')}
                </span>
              </div>
              <div className={styles.actions}>
                <Link
                  className={`${adminStyles.adminButton} ${adminStyles.view}`}
                  href={`/admin/menu-management/${offer.id}`}
                >
                  {t('details')}
                </Link>
                <button
                  type="button"
                  className={`${adminStyles.adminButton} ${adminStyles.delete}`}
                  onClick={() => setUnlinking(offer)}
                >
                  {t('remove')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <QuickMenuVersionModal
        isOpen={modal === 'create'}
        product={product}
        onClose={() => setModal(null)}
        onCreated={handleCreated}
      />
      <LinkExistingMenuModal
        isOpen={modal === 'link'}
        product={product}
        onClose={() => setModal(null)}
        onLinked={() => {
          setModal(null);
          void load();
        }}
      />
      <ConfirmationModal
        isOpen={unlinking !== null}
        onClose={() => setUnlinking(null)}
        onConfirm={unlink}
        message={t('delete_confirmation')}
      />
    </section>
  );
}
