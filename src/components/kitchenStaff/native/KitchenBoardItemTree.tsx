import { useTranslation } from 'react-i18next';
import type { KitchenBoardItem } from '@/types/kitchenBoard';
import styles from './KitchenBoardItemTree.module.css';

function ItemNode({ item }: Readonly<{ item: KitchenBoardItem }>) {
  const { t } = useTranslation();
  const title = [item.productName, item.variationName].filter(Boolean).join(' · ');

  return (
    <li className={styles.item}>
      <div className={styles.itemHeading}>
        <span className={styles.quantity}>{item.quantity}×</span>
        <strong dir="auto">{title}</strong>
        {item.kind && (
          <span className={styles.kind}>
            {t(`nativeKitchenBoard.itemKind.${item.kind}`, { defaultValue: item.kind })}
          </span>
        )}
      </div>
      {item.specialInstructions && <p className={styles.instructions}>{item.specialInstructions}</p>}
      {item.ingredients.length > 0 && (
        <ul className={styles.ingredients} aria-label={t('nativeKitchenBoard.ingredients')}>
          {item.ingredients.map((ingredient) => (
            <li key={ingredient.ingredientId} data-removed={ingredient.isRemoved || undefined}>
              {ingredient.isRemoved ? '− ' : ingredient.isAddOn ? '+ ' : ''}
              {ingredient.ingredientName}
              {ingredient.quantity !== 1 && <span> · {ingredient.quantity}×</span>}
            </li>
          ))}
        </ul>
      )}
      {item.children.length > 0 && (
        <ul className={styles.children}>
          {item.children.map((child) => (
            <ItemNode key={child.itemId} item={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function KitchenBoardItemTree({ items }: Readonly<{ items: readonly KitchenBoardItem[] }>) {
  const { t } = useTranslation();
  if (items.length === 0) return <p className={styles.noItems}>{t('nativeKitchenBoard.noItems')}</p>;
  return (
    <ul className={styles.items}>
      {items.map((item) => (
        <ItemNode key={item.itemId} item={item} />
      ))}
    </ul>
  );
}
