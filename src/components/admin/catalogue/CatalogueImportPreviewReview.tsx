'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { LanguageCode } from '@/config/languageConfig';
import type { CatalogueImportDecision, CatalogueImportPreview } from '@/services/catalogueImportService';
import type { CatalogueTemplateRevision } from '@/services/catalogueTemplateService';
import CatalogueImportDraftGuestPreview from './CatalogueImportDraftGuestPreview';
import draftStyles from './CatalogueImportDraftGuestPreview.module.css';
import styles from './CatalogueImportWorkspace.module.css';

interface Props {
  readonly preview: CatalogueImportPreview | null;
  readonly locale: LanguageCode;
  readonly detailsByKey: Readonly<Record<string, CatalogueTemplateRevision>>;
  readonly decisions: Readonly<Record<string, CatalogueImportDecision>>;
  readonly canChooseCandidate: (templateId: string, revision: number) => boolean;
  readonly onChooseCandidate: (templateId: string, revision: number, candidate: { id: string }) => void;
}

export default function CatalogueImportPreviewReview({
  preview,
  locale,
  detailsByKey,
  decisions,
  canChooseCandidate,
  onChooseCandidate,
}: Props) {
  const { t } = useTranslation();
  if (!preview) return null;
  const selected = preview.items.filter((item) => item.isSelected);
  const reusedNamesByKey = Object.fromEntries(
    preview.items.flatMap((item) =>
      item.resolution === 'Reuse' && item.localEntityName
        ? [[`${item.templateId}@${item.revision}`, item.localEntityName]]
        : [],
    ),
  );
  const effectiveDecisions = { ...decisions };
  preview.items.forEach((item) => {
    if (item.resolution !== 'Reuse') return;
    const key = `${item.templateId}@${item.revision}`;
    effectiveDecisions[key] = {
      ...effectiveDecisions[key],
      templateId: item.templateId,
      revision: item.revision,
      resolution: 'Reuse',
      localEntityId: item.localEntityId ?? undefined,
    };
  });
  const firstOffer = selected.find((item) => item.type === 'item' || item.type === 'bundle');
  const blockers = selected.reduce((count, item) => count + item.blockingIssues.length, 0);
  return (
    <section className={styles.preview} aria-labelledby="catalogue-preview-heading">
      <div className={styles.previewHeader}>
        <h2 id="catalogue-preview-heading">{t('catalogue_import_preview_title')}</h2>
        <StatusBadge tone={blockers > 0 ? 'warning' : 'success'}>
          {t(blockers > 0 ? 'catalogue_import_blockers_count' : 'catalogue_import_preview_ready', { count: blockers })}
        </StatusBadge>
      </div>
      {selected.map((item) => (
        <article key={`${item.templateId}@${item.revision}`} className={styles.previewItem}>
          <h3>{item.displayName}</h3>
          {item.resolution === 'Reuse' && item.localEntityId && (
            <p className={styles.previewFootnote}>
              {(item.localEntityName ??
                item.candidates.find((candidate) => candidate.id === item.localEntityId)?.name) && (
                <strong>
                  {item.localEntityName ??
                    item.candidates.find((candidate) => candidate.id === item.localEntityId)?.name}{' '}
                  ·{' '}
                </strong>
              )}
              {t('catalogue_import_reuse_identity', { type: t(`catalogue_type_${item.type}`) })}{' '}
              <code>{item.localEntityId}</code>
            </p>
          )}
          {item.candidates.length > 0 && (
            <div>
              <p>{t('catalogue_import_match_candidates')}</p>
              <ul className={styles.candidates}>
                {item.candidates.map((candidate) => (
                  <li key={`${candidate.entityType}:${candidate.id}`}>
                    <button
                      type="button"
                      disabled={!canChooseCandidate(item.templateId, item.revision)}
                      onClick={() => onChooseCandidate(item.templateId, item.revision, candidate)}
                    >
                      {t('catalogue_import_use_candidate', { name: candidate.name, type: candidate.entityType })}
                    </button>
                    <span>{candidate.categoryName ? ` · ${candidate.categoryName}` : ''}</span>
                    <StatusBadge tone={candidate.isActive ? 'success' : 'warning'}>
                      {t(candidate.isActive ? 'active' : 'inactive')}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(item.type === 'item' || item.type === 'bundle') && detailsByKey[`${item.templateId}@${item.revision}`] && (
            <details className={draftStyles.disclosure} open={item.templateId === firstOffer?.templateId}>
              <summary>{t('catalogue_guest_preview')}</summary>
              <CatalogueImportDraftGuestPreview
                detail={detailsByKey[`${item.templateId}@${item.revision}`]}
                locale={locale}
                detailsByKey={detailsByKey}
                decisions={effectiveDecisions}
                reusedNamesByKey={reusedNamesByKey}
              />
            </details>
          )}
          {item.warnings.map((issue, index) => (
            <p key={`warning:${issue.code}:${index}`} className={styles.warning}>
              {issue.message}
            </p>
          ))}
          {item.blockingIssues.map((issue, index) => (
            <p key={`blocker:${issue.code}:${index}`} className={styles.blocker} role="alert">
              {issue.message}
            </p>
          ))}
        </article>
      ))}
      <p className={styles.previewFootnote}>{t('catalogue_import_preview_version', { version: preview.version })}</p>
    </section>
  );
}
