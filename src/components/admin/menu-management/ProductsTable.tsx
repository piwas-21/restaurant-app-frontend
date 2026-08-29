'use client';

import { formatPlainCurrency } from '@/utils/currency';
import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import styles from '@/app/styles/AdminPage.module.css';
import { Product } from '@/app/admin/menu-management/interfaces';
import { MenuTypeFilter, isMenuBundle } from '@/utils/productTypeFilter';
import { getSummaryRowCompleteness, type CompletenessFieldId } from '@/lib/productCompleteness';
import gapStyles from './ProductsTable.module.css';

interface ProductsTableProps {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  /** Receives the ROW, not an id — the row carries the kind (`type`). */
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  /** Only picks the loading/empty wording. Row behaviour derives from the row itself. */
  typeFilter?: MenuTypeFilter;
}

/**
 * The "still to fill in" chips on a menu row (MENU-ITEM-EDITOR-REDESIGN-PLAN, S10).
 *
 * Same rules as the editor's side-rail meter, from the same module, so a row and the page it opens
 * can never disagree. Nothing here is a judgement about the item — only about the DATA.
 *
 * **There is deliberately no "needs allergens" chip, and this is the decision, not an omission**
 * (plan §14, option 3). `allergens` is a `string[]`: an empty array is both "the kitchen checked and
 * there is nothing to declare" and "nobody has opened this yet", and every available wording asserts
 * something the schema does not hold. *"Needs allergens"* nags an allergen-free dish forever with no
 * way to satisfy it, and *"allergens not reviewed"* states a knowledge fact no field records. A chip
 * is a verdict rendered beside an item on a list an owner scans for compliance, so the wrong one is
 * worse here than anywhere else in the product. The day the recorded-check field lands (§14 option
 * 1) the chip is one appended rule in `productCompleteness.ts` and the wording finally becomes true.
 *
 * A BUNDLE gets no chips: it has no gallery to manage (plan §15.4), so "needs photo" would name a
 * control it does not have.
 */
function ProductRowGaps({
  product,
  labels,
}: {
  readonly product: Product;
  readonly labels: Record<CompletenessFieldId, string>;
}) {
  if (isMenuBundle(product)) return null;
  const { missing } = getSummaryRowCompleteness(product);
  if (missing.length === 0) return null;

  return (
    // No `aria-label` on the list, and that is a decision: each chip already says "Needs photo",
    // so a group label reading "Still to add" would have every gap announced twice.
    <ul className={gapStyles.chips}>
      {missing.map((id) => (
        <li key={id} className={gapStyles.chip}>
          {labels[id]}
        </li>
      ))}
    </ul>
  );
}

const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  isLoading,
  error,
  onEdit,
  onDelete,
  typeFilter = 'all',
}) => {
  const { t } = useTranslation();

  // One literal `t()` per chip: `check-t-keys.mjs` reads callsites statically, so a key built as
  // `t(`product_needs_${id}`)` is invisible to it.
  const gapLabels: Record<CompletenessFieldId, string> = {
    photo: t('product_needs_photo'),
    description: t('product_needs_description'),
  };

  const loadingMessage = typeFilter === 'bundles' ? t('loading_menu_bundles') : t('loading_products');
  const emptyMessage = typeFilter === 'bundles' ? t('no_menu_bundles_found') : t('no_products_found');

  if (isLoading) return <p>{loadingMessage}</p>;
  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div className={styles.adminTableContainer}>
      <table className={styles.adminTable}>
        <thead>
          <tr>
            <th>{t('product_name')}</th>
            <th>{t('base_price')}</th>
            <th>{t('active')}</th>
            <th>{t('available')}</th>
            <th>{t('actions_header')}</th>
          </tr>
        </thead>
        <tbody>
          {products.length > 0 ? (
            products.map((product) => (
              <tr key={product.id}>
                <td>
                  {product.name}
                  <ProductRowGaps product={product} labels={gapLabels} />
                </td>
                <td>{formatPlainCurrency(product.basePrice)}</td>
                <td>{product.isActive ? t('yes') : t('no')}</td>
                <td>{product.isAvailable ? t('yes') : t('no')}</td>
                <td className={styles.actionsCell}>
                  <button onClick={() => onEdit(product)} className={`${styles.adminButton} ${styles.edit}`}>
                    {t('edit')}
                  </button>
                  <button onClick={() => onDelete(product)} className={`${styles.adminButton} ${styles.delete}`}>
                    {t('delete')}
                  </button>
                  <Link
                    // Per ROW, not per view: an "All" list mixes both kinds, so the
                    // active filter cannot say what an individual row is. (Slice 7 PR2c
                    // drops this param entirely — the detail page derives type itself.)
                    href={`/admin/menu-management/${product.id}?type=${isMenuBundle(product) ? 'menu' : 'product'}`}
                    className={`${styles.adminButton} ${styles.view}`}
                  >
                    {t('details')}
                  </Link>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default ProductsTable;
