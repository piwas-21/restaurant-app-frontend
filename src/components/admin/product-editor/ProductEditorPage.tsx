'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import ProductStatusFields from '@/components/admin/product/fields/ProductStatusFields';
import EditorShell from './EditorShell';
import EditorErrorSummary from './EditorErrorSummary';
import EditorSideRail from './EditorSideRail';
import { buildEditorSections, buildTranslationsPanel } from './editorSections';
import { productHeaderBadges, productHeaderMenuActions } from './productEditorHeader';
import { useEditorErrors } from '@/hooks/admin/useEditorErrors';
import styles from './ProductEditorPage.module.css';
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
  readonly onDelete?: () => void;
  readonly onBack: () => void;
}

/**
 * The unified admin product editor (menu-bundles redesign #176 slice 7; re-shelled by
 * MENU-ITEM-EDITOR-REDESIGN-PLAN slice S1).
 *
 * One page-level Save over one write path (owner call, plan §7) — this is what retired the modals'
 * forms AND the self-saving detail tables' second write path. S1 makes that literally true: the
 * duplicate header Save is GONE (decision D4). It existed only because the page was too long to
 * scroll, and the sticky section nav plus the sticky bar solve that properly.
 *
 * Type is a derived BADGE, never a chooser on an existing product: the backend has no item↔bundle
 * migration (a bundle needs a MenuDefinition), so offering the control would promise a failure.
 *
 * The sections live in `editorSections.tsx`, re-grouped into §4's seven by S2 — Basics · Media ·
 * Pricing & variations · Options & sides · Recipe & dietary · Service & availability · Advanced,
 * the last being the only one that collapses (D1).
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
  const [activeTab, setActiveTab] = useState<string>(TAB_ITEM);
  // D13's error surface: how many fields are wrong, which sections hold them, where the first is.
  const validation = useEditorErrors({
    errors,
    t,
    setActiveTab,
    itemTabId: TAB_ITEM,
    translationsTabId: TAB_TRANSLATIONS,
  });

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

  const context = { editor, t, product, isCreate, isBundle };
  const primaryCategoryName = editor.categories.find((category) => category.id === editor.primaryCategoryId)?.name;
  // `watch` so the header badge follows the rail's switch live. A bundle's flag is registered by
  // `BundlePanel` under the same name, so one read serves both.
  const isLive = Boolean(form.watch('isActive'));

  return (
    <>
      <EditorShell
        title={pageTitle}
        backLabel={t('editor_back_to_menu')}
        backAriaLabel={t('editor_back_to_menu_label')}
        onBack={handleBack}
        headerBadges={productHeaderBadges({ t, isBundle, isCreate, typeLabel, isLive })}
        headerMenuActions={productHeaderMenuActions({ t, isBundle, isCreate, onDelete })}
        headerMenuLabel={t('editor_more_actions')}
        tabs={[
          { id: TAB_ITEM, label: t('item') },
          { id: TAB_TRANSLATIONS, label: t('editor_tab_translations') },
        ]}
        tabsLabel={t('editor_tabs')}
        activeTabId={activeTab}
        onTabChange={setActiveTab}
        sections={validation.decorate(buildEditorSections(context))}
        sectionsLabel={t('editor_sections')}
        formId={FORM_ID}
        onSubmit={editor.onSubmit}
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
            showPhotos={!isBundle && !isCreate}
          />
        }
        saveBar={
          /* The one and only commit point (D4). Accented when dirty. */
          <div className={`${styles.saveBar} ${editor.isDirty ? styles.saveBarDirty : ''}`}>
            {/* D13's summary. It sits on the leading edge of the bar, where the approved screen
                draws it, and is the only control that knows where the first problem is. */}
            <EditorErrorSummary count={validation.count} label={validation.label} onJump={validation.jumpToFirst} />
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
            <button
              type="submit"
              form={FORM_ID}
              data-testid="editor-save"
              className={modalStyles.submitButton}
              disabled={saveDisabled}
            >
              {editor.isSubmitting ? t('saving') : saveLabel}
            </button>
          </div>
        }
      />

      <ConfirmationModal
        isOpen={isDiscardOpen}
        onClose={() => setIsDiscardOpen(false)}
        onConfirm={() => {
          setIsDiscardOpen(false);
          onBack();
        }}
        message={t('discard_unsaved_changes_message')}
      />
    </>
  );
}
