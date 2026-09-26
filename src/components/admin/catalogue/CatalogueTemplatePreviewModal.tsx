'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import { getLanguageNativeName, type LanguageCode } from '@/config/languageConfig';
import { useCatalogueTemplatePreview } from '@/hooks/admin/useCatalogueTemplatePreview';
import {
  CATALOGUE_TYPE_LABEL_KEYS,
  resolveCatalogueTemplateText,
  type CatalogueTemplateSummary,
} from '@/services/catalogueTemplateService';
import CatalogueTemplatePayloadPreview from './CatalogueTemplatePayloadPreview';
import styles from './CatalogueTemplatePreview.module.css';

interface CatalogueTemplatePreviewModalProps {
  readonly template: CatalogueTemplateSummary | null;
  readonly locale: LanguageCode;
  readonly onClose: () => void;
}

function originLabel(origin: string, t: ReturnType<typeof useTranslation>['t']): string {
  const originKeys: Record<string, string> = {
    'sofra-original': 'catalogue_origin_sofra_original',
    'external-licensed': 'catalogue_origin_external_licensed',
    'public-domain': 'catalogue_origin_public_domain',
  };
  return t(originKeys[origin] ?? 'catalogue_origin_unknown');
}

export default function CatalogueTemplatePreviewModal({
  template,
  locale,
  onClose,
}: CatalogueTemplatePreviewModalProps) {
  const { t } = useTranslation();
  const { detail, dependencyDetails, unresolvedDependencyCount, dependencyErrorMessage, isLoading, error, retry } =
    useCatalogueTemplatePreview(template);
  const localizedText = detail ? resolveCatalogueTemplateText(detail, locale) : null;
  const displayName = localizedText?.name || template?.displayName || '';
  const description = localizedText?.description ?? null;

  return (
    <BaseModal isOpen={template !== null} onClose={onClose} title={displayName || t('catalogue_preview')} size="lg">
      <div className={styles.previewBody}>
        {isLoading && (
          <p className={styles.loading} role="status">
            {t('catalogue_preview_loading')}
          </p>
        )}
        {error !== null && (
          <div>
            <p className={styles.error} role="alert">
              {error || t('catalogue_preview_error')}
            </p>
            <button type="button" className={styles.retryButton} onClick={retry}>
              {t('catalogue_retry')}
            </button>
          </div>
        )}
        {detail && template && (
          <>
            <section className={styles.summary}>
              {description && <p className={styles.description}>{description}</p>}
              <dl className={styles.metadata}>
                <div>
                  <dt>{t('catalogue_template_type')}</dt>
                  <dd>{t(CATALOGUE_TYPE_LABEL_KEYS[detail.type])}</dd>
                </div>
                <div>
                  <dt>{t('catalogue_source_language')}</dt>
                  <dd>{getLanguageNativeName(detail.sourceLocale)}</dd>
                </div>
                <div>
                  <dt>{t('catalogue_template_revision', { revision: detail.revision })}</dt>
                  <dd>{t('catalogue_quality_reviewed')}</dd>
                </div>
                <div>
                  <dt>{t('catalogue_translations')}</dt>
                  <dd>
                    {Object.keys(detail.translations).length > 0
                      ? Object.keys(detail.translations)
                          .map((language) => getLanguageNativeName(language as LanguageCode))
                          .join(', ')
                      : t('catalogue_no_translations')}
                  </dd>
                </div>
              </dl>
              {template.usedSourceFallback && (
                <p className={styles.sourceNote}>
                  {t('catalogue_source_fallback', { language: getLanguageNativeName(detail.sourceLocale) })}
                </p>
              )}
              {unresolvedDependencyCount > 0 && (
                <p className={styles.sourceNote} role="status">
                  {t('catalogue_dependency_names_error', { count: unresolvedDependencyCount })}
                  {dependencyErrorMessage && ` ${dependencyErrorMessage}`}
                </p>
              )}
            </section>
            <section className={styles.provenance}>
              <h3>{t('catalogue_provenance')}</h3>
              <dl>
                <dt>{t('catalogue_content_origin')}</dt>
                <dd>{originLabel(detail.provenance.contentOrigin, t)}</dd>
                <dt>{t('catalogue_source_description')}</dt>
                <dd>{detail.provenance.sourceDescription}</dd>
                <dt>{t('catalogue_license')}</dt>
                <dd>{detail.provenance.license}</dd>
                {detail.provenance.attribution && (
                  <>
                    <dt>{t('catalogue_attribution')}</dt>
                    <dd>{detail.provenance.attribution}</dd>
                  </>
                )}
                {detail.provenance.evidenceRef && (
                  <>
                    <dt>{t('catalogue_evidence_reference')}</dt>
                    <dd>{detail.provenance.evidenceRef}</dd>
                  </>
                )}
              </dl>
              {detail.provenance.mediaAssets.length > 0 && (
                <>
                  <h4>{t('catalogue_media_rights')}</h4>
                  <ul>
                    {detail.provenance.mediaAssets.map((asset) => (
                      <li key={asset.assetPath}>
                        {asset.assetPath} — {asset.license} ({asset.evidenceRef})
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <CatalogueTemplatePayloadPreview detail={detail} locale={locale} dependencyNames={dependencyDetails} />
          </>
        )}
      </div>
    </BaseModal>
  );
}
