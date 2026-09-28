'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import type { ProductIngredient } from '@/app/admin/menu-management/interfaces';
import type { MenuDefinition } from '@/types/menu';
import type { useProductEditorForm } from '@/hooks/admin/useProductEditorForm';
import type { useEditorTranslationReview } from '@/hooks/admin/useEditorTranslationReview';
import { useBundleChoiceAvailabilityReview } from '@/hooks/admin/useBundleChoiceAvailabilityReview';
import { isStorableMask } from '@/utils/orderChannels';
import TranslationSuggestionsReview from './translations/TranslationSuggestionsReview';
import BundleGuestStepPreview from './BundleGuestStepPreview';
import { ORDER_TYPE_KEYS } from './bundlePriceQuoteUtils';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import styles from './EditorPreSaveReview.module.css';

interface EditorPreSaveReviewProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly isPending: boolean;
  readonly isBundle: boolean;
  readonly editor: ReturnType<typeof useProductEditorForm>;
  readonly translationReview: ReturnType<typeof useEditorTranslationReview>;
}

interface ReviewContentRow {
  readonly language: string;
  readonly name?: string;
}

function isContentRow(value: unknown): value is ReviewContentRow {
  return typeof value === 'object' && value !== null && 'language' in value && typeof value.language === 'string';
}

function contentRows(value: unknown): ReviewContentRow[] {
  return Array.isArray(value) ? value.filter(isContentRow) : [];
}

function missingNameLocaleCount(rows: readonly ReviewContentRow[]): number {
  const completed = new Set(rows.filter((row) => Boolean(row.name?.trim())).map((row) => row.language));
  return LANGUAGE_CODES.filter((locale) => !completed.has(locale)).length;
}

function ReviewLine({
  children,
  warning = false,
  role,
}: {
  readonly children: React.ReactNode;
  readonly warning?: boolean;
  readonly role?: 'alert' | 'status';
}) {
  return (
    <li className={warning ? styles.warning : styles.note} role={role}>
      {children}
    </li>
  );
}

/** Review current guest-facing rules and known gaps before the ordinary Save reaches the API. */
export default function EditorPreSaveReview({
  isOpen,
  onClose,
  onConfirm,
  isPending,
  isBundle,
  editor,
  translationReview,
}: EditorPreSaveReviewProps) {
  const { t } = useTranslation();
  const name = String(editor.form.getValues('name') ?? '');
  const price = Number(editor.form.getValues('basePrice') ?? 0);
  const isComponent = Boolean(editor.form.getValues('isComponent'));
  const allergens = editor.form.getValues('allergens');
  const rows = contentRows(editor.form.getValues('content'));
  const missingLocales = missingNameLocaleCount(rows);
  const variationsValue: unknown = editor.form.getValues('variations');
  const invalidVariationPriceCount = Array.isArray(variationsValue)
    ? variationsValue.filter((value) => {
        if (typeof value !== 'object' || value === null || !('priceModifier' in value)) return false;
        const modifier = Number(value.priceModifier);
        return Number.isFinite(modifier) && price + modifier < 0;
      }).length
    : 0;
  const inactiveIngredients = (editor.detailedIngredients as readonly ProductIngredient[]).filter(
    (ingredient) => !ingredient.isActive,
  ).length;
  const menuDefinition = editor.menuDefinition as MenuDefinition;
  const isActive = Boolean(editor.form.getValues('isActive'));
  const channelMaskValue: unknown = editor.form.getValues('availableOrderTypes');
  const isChannelMaskValid =
    channelMaskValue === null ||
    channelMaskValue === undefined ||
    (typeof channelMaskValue === 'number' && Number.isInteger(channelMaskValue) && isStorableMask(channelMaskValue));
  const channelMask =
    typeof channelMaskValue === 'number' && Number.isInteger(channelMaskValue) ? channelMaskValue : null;
  const choiceAvailability = useBundleChoiceAvailabilityReview({
    isOpen,
    isBundle,
    isActive,
    isChannelMaskValid,
    availableOrderTypes: channelMask,
    primaryCategoryId: editor.primaryCategoryId,
    categories: editor.categories,
    sections: menuDefinition.sections,
  });
  const shouldCheckChoiceAvailability =
    isBundle && isActive && menuDefinition.sections.some((section) => section.isRequired);
  const availabilityCheckPending =
    shouldCheckChoiceAvailability &&
    (choiceAvailability.state.status === 'idle' || choiceAvailability.state.status === 'loading');
  const availabilityAssessment =
    choiceAvailability.state.status === 'ready' ? choiceAvailability.state.assessment : undefined;
  const hasLinkedStandaloneOffer = Boolean(
    menuDefinition.parentOfferProductId || menuDefinition.parentOfferVariationId,
  );
  const confirmSave = async () => {
    if (translationReview.reviewWriteError) {
      onConfirm();
      return;
    }
    if (!(await translationReview.submitDecisions())) return;
    onConfirm();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('editor_review_title')}
      size="lg"
      isPending={isPending}
      footer={
        <div className={styles.actions}>
          <button type="button" className={modalStyles.cancelButton} onClick={onClose} disabled={isPending}>
            {t('cancel')}
          </button>
          <button
            type="button"
            className={modalStyles.submitButton}
            onClick={() => void confirmSave()}
            disabled={isPending || availabilityCheckPending}
            data-testid="editor-review-confirm-save"
          >
            {t(translationReview.reviewWriteError ? 'editor_review_save_without_suggestions' : 'editor_review_save')}
          </button>
        </div>
      }
    >
      <p className={styles.intro}>{t('editor_review_intro', { name })}</p>
      <div className={styles.paths}>
        <section>
          <h3>{t('editor_review_standalone_path')}</h3>
          <p>{isBundle ? t('editor_review_standalone_separate') : t('editor_review_standalone_summary')}</p>
          {!isBundle && editor.customizationGroups.length > 0 && (
            <p>{t('editor_review_choice_groups', { count: editor.customizationGroups.length })}</p>
          )}
        </section>
        <section>
          <h3>{t('editor_review_menu_path')}</h3>
          <p>
            {isBundle
              ? t('editor_review_menu_summary', { count: menuDefinition.sections.length })
              : t('editor_review_menu_separate')}
          </p>
          {hasLinkedStandaloneOffer && <p>{t('editor_review_linked_offer_review')}</p>}
        </section>
      </div>
      {isBundle && (
        <BundleGuestStepPreview
          menuDefinition={menuDefinition}
          sectionAvailability={availabilityAssessment?.sections}
          hideOptionAvailability={!availabilityAssessment}
        />
      )}
      <ul className={styles.checks}>
        {isBundle && isActive && availabilityCheckPending && (
          <ReviewLine role="status">{t('editor_review_bundle_availability_checking')}</ReviewLine>
        )}
        {isBundle && isActive && choiceAvailability.state.status === 'failed' && (
          <ReviewLine warning role="alert">
            {t('editor_review_bundle_availability_check_failed')}{' '}
            <button
              type="button"
              className={modalStyles.cancelButton}
              onClick={choiceAvailability.retry}
              disabled={isPending}
            >
              {t('editor_review_bundle_availability_check_retry')}
            </button>
          </ReviewLine>
        )}
        {isBundle && isActive && availabilityAssessment && (
          <ReviewLine>{t('editor_review_bundle_availability_checked')}</ReviewLine>
        )}
        {availabilityAssessment?.warnings.map((warning) => (
          <ReviewLine warning key={`${warning.sectionId}:${warning.orderType}`}>
            {t('editor_review_bundle_availability_shortage', {
              section: warning.sectionName,
              minimum: warning.minimum,
              channel: t(ORDER_TYPE_KEYS[warning.orderType]),
              available: warning.orderableCount,
            })}
          </ReviewLine>
        ))}
        {missingLocales > 0 && (
          <ReviewLine warning>
            {t('editor_review_translation_gaps', { missing: missingLocales, total: LANGUAGE_CODES.length })}
          </ReviewLine>
        )}
        {isComponent && price !== 0 && <ReviewLine warning>{t('editor_review_component_price')}</ReviewLine>}
        {!isComponent && price <= 0 && <ReviewLine warning>{t('editor_review_sellable_price')}</ReviewLine>}
        {invalidVariationPriceCount > 0 && (
          <ReviewLine warning>{t('editor_review_variation_price', { count: invalidVariationPriceCount })}</ReviewLine>
        )}
        {inactiveIngredients > 0 && (
          <ReviewLine warning>{t('editor_review_inactive_ingredients', { count: inactiveIngredients })}</ReviewLine>
        )}
        {(!Array.isArray(allergens) || allergens.length === 0) && (
          <ReviewLine warning>{t('editor_review_allergens_unknown')}</ReviewLine>
        )}
        <ReviewLine>{t('editor_review_intentional_differences')}</ReviewLine>
        <ReviewLine>{t('editor_review_quote_note')}</ReviewLine>
      </ul>
      <TranslationSuggestionsReview review={translationReview} />
    </BaseModal>
  );
}
