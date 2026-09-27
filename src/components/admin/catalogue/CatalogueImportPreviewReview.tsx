'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { CatalogueImportPreview } from '@/services/catalogueImportService';
import styles from './CatalogueImportWorkspace.module.css';

interface Props {
  readonly preview: CatalogueImportPreview | null;
  readonly onChooseCandidate: (templateId: string, revision: number, candidate: { id: string }) => void;
}

export default function CatalogueImportPreviewReview({ preview, onChooseCandidate }: Props) {
  const { t } = useTranslation();
  if (!preview) return null;
  const selected = preview.items.filter((item) => item.isSelected);
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
          {item.candidates.length > 0 && (
            <div>
              <p>{t('catalogue_import_match_candidates')}</p>
              <ul className={styles.candidates}>
                {item.candidates.map((candidate) => (
                  <li key={`${candidate.entityType}:${candidate.id}`}>
                    <button type="button" onClick={() => onChooseCandidate(item.templateId, item.revision, candidate)}>
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
