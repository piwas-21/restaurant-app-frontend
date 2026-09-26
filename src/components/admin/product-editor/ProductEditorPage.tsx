'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import { getProductCompleteness } from '@/lib/productCompleteness';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { MenuVersionPrefill } from '@/utils/quickMenuVersionPayload';
import ProductStatusFields from '@/components/admin/product/fields/ProductStatusFields';
import EditorShell from './EditorShell';
import EditorSaveBar from './EditorSaveBar';
import EditorSideRail from './EditorSideRail';
import EditorPreSaveReview from './EditorPreSaveReview';
import { buildEditorSections, buildTranslationsPanel } from './editorSections';
import { productHeaderBadges, productHeaderMenuActions } from './productEditorHeader';
import { useEditorErrors } from '@/hooks/admin/useEditorErrors';
import { useEditorSectionNav } from '@/hooks/admin/useEditorSectionNav';
import { useEditorPreSaveReview } from '@/hooks/admin/useEditorPreSaveReview';
import { useEditorNavigationGuard } from '@/hooks/admin/useEditorNavigationGuard';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';

// The one Save lives in the sticky bar, which is a SIBLING of the form (it spans nav, main and
// rail). HTML form-attribute association is what still submits the form from there.
const FORM_ID = 'product-editor-form';

const TAB_ITEM = 'item';
const TAB_TRANSLATIONS = 'translations';

interface ProductEditorPageProps {
  // readonly: S6759 — component props are never mutated.
  readonly product: ProductDetails;
  readonly isBundle: boolean;
  /** `create` on the /new route (empty defaults → POST), `edit` on `[productId]` (→ PUT). */
  readonly mode?: 'create' | 'edit';
  readonly onSaved: () => void;
  /** Optional callback that routes a quick offer prefill to the full bundle editor. */
  readonly onOfferCreateRequested?: (prefill: MenuVersionPrefill) => void;
  readonly onDelete?: () => void;
  readonly onNavigate?: (href: string) => void;
  readonly onBack: () => void;
}

/** Unified item and bundle editor; focused sections share one form and one Save action. */
export default function ProductEditorPage({
  product,
  isBundle,
  mode = 'edit',
  onSaved,
  onOfferCreateRequested,
  onDelete,
  onNavigate,
  onBack,
}: ProductEditorPageProps) {
  const { t } = useTranslation();
  const editor = useProductEditorForm({ product, isBundle, mode, onSaved });
  const { form } = editor;
  const { errors, submitCount } = form.formState;
  const [activeTab, setActiveTab] = useState<string>(TAB_ITEM);

  const isCreate = mode === 'create';
  const typeLabel = isBundle ? t('product_type_menu') : t(`product_type_${product.type || 'mainItem'}`);
  const createTitle = isBundle ? t('create_new_menu_bundle') : t('create_new_product');
  const createLabel = isBundle ? t('create_menu_bundle') : t('create_product');
  const pageTitle = isCreate ? createTitle : product.name;
  const saveLabel = isCreate ? createLabel : t('save_changes');
  // Create starts from an empty form (nothing "dirty" yet) but must still be submittable —
  // the resolver blocks an incomplete one. Edit gates on isDirty so the commit is deliberate.
  const saveDisabled = editor.isSubmitting || (!isCreate && !editor.isDirty);

  const navigation = useEditorNavigationGuard({
    isDirty: editor.isDirty,
    onBack,
    onOfferCreateRequested,
    onDelete,
    onNavigate,
  });

  const context = {
    editor,
    t,
    product,
    isCreate,
    isBundle,
    onOfferCreateRequested: navigation.handleOfferCreate,
    onNavigate: navigation.handleOfferNavigate,
  };
  const sections = buildEditorSections(context);
  const sectionNav = useEditorSectionNav(sections.map((section) => section.id));
  const preSaveReview = useEditorPreSaveReview({ formId: FORM_ID, onSubmit: editor.onSubmit });
  // D13's error surface: how many fields are wrong, which sections hold them, where the first is.
  const validation = useEditorErrors({
    errors,
    submitCount,
    t,
    setActiveTab,
    setActiveSection: sectionNav.goTo,
    sections,
    isBundle,
    itemTabId: TAB_ITEM,
    translationsTabId: TAB_TRANSLATIONS,
  });
  const primaryCategoryName = editor.categories.find((category) => category.id === editor.primaryCategoryId)?.name;

  // S10's meter. Only a SAVED ITEM gets one — see `EditorSideRail`'s prop for why a bundle and the
  // create route get none. The description is WATCHED, not read off `product`, so typing one ticks
  // the row immediately; the photo count is the same `product.images` the "At a glance" row shows,
  // so the two can never disagree about the same item on the same screen.
  const isSavedItem = !isBundle && !isCreate;
  const completeness = isSavedItem
    ? getProductCompleteness({
        photoCount: product.images?.length ?? 0,
        description: form.watch('description'),
      })
    : undefined;
  // `watch` so the header badge follows the rail's switch live. A bundle's flag is registered by
  // `BundlePanel` under the same name, so one read serves both.
  const isLive = Boolean(form.watch('isActive'));

  return (
    <>
      <EditorShell
        title={pageTitle}
        backLabel={t('editor_back_to_menu')}
        backAriaLabel={t('editor_back_to_menu_label')}
        onBack={navigation.handleBack}
        headerBadges={productHeaderBadges({ t, isBundle, isCreate, typeLabel, isLive })}
        headerMenuActions={productHeaderMenuActions({
          t,
          isBundle,
          isCreate,
          onDelete: navigation.handleDelete,
        })}
        headerMenuLabel={t('editor_more_actions')}
        tabs={[
          { id: TAB_ITEM, label: t('item') },
          { id: TAB_TRANSLATIONS, label: t('editor_tab_translations') },
        ]}
        tabsLabel={t('editor_tabs')}
        activeTabId={activeTab}
        onTabChange={setActiveTab}
        sections={validation.decorate(sections)}
        sectionsLabel={t('editor_sections')}
        activeSectionId={sectionNav.activeId}
        onSectionChange={sectionNav.goTo}
        formId={FORM_ID}
        onSubmit={preSaveReview.handleSubmit}
        formError={errors.root && <p className={modalStyles.errorMessage}>{errors.root.message}</p>}
        translations={buildTranslationsPanel(context)}
        rail={
          <EditorSideRail
            // The three status flags left the old `Details` column for the rail (§4, S2). A bundle
            // keeps its own inside `BundlePanel`: `MenuBundleDto` is a different shape and S2 does
            // not restructure it.
            status={!isBundle && <ProductStatusFields register={form.register} />}
            basePrice={editor.basePrice}
            categoryName={primaryCategoryName}
            inheritsOrderTypes={(form.watch('availableOrderTypes') ?? null) === null}
            photoCount={product.images?.length ?? 0}
            showCategory={!isBundle}
            showPhotos={isSavedItem}
            completeness={completeness}
          />
        }
        saveBar={
          <EditorSaveBar
            formId={FORM_ID}
            isDirty={editor.isDirty}
            isSubmitting={editor.isSubmitting}
            saveDisabled={saveDisabled}
            saveLabel={saveLabel}
            errorCount={validation.count}
            errorLabel={validation.label}
            onJumpToError={validation.jumpToFirst}
            onBack={navigation.handleBack}
          />
        }
      />

      <ConfirmationModal
        isOpen={navigation.isDiscardOpen}
        onClose={navigation.closeDiscard}
        onConfirm={navigation.confirmDiscard}
        message={t('discard_unsaved_changes_message')}
      />
      <EditorPreSaveReview
        isOpen={preSaveReview.isOpen}
        onClose={preSaveReview.close}
        onConfirm={preSaveReview.confirm}
        isPending={editor.isSubmitting}
        isBundle={isBundle}
        editor={editor}
      />
    </>
  );
}
