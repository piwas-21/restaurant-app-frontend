'use client';

import { useTranslation } from 'react-i18next';
import { Ban } from 'lucide-react';
import StatusBadge, { type StatusBadgeTone } from '@/components/design-system/StatusBadge';
import type { ApiToken, ApiTokenStatus } from '@/types/apiToken';
import styles from './ApiTokenTable.module.css';

interface ApiTokenTableProps {
  tokens: ApiToken[];
  onRevoke: (token: ApiToken) => void;
}

const STATUS_TONE: Record<ApiTokenStatus, StatusBadgeTone> = {
  active: 'success',
  expired: 'warning',
  revoked: 'danger',
};

/**
 * The token list. `status` is the SERVER's verdict (plan §8) — never recomputed from
 * `expiresAt` against the browser clock, which is a different clock in a different zone.
 *
 * These timestamps are instants, not calendar days, so they render in the reader's own
 * zone deliberately (CLAUDE.md §5 rule 15 covers the midnight-UTC day case, not this one).
 */
export default function ApiTokenTable({ tokens, onRevoke }: Readonly<ApiTokenTableProps>) {
  const { t, i18n } = useTranslation();

  const formatInstant = (value?: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : t('api_tokens_never');

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('api_tokens_column_name')}</th>
            <th>{t('api_tokens_column_prefix')}</th>
            <th>{t('api_tokens_column_scopes')}</th>
            <th>{t('api_tokens_column_status')}</th>
            <th>{t('api_tokens_column_last_used')}</th>
            <th>{t('api_tokens_column_expires')}</th>
            <th>{t('api_tokens_column_actions')}</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <tr key={token.id}>
              <td className={styles.nameCell}>{token.name}</td>
              <td>
                <code className={styles.prefix}>{token.prefix}…</code>
              </td>
              <td>
                <div className={styles.scopes}>
                  {token.scopes.map((scope) => (
                    <code key={scope} className={styles.scope}>
                      {scope}
                    </code>
                  ))}
                </div>
              </td>
              <td>
                <StatusBadge tone={STATUS_TONE[token.status] ?? 'neutral'}>
                  {t(`api_tokens_status_${token.status}`)}
                </StatusBadge>
              </td>
              <td>{formatInstant(token.lastUsedAt)}</td>
              <td>{formatInstant(token.expiresAt)}</td>
              <td>
                {token.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => onRevoke(token)}
                    className={styles.revokeButton}
                    title={t('api_tokens_revoke')}
                  >
                    <Ban size={16} />
                    {t('api_tokens_revoke')}
                  </button>
                ) : (
                  <span className={styles.muted}>{token.revokedAt ? formatInstant(token.revokedAt) : null}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
