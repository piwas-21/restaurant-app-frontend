'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { getAllMenuBundles } from '@/services/menuService';
import { unlinkMenuOffer } from '@/services/menuOfferFamilyService';
import { isMenuBundle } from '@/utils/productTypeFilter';
import { serverMessage } from '@/utils/apiFormErrors';
import type { Product, ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { MenuVersionPrefill } from '@/utils/quickMenuVersionPayload';
import QuickMenuVersionModal from './QuickMenuVersionModal';
import LinkExistingMenuModal from './LinkExistingMenuModal';
import styles from './OfferVersionsSection.module.css';
import adminStyles from '@/app/styles/AdminPage.module.css';

interface OfferVersionsSectionProps {
  readonly product: ProductDetails;
  readonly onCreateRequested?: (prefill: MenuVersionPrefill) => void;
  readonly onNavigate?: (href: string) => void;
  readonly allowQuickCreate?: boolean;
}

const parentId = (menu: Product): string | null => menu.parentOfferProductId ?? null;

export default function OfferVersionsSection({
  product,
  onCreateRequested,
  onNavigate,
  allowQuickCreate = true,
}: OfferVersionsSectionProps) {
  const { t } = useTranslation();
  const tRef = useRef(t);
  const [offers, setOffers] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(product.id));
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<'create' | 'link' | null>(null);
  const [unlinking, setUnlinking] = useState<Product | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const requestSequence = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const load = useCallback(async () => {
    if (!product.id) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const sequence = ++requestSequence.current;
    setIsLoading(true);
    setError(null);
    try {
      const bundles = await getAllMenuBundles(controller.signal);
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      setOffers(bundles.filter((menu) => isMenuBundle(menu) && parentId(menu) === product.id));
    } catch (caught) {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      setError(serverMessage(caught) ?? tRef.current('error_loading_menu_bundles'));
    } finally {
      if (!controller.signal.aborted && sequence === requestSequence.current) setIsLoading(false);
    }
  }, [product.id]);

  useEffect(() => {
    void load();
    return () => {
      requestSequence.current += 1;
      abortRef.current?.abort();
    };
  }, [load]);

  const unlink = async () => {
    if (!unlinking || isUnlinking) return;
    const target = unlinking;
    setIsUnlinking(true);
    try {
      const response = await unlinkMenuOffer(target.id);
      if (!response.success) {
        setError(serverMessage(response) ?? tRef.current('error_loading_menu_bundles'));
      } else {
        setUnlinking(null);
        await load();
      }
    } catch (caught) {
      setError(serverMessage(caught) ?? tRef.current('error_loading_menu_bundles'));
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleCreateRequested = (prefill: MenuVersionPrefill) => {
    setModal(null);
    onCreateRequested?.(prefill);
  };

  // Components are option-only carriers and cannot anchor a public offer family. An unsaved
  // bundle has no id to load or link, so the section is intentionally absent on the new route.
  if (!product.id || product.isComponent) return null;

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
            {t('link_existing_menu_version', 'Link existing menu version')}
          </button>
          {allowQuickCreate && (
            <button
              type="button"
              className={`${adminStyles.adminButton} ${adminStyles.add}`}
              onClick={() => setModal('create')}
            >
              {t('create_menu_version', 'Create menu version')}
            </button>
          )}
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
                  {offer.basePrice} ·{' '}
                  {offer.parentOfferVariationId
                    ? `${t('variation')}: ${
                        product.variations.find((variation) => variation.id === offer.parentOfferVariationId)?.name ??
                        offer.parentOfferVariationId
                      } · `
                    : ''}
                  {offer.isAvailable ? t('available') : t('no')}
                </span>
              </div>
              <div className={styles.actions}>
                <Link
                  className={`${adminStyles.adminButton} ${adminStyles.view}`}
                  href={`/admin/menu-management/${offer.id}`}
                  onClick={(event) => {
                    if (!onNavigate) return;
                    event.preventDefault();
                    onNavigate(`/admin/menu-management/${offer.id}`);
                  }}
                >
                  {t('details')}
                </Link>
                <button
                  type="button"
                  className={`${adminStyles.adminButton} ${adminStyles.delete}`}
                  onClick={() => setUnlinking(offer)}
                >
                  {t('unlink_menu_version', 'Unlink menu version')}
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

      {allowQuickCreate && (
        <QuickMenuVersionModal
          isOpen={modal === 'create'}
          product={product}
          onClose={() => setModal(null)}
          onCreateRequested={handleCreateRequested}
        />
      )}
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
        onClose={() => {
          if (!isUnlinking) setUnlinking(null);
        }}
        onConfirm={unlink}
        message={t(
          'unlink_menu_version_confirmation',
          'Unlink this menu version from the product? The menu and existing orders will be kept.',
        )}
      />
    </section>
  );
}
