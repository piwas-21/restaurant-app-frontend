'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Tag, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsAdmin } from '@/hooks/menu/useIsAdmin';
import { updateProductPrice } from '@/services/productService';
import type { CatalogItem } from '@/types/menu';
import styles from './AdminPriceEditor.module.css';

interface AdminPriceEditorProps {
  item: CatalogItem;
  /** Called with the new base price after a successful edit, so the card can reflect it. */
  onPriceChange?: (price: number) => void;
}

/**
 * Admin-only inline base-price edit, rendered NEXT TO the card's price rather
 * than as an anonymous icon in the image's top-left corner — the price is what
 * it edits, so that's where it belongs, and a written label says so instead of
 * leaving a bare tag glyph to be guessed at.
 *
 * Renders nothing for guests/customers, for a combo, or for a product whose
 * price is derived (variations) — `item.priceEditable` is the backend's say-so.
 */
export default function AdminPriceEditor({ item, onPriceChange }: Readonly<AdminPriceEditorProps>) {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!isAdmin || item.priceEditable !== true || onPriceChange === undefined) {
    return null;
  }

  const label = t('admin_edit_price', 'Edit price');

  const startEditing = () => {
    setValue(String(item.price));
    setFailed(false);
    setEditing(true);
  };

  const save = async () => {
    // Number('') === 0, so guard the empty/cleared field explicitly — otherwise clearing the input
    // and saving would silently retag the item to a free 0.00.
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(parsed) || parsed < 0) {
      setFailed(true);
      return;
    }
    setSaving(true);
    setFailed(false);
    try {
      const result = await updateProductPrice(item.id, parsed);
      if (result?.success) {
        // Prefer the backend's echoed (possibly rounded) price over the typed value.
        onPriceChange(typeof result.data === 'number' ? result.data : parsed);
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
      <span className={styles.editing}>
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setFailed(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void save();
            if (e.key === 'Escape') setEditing(false);
          }}
          className={`${styles.priceInput} ${failed ? styles.priceInputError : ''}`}
          aria-label={label}
          aria-invalid={failed}
          disabled={saving}
          data-testid="admin-price-input"
        />
        <button
          type="button"
          className={styles.iconButton}
          onClick={save}
          disabled={saving}
          aria-label={t('save', 'Save')}
          data-testid="admin-price-save"
        >
          <Check size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => setEditing(false)}
          disabled={saving}
          aria-label={t('cancel', 'Cancel')}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </span>
    );
  }

  return (
    <button type="button" className={styles.trigger} onClick={startEditing} data-testid="admin-edit-price">
      <Tag size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
