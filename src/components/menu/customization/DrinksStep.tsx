'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import { localizedName } from '@/utils/localizedContent';
import type { DrinkUpsell } from '@/hooks/menu/useDrinkUpsell';
import styles from './DrinksStep.module.css';

interface DrinksStepProps {
  drinks: DrinkUpsell;
  currentLanguage: string;
}

/**
 * The always-offered drinks step (MENU-CUSTOMIZATION-FLOW-PLAN §3.4) — the whole beverage menu,
 * whether or not the admin attached any of it to this dish as a suggested side.
 *
 * Its note is not decoration: a drink chosen here becomes its **own basket line**, not a side
 * attached to the dish, and the guest should not be surprised by that in the cart. The footer total
 * says the same thing by including it.
 */
export default function DrinksStep({ drinks, currentLanguage }: Readonly<DrinksStepProps>) {
  const { t } = useTranslation();

  return (
    <>
      <p className={styles.note}>{t('step_drinks_hint')}</p>
      <ul className={styles.list}>
        {drinks.drinks.map((drink) => {
          const quantity = drinks.selected[drink.id] ?? 0;
          const name = localizedName(drink, currentLanguage);

          return (
            <li key={drink.id} className={styles.row}>
              <div className={styles.info}>
                {/* tenant-authored: dir="auto" (DESIGN-SYSTEM.md §8.2) */}
                <span dir="auto" className={styles.name}>
                  {name}
                </span>
                <span className={styles.price}>{formatPlainCurrency(drink.price)}</span>
              </div>

              {quantity > 0 ? (
                <div className={styles.stepper}>
                  <button
                    type="button"
                    className={styles.stepperButton}
                    onClick={() => drinks.remove(drink.id)}
                    aria-label={t('decrease_quantity')}
                  >
                    <Minus size={16} />
                  </button>
                  <span className={styles.quantity}>{quantity}</span>
                  <button
                    type="button"
                    className={styles.stepperButton}
                    onClick={() => drinks.add(drink.id)}
                    aria-label={t('increase_quantity')}
                  >
                    <Plus size={16} />
                  </button>
                </div>
              ) : (
                <button type="button" className={styles.add} onClick={() => drinks.add(drink.id)}>
                  {t('add_ingredient')}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
