'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import type { LanguageCode } from '@/config/languageConfig';
import type { CatalogueImportDecision } from '@/services/catalogueImportService';
import {
  resolveCatalogueSectionName,
  resolveCatalogueTemplateText,
  type CatalogueTemplateOptionReference,
  type CatalogueTemplateRevision,
} from '@/services/catalogueTemplateService';
import { formatCurrency } from '@/utils/currency';
import styles from './CatalogueImportDraftGuestPreview.module.css';

interface Props {
  readonly detail: CatalogueTemplateRevision;
  readonly locale: LanguageCode;
  readonly detailsByKey: Readonly<Record<string, CatalogueTemplateRevision>>;
  readonly decisions: Readonly<Record<string, CatalogueImportDecision>>;
  readonly reusedNamesByKey?: Readonly<Record<string, string>>;
}

const keyFor = (reference: { templateId: string; revision: number }) => `${reference.templateId}@${reference.revision}`;

function choiceName(
  reference: CatalogueTemplateOptionReference,
  details: Props['detailsByKey'],
  locale: LanguageCode,
  decisions: Props['decisions'],
  reusedNamesByKey: Readonly<Record<string, string>>,
  reusedLabel: string,
): string {
  const decision = decisions[keyFor(reference)];
  if (decision?.resolution === 'Reuse') return reusedNamesByKey[keyFor(reference)] || reusedLabel;
  const localName = decision?.resolution === 'Create' ? decision.localName?.trim() : undefined;
  if (localName) return localName;
  const source = details[keyFor(reference)];
  return source ? resolveCatalogueTemplateText(source, locale).name : reference.templateId;
}

function ChoiceRows({
  choices,
  owner,
  details,
  locale,
  decisions,
  reusedNamesByKey,
  pricesFromItems = false,
}: {
  readonly choices: readonly CatalogueTemplateOptionReference[];
  readonly owner?: CatalogueImportDecision;
  readonly details: Props['detailsByKey'];
  readonly locale: LanguageCode;
  readonly decisions: Props['decisions'];
  readonly reusedNamesByKey: Readonly<Record<string, string>>;
  readonly pricesFromItems?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ul className={styles.choices}>
      {[...choices]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((choice) => {
          const priceDecision = pricesFromItems ? decisions[keyFor(choice)] : owner;
          const price = pricesFromItems
            ? priceDecision?.localPrice
            : priceDecision?.localOptionPrices?.[keyFor(choice)];
          let priceDisplay: React.ReactNode = null;
          if (priceDecision?.resolution === 'Reuse') {
            priceDisplay = <small>{t('catalogue_import_draft_existing_price')}</small>;
          } else if (typeof price === 'number' && Number.isFinite(price)) {
            priceDisplay = <strong>{formatCurrency(price)}</strong>;
          } else if (priceDecision?.resolution === 'Create') {
            priceDisplay = <small className={styles.pending}>{t('catalogue_import_draft_price_needed')}</small>;
          }
          return (
            <li key={keyFor(choice)}>
              <span dir="auto">
                {choiceName(choice, details, locale, decisions, reusedNamesByKey, t('catalogue_import_reuse'))}
              </span>
              <span className={styles.choiceMeta}>
                {choice.default && <small>{t('catalogue_default')}</small>}
                {priceDisplay}
              </span>
            </li>
          );
        })}
    </ul>
  );
}

function rule(min: number, max: number, t: ReturnType<typeof useTranslation>['t']) {
  if (min === max) return t('catalogue_choose_exactly', { count: min });
  if (min === 0) return t('catalogue_choose_up_to', { count: max });
  return t('catalogue_choose_range', { min, max });
}

export default function CatalogueImportDraftGuestPreview({
  detail,
  locale,
  detailsByKey,
  decisions,
  reusedNamesByKey = {},
}: Props) {
  const { t } = useTranslation();
  const decision = decisions[keyFor(detail)];
  if (detail.type !== 'item' && detail.type !== 'bundle') return null;
  const basePrice = decision?.localPrice;
  const optionSets = detail.type === 'item' ? [...detail.payload.optionSets, ...detail.payload.sideSets] : [];
  const offerName =
    decision?.resolution === 'Reuse'
      ? reusedNamesByKey[keyFor(detail)] || t('catalogue_import_reuse')
      : decision?.localName?.trim() || resolveCatalogueTemplateText(detail, locale).name;
  let priceText = t('catalogue_import_draft_price_needed');
  if (decision?.resolution === 'Reuse') priceText = t('catalogue_import_draft_existing_price');
  else if (typeof basePrice === 'number' && Number.isFinite(basePrice)) priceText = formatCurrency(basePrice);
  let availabilityText = t('catalogue_import_choose_availability');
  if (decision?.resolution === 'Reuse') availabilityText = t('catalogue_import_reuse');
  else if (decision?.intendedIsAvailable !== undefined)
    availabilityText = t(decision.intendedIsAvailable ? 'available' : 'unavailable');

  return (
    <div className={styles.preview}>
      {decision?.resolution !== 'Reuse' && <p>{t('catalogue_import_draft_guest_notice')}</p>}
      <div className={styles.summary}>
        <span>
          {t('catalogue_import_price_for', { name: offerName })}: {priceText}
        </span>
        <span>
          {t('catalogue_import_intended_availability')}: {availabilityText}
        </span>
      </div>
      {decision?.resolution === 'Reuse' && <p>{t('catalogue_import_reuse_preserves_local')}</p>}
      {decision?.resolution !== 'Reuse' && detail.type === 'bundle' && (
        <ol className={styles.steps}>
          {[...detail.payload.sections]
            .sort((left, right) => left.sortOrder - right.sortOrder)
            .map((section) => (
              <li key={section.sectionKey} className={styles.step}>
                <div className={styles.stepHeading}>
                  <strong>{resolveCatalogueSectionName(section, detail, locale)}</strong>
                  <span>{rule(section.min, section.max, t)}</span>
                </div>
                <ChoiceRows
                  choices={section.options}
                  owner={decision}
                  details={detailsByKey}
                  locale={locale}
                  decisions={decisions}
                  reusedNamesByKey={reusedNamesByKey}
                />
              </li>
            ))}
        </ol>
      )}
      {decision?.resolution !== 'Reuse' && detail.type === 'item' && optionSets.length > 0 && (
        <ol className={styles.steps}>
          {optionSets.map((reference) => {
            const set = detailsByKey[keyFor(reference)];
            if (set?.type !== 'option-set') return null;
            return (
              <li key={keyFor(reference)} className={styles.step}>
                {decisions[keyFor(reference)]?.resolution === 'Reuse' ? (
                  <>
                    <strong>{reusedNamesByKey[keyFor(reference)] || t('catalogue_import_reuse')}</strong>
                    <p>{t('catalogue_import_reuse_preserves_local')}</p>
                  </>
                ) : (
                  <>
                    <div className={styles.stepHeading}>
                      <strong>
                        {decisions[keyFor(reference)]?.localName?.trim() ||
                          resolveCatalogueTemplateText(set, locale).name}
                      </strong>
                      <span>
                        {set.payload.kind === 'suggested-side'
                          ? t('suggested_side_items_description')
                          : rule(set.payload.min, set.payload.max, t)}
                      </span>
                    </div>
                    <ChoiceRows
                      choices={set.payload.options}
                      owner={decisions[keyFor(reference)]}
                      details={detailsByKey}
                      locale={locale}
                      decisions={decisions}
                      reusedNamesByKey={reusedNamesByKey}
                      pricesFromItems={set.payload.kind === 'suggested-side'}
                    />
                  </>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {decision?.resolution !== 'Reuse' && (
        <p className={styles.caution}>{t('catalogue_import_import_visibility_note')}</p>
      )}
    </div>
  );
}
