'use client';

import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import type { ApiToken } from '@/types/apiToken';
import styles from './ApiTokenRevokeModal.module.css';

interface ApiTokenRevokeModalProps {
  token: ApiToken | null;
  revoking: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Revocation confirmation. Revocation is checked in the authentication handler on EVERY
 * request (plan §6), so it takes effect immediately — the consequence is spelled out
 * rather than left to "are you sure?".
 */
export default function ApiTokenRevokeModal({ token, revoking, onCancel, onConfirm }: ApiTokenRevokeModalProps) {
  const { t } = useTranslation();

  return (
    <BaseModal
      isOpen={token !== null}
      onClose={onCancel}
      title={t('api_tokens_revoke_title')}
      size="sm"
      footer={
        <div className={styles.footer}>
          <button type="button" onClick={onCancel} className={styles.cancelButton} disabled={revoking}>
            {t('cancel')}
          </button>
          <button type="button" onClick={onConfirm} className={styles.revokeButton} disabled={revoking}>
            {revoking ? t('api_tokens_revoking') : t('api_tokens_revoke_confirm')}
          </button>
        </div>
      }
    >
      <p className={styles.question}>{t('api_tokens_revoke_question', { name: token?.name ?? '' })}</p>
      <p className={styles.consequence} role="alert">
        {t('api_tokens_revoke_consequence')}
      </p>
    </BaseModal>
  );
}
