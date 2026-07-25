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
import ImageGallery from './ImageGallery';
import styles from './ProductEditorPage.module.css';
import adminStyles from '@/app/styles/AdminPage.module.css';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

// Shared by the sticky bottom Save bar and the header Save button so the latter,
// which lives outside the <form>, still submits it (HTML form-attribute association).
const FORM_ID = 'product-editor-form';

interface ProductEditorPageProps {
  // readonly: S6759 — component props are never mutated.
  readonly product: ProductDetails;
  readonly isBundle: boolean;
  /** `create` on the /new route (empty defaults → POST), `edit` on `[productId]` (→ PUT). */
  readonly mode?: 'create' | 'edit';
  readonly onSaved: () => void;
  readonly onDelete?: () => void;
  readonly onBack: () => void;
}

/**
 * The unified admin product editor (menu-bundles redesign #176, slice 7).
 *
 * One page-level Save over one write path (owner call, plan §7) — this is what retires the
 * modals' forms AND the self-saving detail tables' second write path. Type is a derived
 * BADGE, never a chooser on an existing product: the backend has no item↔bundle migration
 * (a bundle needs a MenuDefinition), so offering the control would promise a failure. On the
 * create route the type is fixed by the entry choice; the same page just loads the kind's
 * fields and posts instead of putting.
 */
export default function ProductEditorPage({
  product,
  isBundle,
  mode = 'edit',
  onSaved,
  onDelete,
  onBack,
}: ProductEditorPageProps) {
  const { t } = useTranslation();
  const editor = useProductEditorForm({ product, isBundle, mode, onSaved });
  const { form } = editor;
  const { errors } = form.formState;
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);

  const isCreate = mode === 'create';
  const typeLabel = isBundle ? t('product_type_menu') : t(`product_type_${product.type || 'mainItem'}`);
  const createTitle = isBundle ? t('create_new_menu_bundle') : t('create_new_product');
  const createLabel = isBundle ? t('create_menu_bundle') : t('create_product');
  const pageTitle = isCreate ? createTitle : product.name;
  const saveLabel = isCreate ? createLabel : t('save_changes');
  // Create starts from an empty form (nothing "dirty" yet) but must still be submittable —
  // the resolver blocks an incomplete one. Edit gates on isDirty so the commit is deliberate.
  const saveDisabled = editor.isSubmitting || (!isCreate && !editor.isDirty);

  // Guard the one exit that discards silently. Save is gated on isDirty, so the only
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
      <PageHeader title={pageTitle}>
        <div className={adminStyles.pageActions}>
          <span data-testid="product-type-badge">
            <StatusBadge tone={isBundle ? 'info' : 'neutral'}>{typeLabel}</StatusBadge>
          </span>
          {!isCreate && onDelete && (
            <button type="button" className={`${adminStyles.adminButton} ${adminStyles.delete}`} onClick={onDelete}>
              {isBundle ? t('delete_menu_bundle') : t('delete_product')}
            </button>
          )}
          {/* A second Save at the top so it is reachable without scrolling the long editor.
              Submits the same form via the form attribute; gated identically to the bottom Save. */}
          <button
            type="submit"
            form={FORM_ID}
            data-testid="editor-save-top"
            className={modalStyles.submitButton}
            disabled={saveDisabled}
          >
            {editor.isSubmitting ? t('saving') : saveLabel}
          </button>
        </div>
      </PageHeader>

      <form id={FORM_ID} onSubmit={editor.onSubmit} className={adminStyles.adminContent}>
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

        {/* The primary commit point for the product's own fields. Accented when dirty. */}
        <div className={`${styles.saveBar} ${editor.isDirty ? styles.saveBarDirty : ''}`}>
          <span className={`${styles.saveHint} ${editor.isDirty ? styles.saveHintDirty : ''}`} aria-live="polite">
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
          <button type="submit" data-testid="editor-save" className={modalStyles.submitButton} disabled={saveDisabled}>
            {editor.isSubmitting ? t('saving') : saveLabel}
          </button>
        </div>
      </form>

      {/*
        Existing-image management lives OUTSIDE the form and only in edit mode: image
        sub-resources have their own endpoints and apply immediately (owner call — "immediate,
        no rival Save"). Outside the form because ConfirmationModal's buttons are type="submit"
        and would otherwise submit the product form. It self-manages its list (does NOT refetch
        the page product), so an image op cannot discard the form's unsaved edits. Bundles keep
        the file-input-only path they always had; a brand-new product has no images to manage.
      */}
      {!isCreate && !isBundle && (
        <ImageGallery productId={product.id} images={product.images || []} productName={product.name} />
      )}

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
