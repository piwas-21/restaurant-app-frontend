'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { MenuVersionPrefill } from '@/utils/quickMenuVersionPayload';
import EditorShell from './EditorShell';
import EditorSaveBar from './EditorSaveBar';
import EditorContextRail from './EditorContextRail';
import EditorPreSaveReview from './EditorPreSaveReview';
import { buildEditorSections, buildTranslationsPanel } from './editorSections';
import { productHeaderBadges, productHeaderMenuActions } from './productEditorHeader';
import { useEditorErrors } from '@/hooks/admin/useEditorErrors';
import { useEditorSectionNav } from '@/hooks/admin/useEditorSectionNav';
import { useEditorPreSaveReview } from '@/hooks/admin/useEditorPreSaveReview';
import { useEditorTranslationReview } from '@/hooks/admin/useEditorTranslationReview';
import { useEditorNavigationGuard } from '@/hooks/admin/useEditorNavigationGuard';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
// The sticky Save bar sits outside the form and submits through this HTML form ID.
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
  const [translationReviewOpen, setTranslationReviewOpen] = useState(false);

  const isCreate = mode === 'create';
  const typeLabel = isBundle ? t('product_type_menu') : t(`product_type_${product.type || 'mainItem'}`);
  const createTitle = isBundle ? t('create_new_menu_bundle') : t('create_new_product');
  const createLabel = isBundle ? t('create_menu_bundle') : t('create_product');
  const pageTitle = isCreate ? createTitle : product.name;
  const saveLabel = isCreate ? createLabel : t('save_changes');
  // Create may submit its empty form; edits require a deliberate change.
  const saveDisabled = editor.isSubmitting || (!isCreate && !editor.isDirty);

  const navigation = useEditorNavigationGuard({
    isDirty: editor.isDirty,
    onBack,
    onOfferCreateRequested,
    onDelete,
    onNavigate,
  });

  const preSaveReview = useEditorPreSaveReview({ formId: FORM_ID, onSubmit: editor.onSubmit });
  const translationReview = useEditorTranslationReview({
    editor,
    product,
    productId: product.id,
    isOpen: preSaveReview.isOpen || translationReviewOpen,
  });
  const context = {
    editor,
    t,
    product,
    isCreate,
    isBundle,
    sourceLocaleFor: translationReview.sourceLocaleFor,
    sourceLocaleKnownFor: translationReview.sourceLocaleKnownFor,
    onSourceLocaleChange: translationReview.setSourceLocaleFor,
    onOfferCreateRequested: navigation.handleOfferCreate,
    onNavigate: navigation.handleOfferNavigate,
  };
  const sections = buildEditorSections(context);
  const sectionNav = useEditorSectionNav(sections.map((section) => section.id));
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
        translations={buildTranslationsPanel(context, {
          review: translationReview,
          isOpen: translationReviewOpen,
          onToggle: () => setTranslationReviewOpen((open) => !open),
          onApply: async () => {
            if (await translationReview.submitDecisions()) setTranslationReviewOpen(false);
          },
        })}
        rail={
          <EditorContextRail
            editor={editor}
            product={product}
            isBundle={isBundle}
            isCreate={isCreate}
            activeSectionId={sectionNav.activeId}
            onApplied={onSaved}
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
        onConfirm={() => {
          editor.setTranslationMetadata(translationReview.buildMetadataPatch());
          preSaveReview.confirm();
        }}
        isPending={editor.isSubmitting}
        isBundle={isBundle}
        productId={product.id}
        savedAllergens={product.allergens}
        editor={editor}
        translationReview={translationReview}
      />
    </>
  );
}
