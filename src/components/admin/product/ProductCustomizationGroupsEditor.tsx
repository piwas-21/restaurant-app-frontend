'use client';

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import CustomizationGroupEditor from './CustomizationGroupEditor';
import { useCustomizationProductOptions } from '@/hooks/admin/useCustomizationProductOptions';
import type { ProductIngredient } from '@/app/admin/menu-management/interfaces';
import type { ProductCustomizationGroupDraft } from '@/types/menu';
import styles from './ProductCustomizationGroupsEditor.module.css';

interface Props {
  groups: ProductCustomizationGroupDraft[];
  ingredients: ProductIngredient[];
  productId: string;
  currentLanguage: string;
  onChange: (groups: ProductCustomizationGroupDraft[]) => void;
}

export default function ProductCustomizationGroupsEditor({
  groups,
  ingredients,
  productId,
  currentLanguage,
  onChange,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const [productQuery, setProductQuery] = useState('');
  const { products, isLoading, hasError } = useCustomizationProductOptions(productId, groups.length > 0, productQuery);
  const replace = (index: number, group: ProductCustomizationGroupDraft) =>
    onChange(groups.map((candidate, candidateIndex) => (candidateIndex === index ? group : candidate)));
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= groups.length) return;
    const next = [...groups];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((group, displayOrder) => ({ ...group, displayOrder })));
  };

  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <h3>{t('customization_groups')}</h3>
          <p>{t('customization_groups_help')}</p>
        </div>
        <button type="button" onClick={() => onChange([...groups, emptyGroup(groups.length)])}>
          {t('add_customization_group')}
        </button>
      </div>
      {groups.length > 0 && (
        <label className={styles.search}>
          {t('search_products')}
          <input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} />
        </label>
      )}
      {isLoading && <p className={styles.status}>{t('loading')}…</p>}
      {hasError && (
        <p className={styles.error} role="alert">
          {t('customization_products_load_failed')}
        </p>
      )}
      {groups.map((group, index) => (
        <CustomizationGroupEditor
          key={group.id || `new-${index}`}
          group={group}
          ingredients={ingredients}
          products={products}
          currentLanguage={currentLanguage}
          onChange={(next) => replace(index, next)}
          onRemove={() => onChange(groups.filter((_, candidateIndex) => candidateIndex !== index))}
          onMoveUp={() => move(index, -1)}
          onMoveDown={() => move(index, 1)}
          canMoveUp={index > 0}
          canMoveDown={index < groups.length - 1}
        />
      ))}
    </section>
  );
}

function emptyGroup(displayOrder: number): ProductCustomizationGroupDraft {
  return {
    name: '',
    displayOrder,
    isRequired: false,
    minSelection: 0,
    maxSelection: 1,
    includedFreeUnits: 0,
    isActive: true,
    content: {},
    ingredientOptions: [],
    productOptions: [],
  };
}
