'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Tag, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOptionalAuth } from '@/components/AuthContext';
import { updateProductPrice } from '@/services/productService';
import type { CatalogItem } from '@/types/menu';
import styles from './AdminMenuCardControls.module.css';

interface AdminMenuCardControlsProps {
  item: CatalogItem;
  /** Called with the new base price after a successful inline edit, so the card can reflect it. */
  onPriceChange?: (price: number) => void;
}

/**
 * Admin-only quick-edit affordances overlaid on a menu card: a pencil that deep-links to the item's
 * editor, plus (for a plain product) an inline base-price edit — so an admin browsing the live menu
 * can retag a price or jump to the full editor without walking through the admin panel. Renders
 * nothing for guests/customers, and only after mount — auth resolves client-side, so gating on the
 * first paint would flash the control or mismatch SSR.
 */
export default function AdminMenuCardControls({ item, onPriceChange }: Readonly<AdminMenuCardControlsProps>) {
  const { t } = useTranslation();
  const auth = useOptionalAuth();
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => setMounted(true), []);

  const isAdmin = auth?.user?.role?.toLowerCase() === 'admin';
  if (!mounted || auth?.isLoading || !isAdmin) {
    return null;
  }

  const editLabel = t('admin_edit_menu_item', 'Edit this item');
  const priceLabel = t('admin_edit_price', 'Edit price');
  const canEditPrice = item.priceEditable === true && onPriceChange !== undefined;

  const startEditing = () => {
    setValue(String(item.price));
    setFailed(false);
    setEditing(true);
  };

  const save = async () => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setFailed(true);
      return;
    }
    setSaving(true);
    setFailed(false);
    try {
      const result = await updateProductPrice(item.id, parsed);
      if (result?.success) {
        onPriceChange?.(parsed);
        setEditing(false);
      } else {
        setFailed(true);
      }
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className={`${styles.controls} ${styles.editing}`}>
        <input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${styles.priceInput} ${failed ? styles.priceInputError : ''}`}
          aria-label={priceLabel}
          aria-invalid={failed}
          disabled={saving}
          data-testid="admin-price-input"
        />
        <button
          type="button"
          className={styles.editButton}
          onClick={save}
          disabled={saving}
          aria-label={t('save', 'Save')}
          data-testid="admin-price-save"
        >
          <Check size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.editButton}
          onClick={() => setEditing(false)}
          disabled={saving}
          aria-label={t('cancel', 'Cancel')}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className={styles.controls}>
      <Link
        href={`/admin/menu-management/${item.id}`}
        className={styles.editButton}
        aria-label={editLabel}
        title={editLabel}
        data-testid="admin-edit-item"
      >
        <Pencil size={16} aria-hidden="true" />
      </Link>
      {canEditPrice && (
        <button
          type="button"
          className={styles.editButton}
          onClick={startEditing}
          aria-label={priceLabel}
          title={priceLabel}
          data-testid="admin-edit-price"
        >
          <Tag size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
