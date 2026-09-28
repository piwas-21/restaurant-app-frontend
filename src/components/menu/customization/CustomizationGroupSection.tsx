'use client';

import { useId } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEnabledOrderTypes } from '@/hooks/checkout/useEnabledOrderTypes';
import { formatPlainCurrency } from '@/utils/currency';
import {
  ingredientIdsForSelections,
  isCustomizationProductOptionOrderable,
  isCustomizationSelectionOrderable,
  selectionForGroup,
  updateGroupSelection,
} from '@/utils/explicitCustomization';
import { resolveChannelNotice } from '@/utils/channelNotice';
import { orderTypeListLabel } from '@/utils/orderTypeLabels';
import type {
  CustomizationGroupSelection,
  CustomizationOptionSelection,
  ProductCustomizationGroup,
  ProductCustomizationProductOption,
  ProductIngredient,
} from '@/types/menu';
import styles from './CustomizationGroupSection.module.css';

interface Props {
  group: ProductCustomizationGroup;
  groups: readonly ProductCustomizationGroup[];
  ingredients: readonly ProductIngredient[];
  selections: CustomizationGroupSelection[];
  onSelectionsChange: (selections: CustomizationGroupSelection[]) => void;
  onIngredientSelectionChange: (ids: string[]) => void;
  onIngredientQuantityChange: (id: string, quantity: number) => void;
  onChoice: () => void;
  currentLanguage: string;
}

export default function CustomizationGroupSection({
  group,
  groups,
  ingredients,
  selections,
  onSelectionsChange,
  onIngredientSelectionChange,
  onIngredientQuantityChange,
  onChoice,
  currentLanguage,
}: Readonly<Props>) {
  const domId = useId();
  const selected = selectionForGroup(selections, group.id).filter((option) =>
    isCustomizationSelectionOrderable(group, option),
  );
  const selectedKeys = new Set(selected.map(optionKey));
  const isSingle = group.maxSelection === 1;
  const isFull = selected.length >= group.maxSelection;
  const ingredientById = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));

  const commit = (nextOptions: CustomizationOptionSelection[]) => {
    const next = updateGroupSelection(selections, group.id, nextOptions);
    onSelectionsChange(next);
    onIngredientSelectionChange(ingredientIdsForSelections(groups, next));
    const selectedIngredientTargets = new Set(ingredientIdsForSelections(groups, next));
    group.ingredientOptions.forEach((membership) =>
      onIngredientQuantityChange(
        membership.productIngredientId,
        selectedIngredientTargets.has(membership.productIngredientId) ? 1 : 0,
      ),
    );
    if (isSingle && nextOptions.length === 1) onChoice();
  };

  const toggle = (option: CustomizationOptionSelection) => {
    if (!isCustomizationSelectionOrderable(group, option)) return;
    const key = optionKey(option);
    if (selectedKeys.has(key)) {
      commit(selected.filter((candidate) => optionKey(candidate) !== key).map(copySelection));
      return;
    }
    if (!isSingle && isFull) return;
    commit(isSingle ? [option] : [...selected.map(copySelection), option]);
  };

  const ingredientRows = group.ingredientOptions
    .map((membership) => ({ membership, ingredient: ingredientById.get(membership.productIngredientId) }))
    .filter((row): row is { membership: typeof row.membership; ingredient: ProductIngredient } =>
      Boolean(row.ingredient),
    )
    .sort((left, right) => left.membership.displayOrder - right.membership.displayOrder);
  const productRows = [...group.productOptions].sort((left, right) => left.displayOrder - right.displayOrder);

  return (
    <fieldset className={styles.group} aria-describedby={group.description ? `${domId}-description` : undefined}>
      {group.description && (
        <p id={`${domId}-description`} className={styles.description} dir="auto">
          {group.description}
        </p>
      )}
      <div className={styles.rows}>
        {ingredientRows.map(({ membership, ingredient }) => {
          const option = { kind: 0 as const, optionId: membership.id, quantity: 1 };
          return (
            <ChoiceRow
              key={`ingredient:${membership.id}`}
              inputType={isSingle ? 'radio' : 'checkbox'}
              inputName={`${domId}-choice`}
              label={localizedIngredientName(ingredient, currentLanguage)}
              price={ingredient.price}
              checked={selectedKeys.has(optionKey(option))}
              blocked={!selectedKeys.has(optionKey(option)) && isFull}
              onChange={() => toggle(option)}
            />
          );
        })}
        {productRows.map((membership) => {
          const option = { kind: 1 as const, optionId: membership.id, quantity: 1 };
          const orderable = isCustomizationProductOptionOrderable(membership);
          const isSelected = orderable && selectedKeys.has(optionKey(option));
          return (
            <ChoiceRow
              key={`product:${membership.id}`}
              inputType={isSingle ? 'radio' : 'checkbox'}
              inputName={`${domId}-choice`}
              label={membership.optionProductName}
              price={membership.additionalPrice}
              checked={isSelected}
              blocked={!isSelected && isFull}
              disabled={!orderable}
              reason={
                !orderable ? (
                  <ProductOptionAvailabilityReason option={membership} language={currentLanguage} />
                ) : undefined
              }
              onChange={() => toggle(option)}
            />
          );
        })}
      </div>
    </fieldset>
  );
}

function ChoiceRow({
  inputType,
  inputName,
  label,
  price,
  checked,
  blocked,
  disabled = false,
  reason,
  onChange,
}: Readonly<{
  inputType: 'radio' | 'checkbox';
  inputName: string;
  label: string;
  price: number;
  checked: boolean;
  blocked: boolean;
  disabled?: boolean;
  reason?: ReactNode;
  onChange: () => void;
}>) {
  return (
    <label className={`${styles.row} ${blocked || disabled ? styles.blocked : ''}`}>
      <input
        type={inputType}
        name={inputName}
        checked={checked}
        disabled={disabled}
        aria-disabled={blocked || disabled || undefined}
        onChange={onChange}
      />
      <span className={styles.name} dir="auto">
        {label}
        {reason}
      </span>
      {price > 0 && <span className={styles.price}>+{formatPlainCurrency(price)}</span>}
    </label>
  );
}

function ProductOptionAvailabilityReason({
  option,
  language,
}: Readonly<{ option: ProductCustomizationProductOption; language: string }>) {
  const availability = option.availability;
  if (
    option.optionProductIsActive === false ||
    option.optionProductIsAvailable === false ||
    availability?.reason !== 'WrongOrderType'
  ) {
    return <UnavailableReason />;
  }

  return <WrongOrderTypeReason availability={availability} language={language} />;
}

function UnavailableReason() {
  const { t } = useTranslation();
  return <span className={styles.optionReason}>{t('unavailable', 'Unavailable')}</span>;
}

function WrongOrderTypeReason({
  availability,
  language,
}: Readonly<{
  availability: NonNullable<ProductCustomizationProductOption['availability']>;
  language: string;
}>) {
  const { t } = useTranslation();
  const { enabled, loading } = useEnabledOrderTypes();
  const notice = resolveChannelNotice({
    allowed: availability.allowedOrderTypes,
    enabled,
    orderType: null,
    canOrder: availability.canOrder,
  });
  const orderable = loading ? [] : (notice?.orderable ?? []);
  const reason = orderable.length
    ? t('availability_only_for', { orderTypes: orderTypeListLabel(orderable, t, language) })
    : t('unavailable', 'Unavailable');

  return <span className={styles.optionReason}>{reason}</span>;
}

const optionKey = (option: CustomizationOptionSelection) => `${option.kind}:${option.optionId}`;
const copySelection = (option: CustomizationOptionSelection): CustomizationOptionSelection => ({ ...option });

function localizedIngredientName(ingredient: ProductIngredient, language: string): string {
  return ingredient.content?.[language]?.name || ingredient.content?.en?.name || ingredient.name;
}
