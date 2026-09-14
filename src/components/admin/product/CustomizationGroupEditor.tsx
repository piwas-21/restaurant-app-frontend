'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import FormField from '@/components/design-system/FormField';
import type { Product, ProductIngredient } from '@/app/admin/menu-management/interfaces';
import type { ProductCustomizationGroupDraft } from '@/types/menu';
import styles from './CustomizationGroupEditor.module.css';

interface Props {
  group: ProductCustomizationGroupDraft;
  ingredients: ProductIngredient[];
  products: Product[];
  currentLanguage: string;
  onChange: (group: ProductCustomizationGroupDraft) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

export default function CustomizationGroupEditor({
  group,
  ingredients,
  products,
  currentLanguage,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const [productId, setProductId] = useState('');
  const patch = (next: Partial<ProductCustomizationGroupDraft>) => onChange({ ...group, ...next });
  const patchText = (next: Pick<ProductCustomizationGroupDraft, 'name' | 'description'>) =>
    patch({
      ...next,
      content: {
        ...group.content,
        [currentLanguage]: {
          name: next.name ?? group.name,
          description: next.description ?? group.description ?? '',
        },
      },
    });
  const selectedIngredientIds = new Set(group.ingredientOptions.map((option) => option.productIngredientId));
  const toggleIngredient = (ingredientId: string, checked: boolean) => {
    const remaining = group.ingredientOptions.filter((option) => option.productIngredientId !== ingredientId);
    patch({
      ingredientOptions: checked
        ? [
            ...remaining,
            {
              productIngredientId: ingredientId,
              displayOrder: group.ingredientOptions.length,
              isDefault: false,
            },
          ]
        : remaining,
    });
  };
  const addProduct = () => {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product || group.productOptions.some((option) => option.optionProductId === product.id)) return;
    patch({
      productOptions: [
        ...group.productOptions,
        {
          optionProductId: product.id,
          optionProductName: product.name,
          additionalPrice: 0,
          displayOrder: group.productOptions.length,
          isDefault: false,
        },
      ],
    });
    setProductId('');
  };

  return (
    <article className={styles.card}>
      <div className={styles.actions}>
        <button type="button" onClick={onMoveUp} disabled={!canMoveUp} aria-label={t('move_up')}>
          ↑
        </button>
        <button type="button" onClick={onMoveDown} disabled={!canMoveDown} aria-label={t('move_down')}>
          ↓
        </button>
        <button type="button" onClick={onRemove}>
          {t('remove')}
        </button>
      </div>
      <div className={styles.grid}>
        <FormField label={t('name')}>
          <input
            value={group.name}
            onChange={(event) => patchText({ name: event.target.value, description: group.description })}
          />
        </FormField>
        <FormField label={t('description')}>
          <input
            value={group.description ?? ''}
            onChange={(event) => patchText({ name: group.name, description: event.target.value })}
          />
        </FormField>
        <FormField label={t('sauce_min_label')}>
          <input
            type="number"
            min={0}
            value={group.minSelection}
            onChange={(event) => patch({ minSelection: Number(event.target.value) })}
          />
        </FormField>
        <FormField label={t('sauce_max_label')}>
          <input
            type="number"
            min={1}
            value={group.maxSelection}
            onChange={(event) => patch({ maxSelection: Number(event.target.value) })}
          />
        </FormField>
        <FormField label={t('sauce_included_free_label')}>
          <input
            type="number"
            min={0}
            value={group.includedFreeUnits}
            onChange={(event) => patch({ includedFreeUnits: Number(event.target.value) })}
          />
        </FormField>
      </div>
      <div className={styles.switches}>
        <CheckboxField
          label={t('required')}
          checked={group.isRequired}
          onChange={(isRequired) => patch({ isRequired })}
        />
        <CheckboxField label={t('active')} checked={group.isActive} onChange={(isActive) => patch({ isActive })} />
      </div>
      <fieldset className={styles.options}>
        <legend>{t('customization_group_ingredients')}</legend>
        {ingredients.map((ingredient) => (
          <CheckboxField
            key={ingredient.id}
            label={ingredient.name}
            checked={selectedIngredientIds.has(ingredient.id)}
            onChange={(checked) => toggleIngredient(ingredient.id, checked)}
          />
        ))}
      </fieldset>
      <fieldset className={styles.options}>
        <legend>{t('customization_group_products')}</legend>
        <div className={styles.productPicker}>
          <select
            aria-label={t('select_product')}
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">{t('select_product')}</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={addProduct} disabled={!productId}>
            {t('add')}
          </button>
        </div>
        {group.productOptions.map((option, index) => (
          <div key={option.id || option.optionProductId} className={styles.productRow}>
            <span>{option.optionProductName}</span>
            <FormField label={t('price')} srOnlyLabel>
              <input
                type="number"
                step="0.01"
                min={0}
                value={option.additionalPrice}
                onChange={(event) =>
                  patch({
                    productOptions: group.productOptions.map((candidate, candidateIndex) =>
                      candidateIndex === index
                        ? { ...candidate, additionalPrice: Number(event.target.value) }
                        : candidate,
                    ),
                  })
                }
              />
            </FormField>
            <button
              type="button"
              onClick={() =>
                patch({ productOptions: group.productOptions.filter((_, candidateIndex) => candidateIndex !== index) })
              }
            >
              {t('remove')}
            </button>
          </div>
        ))}
      </fieldset>
    </article>
  );
}
