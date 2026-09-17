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
import { groupProductsIntoOfferRows, type OfferFamilyRow } from '@/utils/offerFamilyGrouping';

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

function ProductActions({
  product,
  onEdit,
  onDelete,
}: {
  readonly product: Product;
  readonly onEdit: (product: Product) => void;
  readonly onDelete: (product: Product) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className={gapStyles.actions}>
      <button onClick={() => onEdit(product)} className={`${styles.adminButton} ${styles.edit}`}>
        {t('edit')}
      </button>
      <button onClick={() => onDelete(product)} className={`${styles.adminButton} ${styles.delete}`}>
        {t('delete')}
      </button>
      <Link
        href={`/admin/menu-management/${product.id}?type=${isMenuBundle(product) ? 'menu' : 'product'}`}
        className={`${styles.adminButton} ${styles.view}`}
      >
        {t('details')}
      </Link>
    </div>
  );
}

function ProductTableRow({
  product,
  labels,
  onEdit,
  onDelete,
  nested = false,
}: {
  readonly product: Product;
  readonly labels: Record<CompletenessFieldId, string>;
  readonly onEdit: (product: Product) => void;
  readonly onDelete: (product: Product) => void;
  readonly nested?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <tr className={nested ? gapStyles.nestedRow : undefined}>
      <td>
        {nested && (
          <span className={gapStyles.indentMark} aria-hidden="true">
            ↳
          </span>
        )}
        {product.name}
        <ProductRowGaps product={product} labels={labels} />
      </td>
      <td>{formatPlainCurrency(product.basePrice)}</td>
      <td>{product.isActive ? t('yes') : t('no')}</td>
      <td>{product.isAvailable ? t('yes') : t('no')}</td>
      <td className={styles.actionsCell}>
        <ProductActions product={product} onEdit={onEdit} onDelete={onDelete} />
      </td>
    </tr>
  );
}

function OfferFamilyRows({
  family,
  labels,
  onEdit,
  onDelete,
}: {
  readonly family: OfferFamilyRow;
  readonly labels: Record<CompletenessFieldId, string>;
  readonly onEdit: (product: Product) => void;
  readonly onDelete: (product: Product) => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(true);
  const offerCount = family.menuOffers.length + 1;

  return (
    <React.Fragment key={family.anchor.id}>
      <tr className={gapStyles.familyRow}>
        <td>
          <button
            type="button"
            className={gapStyles.expandButton}
            aria-expanded={expanded}
            aria-label={expanded ? t('collapse') : t('expand')}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? '−' : '+'}
          </button>
          <strong>{family.anchor.name}</strong>
          <span className={gapStyles.familySummary}>
            {offerCount} {t('menu_bundles')}
          </span>
        </td>
        <td>{formatPlainCurrency(family.anchor.basePrice)}</td>
        <td>{family.anchor.isActive ? t('yes') : t('no')}</td>
        <td>{family.anchor.isAvailable ? t('yes') : t('no')}</td>
        <td className={styles.actionsCell}>
          <ProductActions product={family.anchor} onEdit={onEdit} onDelete={onDelete} />
        </td>
      </tr>
      {expanded &&
        family.menuOffers.map((offer) => (
          <ProductTableRow key={offer.id} product={offer} labels={labels} onEdit={onEdit} onDelete={onDelete} nested />
        ))}
    </React.Fragment>
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
            groupProductsIntoOfferRows(products).map((row) =>
              row.kind === 'family' ? (
                <OfferFamilyRows
                  key={row.anchor.id}
                  family={row}
                  labels={gapLabels}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ) : (
                <ProductTableRow
                  key={row.product.id}
                  product={row.product}
                  labels={gapLabels}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ),
            )
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
