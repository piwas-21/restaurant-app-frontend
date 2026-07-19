'use client';

import { useTranslation } from 'react-i18next';
import { CartItem } from '@/components/cart/cartTypes';
import styles from '@/app/styles/CartPage.module.css';

interface CartItemInstructionsEditorProps {
  item: CartItem;
  itemId: string | undefined;
  isSyncing: boolean;
  editingInstructions: string | null;
  setEditingInstructions: (id: string | null) => void;
  instructionsValue: string;
  setInstructionsValue: (value: string) => void;
  onSaveInstructions: (basketItemId: string | undefined, quantity: number, instructions: string) => void;
}

/**
 * The special-instructions display + edit section for a cart item — the single owner of the
 * item's notes for EVERY item (customized or not). Previously gated to items without ingredient
 * customizations, which hid the "Add/Edit Instructions" button on prod, where menu dishes carry
 * recipes; the backend update only writes quantity + notes, so editing preserves customizations.
 * The read-only echo lives here, not in CartItemCustomizations, to avoid a double "special requests"
 * line. Extracted from app/cart/page.tsx (Sprint 4/6 god-file decomposition).
 */
export default function CartItemInstructionsEditor({
  item,
  itemId,
  isSyncing,
  editingInstructions,
  setEditingInstructions,
  instructionsValue,
  setInstructionsValue,
  onSaveInstructions,
}: CartItemInstructionsEditorProps) {
  const { t } = useTranslation();

  return (
    <div className={styles.instructionsContainer}>
      {editingInstructions === itemId ? (
        <div className={styles.instructionsEdit}>
          <textarea
            value={instructionsValue}
            onChange={(e) => setInstructionsValue(e.target.value)}
            placeholder={t('special_instructions_placeholder', 'Add special instructions...')}
            className={styles.instructionsTextarea}
            rows={3}
          />
          <div className={styles.instructionsActions}>
            <button
              type="button"
              onClick={() => onSaveInstructions(itemId, item.quantity, instructionsValue)}
              className={styles.saveButton}
              disabled={isSyncing}
            >
              {t('save', 'Save')}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingInstructions(null);
                setInstructionsValue('');
              }}
              className={styles.cancelButton}
            >
              {t('cancel', 'Cancel')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {item.specialInstructions && (
            <p className={styles.instructionsText}>
              <strong>{t('special_instructions', 'Special Instructions')}:</strong> {item.specialInstructions}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingInstructions(itemId || null);
              setInstructionsValue(item.specialInstructions || '');
            }}
            className={styles.editInstructionsButton}
            disabled={isSyncing}
          >
            {item.specialInstructions
              ? t('edit_instructions', 'Edit Instructions')
              : t('add_instructions', 'Add Instructions')}
          </button>
        </>
      )}
    </div>
  );
}
