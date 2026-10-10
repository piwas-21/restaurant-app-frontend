'use client';

import { useTranslation } from 'react-i18next';
import type { OrderItemDto } from '@/types/order';
import { receiptItems, receiptItemName, quantityScopeSuffix } from '@/utils/templates/receiptPresentation';
import { customizedIngredientRows } from '@/utils/templates/receiptHtml';
import { displaySpecialInstructions } from '@/utils/orderItemDisplay';
import styles from './ReceiptItemDetails.module.css';

/** Receipt details use frozen ownership and counts, and never create component charges. */
export default function ReceiptItemDetails({
  item,
  hideInstructions = false,
}: Readonly<{ item: OrderItemDto; hideInstructions?: boolean }>) {
  const { t } = useTranslation();
  const translate = (key: string, fallback: string) => t(key, { defaultValue: fallback });
  const instructions = hideInstructions ? undefined : displaySpecialInstructions(item);
  const children = receiptItems(item.sideItems ?? []);
  const required = children.filter((child) => child.compositionRole === 'RequiredChoice');
  const remaining = children.filter((child) => child.compositionRole !== 'RequiredChoice');
  const ingredients = customizedIngredientRows(item);
  const renderChildren = (rows: OrderItemDto[]) =>
    rows.length > 0 && (
      <ul className={styles.children}>
        {rows.map((child) => (
          <li key={child.id}>
            {child.compositionRole === 'Dish' ? (
              <strong dir="auto">
                {child.quantity}× <span dir="auto">{receiptItemName(child, t('item'))}</span>
                {quantityScopeSuffix(child, item.quantity, translate)}
              </strong>
            ) : (
              <span dir="auto">
                {child.quantity}× <span dir="auto">{receiptItemName(child, t('item'))}</span>
                {quantityScopeSuffix(child, item.quantity, translate)}
              </span>
            )}
            <ReceiptItemDetails item={child} />
          </li>
        ))}
      </ul>
    );
  return (
    <div className={styles.details}>
      {renderChildren(required)}
      {ingredients.length > 0 && (
        <ul className={styles.ingredients}>
          {ingredients.map((ingredient, occurrence) => (
            <li key={`${ingredient.ingredientId}:${occurrence}`}>
              <strong>
                {ingredient.isRemoved ? t('removed_ingredients', 'Removed') : t('receipt.extras', 'Extras')}:{' '}
              </strong>
              <span dir="auto">{ingredient.ingredientName}</span>
              {!ingredient.isRemoved && (
                <>
                  {ingredient.quantity > 1 ? ` ×${ingredient.quantity}` : ''}
                  {quantityScopeSuffix(ingredient, item.quantity, translate)}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {renderChildren(remaining)}
      {instructions && (
        <p dir="auto" className={styles.note}>
          {instructions}
        </p>
      )}
    </div>
  );
}
