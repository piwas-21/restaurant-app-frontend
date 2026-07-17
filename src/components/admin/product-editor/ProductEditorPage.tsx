'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import PageHeader from '@/components/admin/PageHeader';
import { ProductBasicInfo } from '@/components/admin/product/ProductBasicInfo';
import { ProductDetails as ProductDetailsFields } from '@/components/admin/product/ProductDetails';
import { MultilingualContent } from '@/components/admin/product/MultilingualContent';
import { ProductVariations } from '@/components/admin/product/ProductVariations';
import { SuggestedSideItemsPicker } from '@/components/admin/product/SuggestedSideItemsPicker';
import { ProductIngredientsManager } from '@/components/admin/product/ProductIngredientsManager';
import { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import BundlePanel from './BundlePanel';
import styles from './ProductEditorPage.module.css';
import adminStyles from '@/app/styles/AdminPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

interface ProductEditorPageProps {
  // readonly: S6759 — component props are never mutated.
  readonly product: ProductDetails;
  readonly isBundle: boolean;
  readonly onSaved: () => void;
  readonly onDelete: () => void;
  readonly onBack: () => void;
}

/**
 * The unified admin product editor (menu-bundles redesign #176, slice 7 PR2d).
 *
 * One page-level Save over one write path (owner call, plan §7) — this is what retires the
 * modal's form AND the self-saving detail tables' second write path. Type is a derived
 * BADGE, never a chooser: the backend has no item↔bundle migration (a bundle needs a
 * MenuDefinition), so offering the control would promise a failure.
 */
export default function ProductEditorPage({ product, isBundle, onSaved, onDelete, onBack }: ProductEditorPageProps) {
  const { t } = useTranslation();
  const editor = useProductEditorForm({ product, isBundle, onSaved });
  const { form } = editor;
  const { errors } = form.formState;
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  const typeLabel = isBundle ? t('product_type_menu') : t(`product_type_${product.type || 'mainItem'}`);

  // Guard the one exit that discards silently. Save is already gated on isDirty, so the only
  // way to lose work is leaving with pending edits — confirm before that. (Full beforeunload /
  // route interception is a follow-up; this closes the in-page path.)
  const handleBack = () => {
    if (editor.isDirty) {
      setIsDiscardOpen(true);
    } else {
      onBack();
    }
  };

  return (
    <div className={adminStyles.adminContainer}>
      <PageHeader title={product.name}>
        <div className={adminStyles.pageActions}>
          <span data-testid="product-type-badge">
            <StatusBadge tone={isBundle ? 'info' : 'neutral'}>{typeLabel}</StatusBadge>
          </span>
          <button type="button" className={`${adminStyles.adminButton} ${adminStyles.delete}`} onClick={onDelete}>
            {isBundle ? t('delete_menu_bundle') : t('delete_product')}
          </button>
        </div>
      </PageHeader>

      <form onSubmit={editor.onSubmit} className={adminStyles.adminContent}>
        {errors.root && <p className={modalStyles.errorMessage}>{errors.root.message}</p>}

        {isBundle ? (
          <BundlePanel
            register={form.register}
            errors={errors}
            menuDefinition={editor.menuDefinition}
            onChange={editor.changeMenuDefinition}
            imageFiles={editor.imageFiles}
            setImageFiles={editor.setImageFiles}
          />
        ) : (
          <>
            <div className={modalStyles.formGrid}>
              <ProductBasicInfo
                register={form.register}
                errors={errors}
                categories={editor.categories}
                selectedCategoryIds={editor.selectedCategoryIds}
                control={form.control}
              />
              <ProductDetailsFields
                register={form.register}
                errors={errors}
                control={form.control}
                imageFiles={editor.imageFiles}
                setImageFiles={editor.setImageFiles}
                existingImages={product.images || []}
              />
            </div>

            <ProductVariations
              register={form.register}
              errors={errors}
              variationFields={editor.variations.fields}
              appendVariation={editor.variations.append}
              removeVariation={editor.variations.remove}
            />

            <SuggestedSideItemsPicker
              control={form.control}
              errors={errors}
              selectedSideItemIds={editor.selectedSideItemIds}
              onChange={editor.changeSideItemIds}
            />

            <ProductIngredientsManager
              ingredients={editor.detailedIngredients}
              onChange={editor.changeIngredients}
              productBasePrice={editor.basePrice}
            />
          </>
        )}

        {/* Shared by both kinds — a bundle has translations too. */}
        <section className={styles.panel}>
          <MultilingualContent
            register={form.register}
            errors={errors}
            control={form.control}
            contentFields={editor.content.fields}
            appendContent={editor.content.append}
            removeContent={editor.content.remove}
            watch={form.watch}
            currentLanguage={editor.currentLanguage}
          />
        </section>

        {/* The ONLY commit point on this screen. */}
        <div className={styles.saveBar}>
          <span className={styles.saveHint} aria-live="polite">
            {editor.isDirty ? t('unsaved_changes') : ''}
          </span>
          <button
            type="button"
            className={modalStyles.cancelButton}
            onClick={handleBack}
            disabled={editor.isSubmitting}
          >
            {t('back')}
          </button>
          <button type="submit" className={modalStyles.submitButton} disabled={editor.isSubmitting || !editor.isDirty}>
            {editor.isSubmitting ? t('saving') : t('save_changes')}
          </button>
        </div>
      </form>

      <ConfirmationModal
        isOpen={isDiscardOpen}
        onClose={() => setIsDiscardOpen(false)}
        onConfirm={() => {
          setIsDiscardOpen(false);
          onBack();
        }}
        message={t('discard_unsaved_changes_message')}
      />
    </div>
  );
}
