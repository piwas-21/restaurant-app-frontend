'use client';

import { useTranslation } from 'react-i18next';
import { KeyRound, Loader2, Plus } from 'lucide-react';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import ApiTokenCreateModal from '@/components/admin/api-tokens/ApiTokenCreateModal';
import ApiTokenRevealModal from '@/components/admin/api-tokens/ApiTokenRevealModal';
import ApiTokenRevokeModal from '@/components/admin/api-tokens/ApiTokenRevokeModal';
import ApiTokenTable from '@/components/admin/api-tokens/ApiTokenTable';
import { useApiTokens } from '@/hooks/useApiTokens';
import styles from './api-tokens.module.css';

/**
 * Scoped API tokens — machine credentials for an agent or a script
 * (docs/plans/API-TOKENS-PLAN.md).
 *
 * **Admin only, not Staff.** The three backend endpoints are admin-and-human-JWT only, so a
 * Staff session would get a 403 from every call on this page; the guard says so up front.
 */
export default function ApiTokensPage() {
  const { t } = useTranslation();
  const {
    tokens,
    loading,
    createOpen,
    creating,
    createError,
    createdToken,
    revokeTarget,
    revoking,
    openCreate,
    closeCreate,
    createToken,
    dismissCreatedToken,
    requestRevoke,
    cancelRevoke,
    confirmRevoke,
  } = useApiTokens();

  const renderList = () => {
    if (loading) {
      return (
        <div className={styles.loadingContainer}>
          <Loader2 size={48} className={styles.spinner} />
          <p>{t('loading')}</p>
        </div>
      );
    }
    if (tokens.length === 0) {
      return (
        <div className={styles.emptyState}>
          <p>{t('api_tokens_empty')}</p>
          <button type="button" onClick={openCreate} className={styles.createButtonSecondary}>
            <Plus size={20} />
            {t('api_tokens_create_first')}
          </button>
        </div>
      );
    }
    return <ApiTokenTable tokens={tokens} onRevoke={requestRevoke} />;
  };

  return (
    <AdminAuthGuard requiredRoles={['Admin']}>
      <main className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              <KeyRound size={24} aria-hidden="true" />
              {t('admin_api_tokens_title')}
            </h1>
            <p className={styles.subtitle}>{t('api_tokens_subtitle')}</p>
          </div>
          <button type="button" onClick={openCreate} className={styles.createButton}>
            <Plus size={20} />
            {t('api_tokens_create')}
          </button>
        </div>

        {renderList()}

        <ApiTokenCreateModal
          isOpen={createOpen}
          submitting={creating}
          error={createError}
          onClose={closeCreate}
          onSubmit={createToken}
        />
        <ApiTokenRevealModal createdToken={createdToken} onConfirm={dismissCreatedToken} />
        <ApiTokenRevokeModal
          token={revokeTarget}
          revoking={revoking}
          onCancel={cancelRevoke}
          onConfirm={confirmRevoke}
        />
      </main>
    </AdminAuthGuard>
  );
}
