'use client';

import { useTranslation } from 'react-i18next';
import AllergenDisplay from '@/components/common/AllergenDisplay';
import styles from './SheetIntro.module.css';

interface SheetIntroProps {
  description?: string;
  allergens?: string[];
  preparationTimeMinutes?: number;
}

/**
 * The item's context — description, allergens, preparation time — above the flow.
 *
 * Deliberately OUTSIDE the step panel: none of it is a decision, and the guided flow's promise is
 * that what is on screen is what the guest has to answer. It also fixes a real loss in the layout
 * this replaces, where the allergen row sat at the top of a three-screen scroll and was gone by the
 * time anyone reached the ingredient list it applies to.
 */
export default function SheetIntro({ description, allergens, preparationTimeMinutes }: Readonly<SheetIntroProps>) {
  const { t } = useTranslation();
  const hasAllergens = (allergens?.length ?? 0) > 0;
  const hasPrepTime = (preparationTimeMinutes ?? 0) > 0;

  if (!description && !hasAllergens && !hasPrepTime) return null;

  return (
    <div className={styles.intro}>
      {/* product-authored text: dir="auto" so an English name inside an Arabic page keeps its own
          punctuation (DESIGN-SYSTEM.md §8.2) */}
      {description && (
        <p dir="auto" className={styles.description}>
          {description}
        </p>
      )}
      {hasAllergens && <AllergenDisplay allergens={allergens ?? []} variant="compact" maxVisible={8} />}
      {hasPrepTime && (
        <p className={styles.preparationTime}>
          {t('preparation_time')}: {preparationTimeMinutes} {t('minutes')}
        </p>
      )}
    </div>
  );
}
