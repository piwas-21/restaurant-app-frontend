'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import ProductStatusFields from '@/components/admin/product/fields/ProductStatusFields';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import { getProductCompleteness } from '@/lib/productCompleteness';
import EditorSideRail from './EditorSideRail';
import { optionSetKindsForSection } from './editorOptionSetKinds';

const EditorOptionSetPicker = dynamic(() => import('./EditorOptionSetPicker'), { ssr: false });

interface Props {
  readonly editor: ReturnType<typeof useProductEditorForm>;
  readonly product: ProductDetails;
  readonly isBundle: boolean;
  readonly isCreate: boolean;
  readonly activeSectionId: string;
  readonly onApplied: () => void;
}

export default function EditorContextRail({ editor, product, isBundle, isCreate, activeSectionId, onApplied }: Props) {
  const kinds = optionSetKindsForSection(isBundle, activeSectionId);
  const savedItem = !isBundle && !isCreate;
  const completeness = savedItem
    ? getProductCompleteness({
        photoCount: product.images?.length ?? 0,
        description: editor.form.watch('description'),
      })
    : undefined;
  const categoryName = editor.categories.find((category) => category.id === editor.primaryCategoryId)?.name;
  return (
    <EditorSideRail
      optionSets={
        kinds && (
          <EditorOptionSetPicker
            editor={editor}
            isBundle={isBundle}
            kinds={kinds}
            product={isCreate ? undefined : product}
            isDirty={editor.isDirty}
            onApplied={onApplied}
          />
        )
      }
      status={!isBundle && <ProductStatusFields register={editor.form.register} />}
      basePrice={editor.basePrice}
      categoryName={categoryName}
      inheritsOrderTypes={(editor.form.watch('availableOrderTypes') ?? null) === null}
      photoCount={product.images?.length ?? 0}
      showCategory={!isBundle}
      showPhotos={savedItem}
      completeness={completeness}
    />
  );
}
