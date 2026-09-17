'use client';

import type { Product } from '@/app/admin/menu-management/interfaces';
import { getSummaryRowCompleteness, type CompletenessFieldId } from '@/lib/productCompleteness';
import { isMenuBundle } from '@/utils/productTypeFilter';
import styles from './ProductsTable.module.css';

interface ProductRowGapsProps {
  readonly product: Product;
  readonly labels: Record<CompletenessFieldId, string>;
}

/** Keeps the list row's completeness indicators aligned with the editor's side rail. */
export default function ProductRowGaps({ product, labels }: ProductRowGapsProps) {
  if (isMenuBundle(product)) return null;
  const { missing } = getSummaryRowCompleteness(product);
  if (missing.length === 0) return null;

  return (
    <ul className={styles.chips}>
      {missing.map((id) => (
        <li key={id} className={styles.chip}>
          {labels[id]}
        </li>
      ))}
    </ul>
  );
}
