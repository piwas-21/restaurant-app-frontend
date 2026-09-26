'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type {
  CatalogueReviewField,
  CatalogueTemplateReference,
  CatalogueTemplateRevision,
} from '@/services/catalogueTemplateService';
import { CATALOGUE_REVIEW_FIELD_LABEL_KEYS, resolveCatalogueTemplateText } from '@/services/catalogueTemplateService';
import type { LanguageCode } from '@/config/languageConfig';
import { catalogueReferenceKey } from '@/hooks/admin/useCatalogueTemplatePreview';
import styles from './CatalogueTemplatePreview.module.css';

interface CatalogueTemplatePayloadPreviewProps {
  readonly detail: CatalogueTemplateRevision;
  readonly locale: LanguageCode;
  readonly dependencyNames: Readonly<Record<string, CatalogueTemplateRevision>>;
}

function referenceName(
  reference: CatalogueTemplateReference,
  dependencyNames: Readonly<Record<string, CatalogueTemplateRevision>>,
  locale: LanguageCode,
): string {
  const item = dependencyNames[catalogueReferenceKey(reference.templateId, reference.revision)];
  return item ? resolveCatalogueTemplateText(item, locale).name : reference.templateId;
}

function selectionRule(min: number, max: number, t: ReturnType<typeof useTranslation>['t']): string {
  if (min === max) return t('catalogue_choose_exactly', { count: min });
  if (min === 0) return t('catalogue_choose_up_to', { count: max });
  return t('catalogue_choose_range', { min, max });
}

function TemplateReferences({
  title,
  references,
  names,
  locale,
  showDefaults,
}: {
  readonly title: string;
  readonly references: Array<
    CatalogueTemplateReference & { sortOrder?: number; default?: boolean; includedByDefault?: boolean }
  >;
  readonly names: CatalogueTemplatePayloadPreviewProps['dependencyNames'];
  readonly locale: LanguageCode;
  readonly showDefaults?: boolean;
}) {
  const { t } = useTranslation();
  if (references.length === 0) return null;
  return (
    <section className={styles.referenceGroup}>
      <h4>{title}</h4>
      <ul className={styles.referenceList}>
        {[...references]
          .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
          .map((reference) => (
            <li key={catalogueReferenceKey(reference.templateId, reference.revision)}>
              <span>{referenceName(reference, names, locale)}</span>
              {showDefaults && reference.default && <span className={styles.defaultTag}>{t('catalogue_default')}</span>}
              {showDefaults && 'includedByDefault' in reference && reference.includedByDefault && (
                <span className={styles.defaultTag}>{t('catalogue_included_by_default')}</span>
              )}
            </li>
          ))}
      </ul>
    </section>
  );
}

function reviewFieldLabel(field: CatalogueReviewField, t: ReturnType<typeof useTranslation>['t']): string {
  return t(CATALOGUE_REVIEW_FIELD_LABEL_KEYS[field]);
}

export default function CatalogueTemplatePayloadPreview({
  detail,
  locale,
  dependencyNames,
}: CatalogueTemplatePayloadPreviewProps) {
  const { t } = useTranslation();
  const { type, payload } = detail;
  const reviewFields = 'requiredLocalReviewFields' in payload ? payload.requiredLocalReviewFields : [];

  return (
    <div className={styles.payloadPreview}>
      <section className={styles.guestPreview}>
        <h3>{type === 'bundle' ? t('catalogue_guest_preview') : t('catalogue_template_contents')}</h3>
        <p className={styles.notice}>{t('catalogue_guest_preview_notice')}</p>
        {type === 'bundle' && (
          <ol className={styles.steps}>
            {[...payload.sections]
              .sort((left, right) => left.sortOrder - right.sortOrder)
              .map((section) => (
                <li key={section.sectionKey} className={styles.step}>
                  <div className={styles.stepHeading}>
                    <strong>{section.name}</strong>
                    <span>{selectionRule(section.min, section.max, t)}</span>
                  </div>
                  <ul className={styles.referenceList}>
                    {[...section.options]
                      .sort((left, right) => left.sortOrder - right.sortOrder)
                      .map((option) => (
                        <li key={catalogueReferenceKey(option.templateId, option.revision)}>
                          <span>{referenceName(option, dependencyNames, locale)}</span>
                          {option.default && <span className={styles.defaultTag}>{t('catalogue_default')}</span>}
                        </li>
                      ))}
                  </ul>
                </li>
              ))}
          </ol>
        )}
        {type === 'option-set' && (
          <>
            <p className={styles.rule}>{selectionRule(payload.min, payload.max, t)}</p>
            <TemplateReferences
              title={t('catalogue_options')}
              references={payload.options}
              names={dependencyNames}
              locale={locale}
              showDefaults
            />
          </>
        )}
        {type === 'item' && (
          <div className={styles.groups}>
            {payload.category && (
              <TemplateReferences
                title={t('category')}
                references={[payload.category]}
                names={dependencyNames}
                locale={locale}
              />
            )}
            <TemplateReferences
              title={t('catalogue_suggested_ingredients')}
              references={payload.suggestedIngredients}
              names={dependencyNames}
              locale={locale}
            />
            <TemplateReferences
              title={t('catalogue_option_sets')}
              references={payload.optionSets}
              names={dependencyNames}
              locale={locale}
            />
            <TemplateReferences
              title={t('catalogue_side_sets')}
              references={payload.sideSets}
              names={dependencyNames}
              locale={locale}
            />
          </div>
        )}
        {type === 'cuisine-pack' && (
          <div className={styles.groups}>
            <TemplateReferences
              title={t('categories')}
              references={payload.categories}
              names={dependencyNames}
              locale={locale}
            />
            <TemplateReferences
              title={t('catalogue_offers')}
              references={payload.offers}
              names={dependencyNames}
              locale={locale}
              showDefaults
            />
          </div>
        )}
        {type === 'ingredient' && (
          <p className={styles.roleNote}>
            {t('catalogue_suggested_only')} <strong>{payload.role}</strong>
          </p>
        )}
        {type === 'category' && <p className={styles.roleNote}>{t('catalogue_category_template_notice')}</p>}
      </section>
      <section className={styles.localReview}>
        <h3>{t('catalogue_local_review_heading')}</h3>
        <p>{t('catalogue_local_review_notice')}</p>
        {reviewFields.length > 0 && (
          <ul>
            {reviewFields.map((field) => (
              <li key={field}>{reviewFieldLabel(field, t)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
