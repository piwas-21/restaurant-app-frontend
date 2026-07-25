'use client';

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsAdmin } from '@/hooks/menu/useIsAdmin';
import type { CatalogItem } from '@/types/menu';
import styles from './AdminMenuCardControls.module.css';

interface AdminMenuCardControlsProps {
  item: CatalogItem;
}

/**
 * Admin-only deep link from a live menu card to that item's editor, so an admin
 * browsing the menu can jump straight in without walking through the admin
 * panel. Renders nothing for guests/customers.
 *
 * It used to share the card's top-left corner with an identical-looking
 * price-edit circle: two 2rem grey glyphs, no labels, neither one saying what it
 * did. The price control now lives beside the price it edits
 * (`AdminPriceEditor`), leaving this as one written affordance.
 */
export default function AdminMenuCardControls({ item }: Readonly<AdminMenuCardControlsProps>) {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;

  // Two strings on purpose: the pill sits on a card, where the full sentence
  // ("Diesen Artikel bearbeiten") would wrap, so the visible label is a short
  // verb and the sentence carries the meaning in the tooltip + accessible name.
  const shortLabel = t('admin_edit_item_short', 'Edit');
  const fullLabel = t('admin_edit_menu_item', 'Edit this item');

  return (
    <Link
      href={`/admin/menu-management/${item.id}`}
      className={styles.editButton}
      title={fullLabel}
      aria-label={fullLabel}
      data-testid="admin-edit-item"
    >
      <Pencil size={14} aria-hidden="true" />
      {shortLabel}
    </Link>
  );
}
