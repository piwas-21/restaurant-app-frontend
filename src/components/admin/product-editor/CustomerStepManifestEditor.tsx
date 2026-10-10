'use client';

import { useMemo } from 'react';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { Variation } from '@/app/admin/menu-management/interfaces';
import type { CustomerStepManifest, MenuSection } from '@/types/menu';
import type { EditorSectionsContext } from './editorSectionTypes';
import CustomerFlowPhonePreview from './CustomerFlowPhonePreview';
import CustomerStepOrderList from './CustomerStepOrderList';
import {
  buildCustomerProductSteps,
  buildMixedBundleSteps,
  inspectCustomerStepManifest,
} from '@/utils/customerStepPlanner';
import { buildGuestDefaultBundleSelection } from '@/utils/bundleSelection';
import { groupCustomerStepScreens, makeCustomerStepManifest, customerStepRefKey } from '@/utils/customerStepManifest';
import {
  changeBundleSectionParent,
  changeCustomerScreenLabel,
  changeCustomerScreenRole,
  completeCustomerManifestForEditor,
  reorderCustomerScreens,
} from '@/utils/customerStepEditor';
import { bundleLineUnitPrice } from '@/utils/linePrice';
import { localizedMenuSection } from '@/utils/localizedContent';
import { isPersistedMenuId } from '@/utils/menuSectionDraft';
import { getDefaultSteps, toPreviewProduct } from './customerStepManifestEditor.helpers';
import styles from './CustomerStepManifestEditor.module.css';

const EMPTY_SECTIONS: MenuSection[] = [];

/** Admin authoring for the manifest shared by the guest planner and saved read-side DTO. */
export default function CustomerStepManifestEditor({ product, isBundle, isCreate, editor }: EditorSectionsContext) {
  const { t, i18n } = useTranslation();
  const currentLanguage = (i18n.language || 'en').split('-')[0];
  const sections = useMemo(
    () =>
      isBundle
        ? editor.menuDefinition.sections.map((section) => localizedMenuSection(section, currentLanguage))
        : EMPTY_SECTIONS,
    [editor.menuDefinition.sections, isBundle, currentLanguage],
  );
  const watchedVariations = editor.form.watch('variations') as Variation[] | undefined;
  const variations = useMemo(
    () => watchedVariations ?? product.variations ?? [],
    [watchedVariations, product.variations],
  );
  const productName = String(editor.form.watch('name') ?? product.name);
  const hideBaseProduct = Boolean(editor.form.watch('hideBaseProduct') ?? product.hideBaseProduct);
  const defaults = useMemo(
    () =>
      getDefaultSteps({
        product,
        isBundle,
        sections,
        detailedIngredients: editor.detailedIngredients,
        customizationGroups: editor.customizationGroups,
        variations,
        hideBaseProduct,
      }),
    [product, isBundle, sections, editor.detailedIngredients, editor.customizationGroups, variations, hideBaseProduct],
  );
  const revision = editor.customerStepManifest?.revision ?? product.customerStepManifest?.revision ?? 0;
  const hasCustomDraft = Boolean(editor.customerStepManifest?.steps.length);
  const effective = useMemo(() => {
    const source =
      hasCustomDraft && editor.customerStepManifest
        ? editor.customerStepManifest
        : makeCustomerStepManifest(revision, defaults.steps);
    return completeCustomerManifestForEditor(source, defaults.steps);
  }, [defaults.steps, editor.customerStepManifest, hasCustomDraft, revision]);
  const screens = groupCustomerStepScreens(effective);
  const knownRefs = new Set(defaults.steps.map(customerStepRefKey));
  const hasStaleRefs =
    hasCustomDraft &&
    editor.customerStepManifest?.steps.some((step) => !knownRefs.has(customerStepRefKey(step))) === true;
  const saved =
    Boolean(product.id) &&
    !isCreate &&
    (!isBundle ||
      sections.every(
        (section) => isPersistedMenuId(section.id) && section.items.every((item) => isPersistedMenuId(item.id)),
      ));
  const canEdit = saved && defaults.steps.length > 0;

  const previewProduct = useMemo(
    () =>
      toPreviewProduct(
        product,
        {
          customerStepManifest: editor.customerStepManifest,
          basePrice: editor.basePrice,
          detailedIngredients: editor.detailedIngredients,
          customizationGroups: editor.customizationGroups,
        },
        variations,
        productName,
        hideBaseProduct,
      ),
    [
      product,
      editor.customerStepManifest,
      editor.detailedIngredients,
      editor.customizationGroups,
      editor.basePrice,
      variations,
      productName,
      hideBaseProduct,
    ],
  );
  const manifestIssues =
    hasCustomDraft && editor.customerStepManifest
      ? inspectCustomerStepManifest(isBundle, previewProduct, sections, editor.customerStepManifest)
      : [];
  const invalid = hasStaleRefs || manifestIssues.length > 0;
  const planManifest = hasCustomDraft && !invalid ? editor.customerStepManifest : null;
  const previewSelections = isBundle ? buildGuestDefaultBundleSelection(sections, planManifest) : [];
  const steps = isBundle
    ? buildMixedBundleSteps(sections, planManifest, previewSelections)
    : buildCustomerProductSteps(previewProduct, false, planManifest);
  const price = isBundle
    ? bundleLineUnitPrice({ basePrice: editor.basePrice, sections, selectedOptions: previewSelections })
    : editor.basePrice;
  const unsupported = defaults.unsupported;

  const update = (manifest: CustomerStepManifest | null) => editor.changeCustomerStepManifest(manifest);
  const move = (screenId: string, targetIndex: number) => {
    const next = reorderCustomerScreens(effective, screenId, targetIndex, sections);
    if (next) update(next);
  };
  const setParent = (sectionId: string, parentId: string | null) => {
    const next = changeBundleSectionParent(effective, sectionId, parentId, sections);
    if (next) update(next);
  };
  const reset = () => {
    update(
      product.customerStepManifest?.steps.length
        ? makeCustomerStepManifest(product.customerStepManifest.revision, [])
        : null,
    );
  };

  return (
    <div className={styles.editor}>
      <div className={styles.intro}>
        <div>
          <p>{t('customer_flow_intro')}</p>
          <p className={styles.note}>{t('customer_flow_scope_note')}</p>
        </div>
        {hasCustomDraft && (
          <StatusBadge tone={editor.isDirty ? 'warning' : 'info'}>{t('customer_flow_customized')}</StatusBadge>
        )}
      </div>
      {!canEdit && <StatusBadge tone="warning">{t('customer_flow_save_first')}</StatusBadge>}
      {unsupported > 0 && (
        <StatusBadge tone="warning">{t('customer_flow_unsupported_rows', { count: unsupported })}</StatusBadge>
      )}
      {invalid && (
        <p className={styles.error} role="alert">
          {t('customer_flow_stale_manifest')}
        </p>
      )}
      <div className={styles.workspace}>
        <section className={styles.order} aria-labelledby="customer-step-order-title">
          <div className={styles.orderHeader}>
            <h3 id="customer-step-order-title">{t('customer_step_order')}</h3>
            <button type="button" className={styles.reset} disabled={!canEdit || !hasCustomDraft} onClick={reset}>
              <RotateCcw size={16} aria-hidden="true" />
              {t('customer_flow_reset')}
            </button>
          </div>
          {screens.length === 0 ? (
            <p className={styles.empty}>{t('customer_flow_no_screens')}</p>
          ) : (
            <CustomerStepOrderList
              manifest={effective}
              sections={sections}
              product={product}
              isBundle={isBundle}
              disabled={!canEdit || invalid}
              invalid={invalid}
              onMove={move}
              onRoleChange={(screen, role) => update(changeCustomerScreenRole(effective, screen, role, sections))}
              onLabelChange={(screen, label) => update(changeCustomerScreenLabel(effective, screen, label))}
              onSectionParentChange={setParent}
              t={t}
            />
          )}
        </section>
        <section className={styles.preview} aria-labelledby="customer-flow-preview-title">
          <div className={styles.previewHead}>
            <div>
              <h3 id="customer-flow-preview-title">{t('customer_preview_title')}</h3>
              <p>{t('customer_preview_default_path')}</p>
            </div>
          </div>
          <CustomerFlowPhonePreview
            steps={steps}
            price={price}
            itemName={productName}
            isBundle={isBundle}
            product={previewProduct}
          />
          {isBundle && <p className={styles.quoteNote}>{t('customer_flow_quote_reused')}</p>}
        </section>
      </div>
      <output className={styles.revision} aria-live="polite">
        {t('customer_flow_revision', { revision })}
      </output>
    </div>
  );
}
