'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOptionalAuth } from '@/components/AuthContext';
import type { CatalogItem } from '@/types/menu';
import styles from './AdminMenuCardControls.module.css';

/**
 * Admin-only quick-edit affordance overlaid on a menu card: a pencil that deep-links straight to
 * the item's editor, so an admin browsing the live menu can jump to editing it without walking
 * through the admin panel. Renders nothing for guests/customers, and only after mount — auth
 * resolves client-side, so gating on the first paint would flash the control or mismatch SSR.
 */
export default function AdminMenuCardControls({ item }: Readonly<{ item: CatalogItem }>) {
  const { t } = useTranslation();
  const auth = useOptionalAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isAdmin = auth?.user?.role?.toLowerCase() === 'admin';
  if (!mounted || auth?.isLoading || !isAdmin) {
    return null;
  }

  const label = t('admin_edit_menu_item', 'Edit this item');
  return (
    <div className={styles.controls}>
      <Link
        href={`/admin/menu-management/${item.id}`}
        className={styles.editButton}
        aria-label={label}
        title={label}
        data-testid="admin-edit-item"
      >
        <Pencil size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}
