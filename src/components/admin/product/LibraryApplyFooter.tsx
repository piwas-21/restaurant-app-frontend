'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LibraryPickerCopy } from './libraryPickerCopy';
import type { ApplyPlan } from './libraryApplyTargets';
import styles from './GlobalIngredientPickerModal.module.css';

interface LibraryApplyFooterProps {
  copy: LibraryPickerCopy;
  plan: ApplyPlan;
  isSaving: boolean;
  /** The write has run; the panel is showing its receipt and the only action left is the way out. */
  isDone: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

/**
 * The footer of the "apply to items" panel — and the whole of decision D6's confirm step.
 *
 * **The button says the blast radius, it does not merely enable itself.** "Apply to 38 items" is the
 * sentence the admin approves; a bare "Apply" beside a list of ticks makes the count something they
 * have to work out themselves, and getting it wrong is a catalog-wide write. The count comes from
 * the PLAN, which has already dropped the products that carry the row and de-duplicated the ones
 * offered under two categories, so the number on the button is exactly the number of products the
 * request will name.
 *
 * The second line states what will be STEPPED OVER, and only when there is something to state. An
 * admin who selects forty pizzas and reads "38 will change" needs the other two accounted for, or
 * the receipt afterwards looks like a failure.
 *
 * Both counts are rendered through `t(key, { count })`, so the plural forms are the bundle's problem
 * in each of the ten locales rather than an English "1 items" assembled here.
 */
export default function LibraryApplyFooter({
  copy,
  plan,
  isSaving,
  isDone,
  onBack,
  onConfirm,
}: Readonly<LibraryApplyFooterProps>) {
  const { t } = useTranslation();

  return (
    <div className={styles.footer}>
      {!isDone && plan.alreadyHaveCount > 0 && (
        <span className={styles.notice}>{t(copy.applyAlreadyHave, { count: plan.alreadyHaveCount })}</span>
      )}
      <div className={styles.footerActions}>
        <button type="button" className={styles.cancelButton} onClick={onBack}>
          {t(copy.applyBack)}
        </button>
        {!isDone && (
          <button
            type="button"
            className={styles.confirmButton}
            onClick={onConfirm}
            disabled={plan.willChangeCount === 0 || isSaving}
          >
            {t(copy.applyConfirm, { count: plan.willChangeCount })}
          </button>
        )}
      </div>
    </div>
  );
}
