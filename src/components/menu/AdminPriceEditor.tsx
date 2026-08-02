'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Check, Lock, Tag, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useIsAdmin } from '@/hooks/menu/useIsAdmin';
import { updateProductPrice } from '@/services/productService';
import { getErrorMessage } from '@/utils/apiClient';
import { TENANT_CURRENCY } from '@/utils/currency';
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
 * Renders nothing for guests/customers. For an admin it ALWAYS renders something:
 * either the control, or a disabled control naming the reason it cannot apply.
 * Until 2026-08-02 it returned `null` for a combo and for a variation product, so
 * the button was simply missing on some cards with nothing to distinguish that
 * from a defect — which is exactly how it was reported.
 *
 * `priceEditability` is derived in `utils/catalogItem.ts`, NOT the backend's say-so
 * as this comment used to claim: `PriceEditable` exists nowhere in the backend.
 */
export default function AdminPriceEditor({ item, onPriceChange }: Readonly<AdminPriceEditorProps>) {
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  // The MESSAGE, not a boolean. `failed` used to be a flag whose only expression was a red border:
  // a rejected save turned the input red and said nothing, and the `catch` that produced it was
  // unbound, so the server's reason was discarded exactly as in BUGS-IMPROVEMENTS-PLAN E9.
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = `admin-price-error-${useId()}`;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Nothing for a guest, and nothing when the host did not wire a handler — in both cases there is
  // no admin looking, so an explanation would be noise rather than information.
  if (!isAdmin || onPriceChange === undefined) {
    return null;
  }

  const label = t('admin_edit_price', 'Edit price');

  // Editable is the common case; anything else is a refusal an admin is entitled to understand.
  if (item.priceEditability !== 'editable') {
    const reason =
      item.priceEditability === 'bundle'
        ? t('admin_edit_price_locked_bundle', "A combo's price comes from the items in it")
        : t('admin_edit_price_locked_variations', 'Price is set per variation');
    return (
      <span className={styles.locked} data-testid="admin-edit-price-locked">
        <Lock size={13} aria-hidden="true" />
        {reason}
      </span>
    );
  }

  const startEditing = () => {
    setValue(String(item.price));
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    // Number('') === 0, so guard the empty/cleared field explicitly — otherwise clearing the input
    // and saving would silently retag the item to a free 0.00.
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(parsed) || parsed < 0) {
      setError(t('admin_edit_price_invalid', 'Enter a price of 0 or more'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await updateProductPrice(item.id, parsed);
      if (result?.success) {
        // Prefer the backend's echoed (possibly rounded) price over the typed value.
        onPriceChange(typeof result.data === 'number' ? result.data : parsed);
        setEditing(false);
        return;
      }
      setError(result?.message || t('admin_edit_price_failed', 'Could not save the price'));
    } catch (err) {
      // `updateProductPrice` goes through `apiClient`, which THROWS on any non-2xx — so this is
      // where the server's reason lives. It used to be discarded (E9).
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      // A column, so the error has somewhere to go. It previously had none: the only expression of
      // a rejected save was a red border, which tells an admin that something is wrong and nothing
      // about what.
      <span className={styles.editing}>
        <span className={styles.inputRow}>
          {/* The currency marker lives beside the field rather than inside the value, so the input
              stays a real `type="number"` and the admin is not typing around a symbol. */}
          <span className={styles.currency} aria-hidden="true">
            {TENANT_CURRENCY}
          </span>
          <input
            ref={inputRef}
            type="number"
            step="0.01"
            min="0"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void save();
              if (e.key === 'Escape') setEditing(false);
            }}
            className={`${styles.priceInput} ${error ? styles.priceInputError : ''}`}
            aria-label={label}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            disabled={saving}
            data-testid="admin-price-input"
          />
          <button
            type="button"
            className={`${styles.iconButton} ${styles.confirm}`}
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
        {error && (
          <span id={errorId} className={styles.error} role="alert" data-testid="admin-price-error">
            {error}
          </span>
        )}
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
