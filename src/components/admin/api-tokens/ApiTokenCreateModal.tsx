'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '@/components/design-system/BaseModal';
import FormField from '@/components/design-system/FormField';
import CheckboxField from '@/components/design-system/CheckboxField';
import {
  API_TOKEN_EXPIRY_DEFAULT_DAYS,
  API_TOKEN_EXPIRY_MAX_DAYS,
  API_TOKEN_EXPIRY_MIN_DAYS,
  API_TOKEN_NAME_MAX_LENGTH,
  API_TOKEN_SCOPES,
  type ApiTokenScope,
  type CreateApiTokenRequest,
} from '@/types/apiToken';
import styles from './ApiTokenCreateModal.module.css';

interface ApiTokenCreateModalProps {
  isOpen: boolean;
  submitting: boolean;
  /** Server-authored failure sentence (the joined `errors[]`), shown verbatim. */
  error: string | null;
  onClose: () => void;
  onSubmit: (request: CreateApiTokenRequest) => void;
}

const READ_SCOPES = API_TOKEN_SCOPES.filter((scope) => scope.endsWith(':read'));
const WRITE_SCOPES = API_TOKEN_SCOPES.filter((scope) => scope.endsWith(':write'));

/**
 * Create form. Client-side checks are a courtesy only — the backend validator (plan §8) is
 * the authority, and its `errors[]` is what the admin reads on a 400.
 */
export default function ApiTokenCreateModal({
  isOpen,
  submitting,
  error,
  onClose,
  onSubmit,
}: ApiTokenCreateModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<ApiTokenScope[]>([]);
  const [expiresInDays, setExpiresInDays] = useState(API_TOKEN_EXPIRY_DEFAULT_DAYS);

  const toggleScope = (scope: ApiTokenScope, checked: boolean) =>
    setScopes((current) => (checked ? [...current, scope] : current.filter((s) => s !== scope)));

  const nameInvalid = name.trim().length === 0;
  const scopesInvalid = scopes.length === 0;
  const expiryInvalid =
    !Number.isInteger(expiresInDays) ||
    expiresInDays < API_TOKEN_EXPIRY_MIN_DAYS ||
    expiresInDays > API_TOKEN_EXPIRY_MAX_DAYS;
  const canSubmit = !submitting && !nameInvalid && !scopesInvalid && !expiryInvalid;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit({ name: name.trim(), scopes, expiresInDays });
  };

  const renderGroup = (label: string, group: readonly ApiTokenScope[]) => (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{label}</legend>
      {group.map((scope) => (
        <CheckboxField
          key={scope}
          label={scope}
          description={t(`api_tokens_scope_desc_${scope.replace(':', '_')}`)}
          checked={scopes.includes(scope)}
          onChange={(checked) => toggleScope(scope, checked)}
          invalid={scopesInvalid}
          describedBy="api-token-scopes-error"
        />
      ))}
    </fieldset>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('api_tokens_create_title')}
      size="md"
      footer={
        <div className={styles.footer}>
          <button type="button" onClick={onClose} className={styles.cancelButton} disabled={submitting}>
            {t('cancel')}
          </button>
          <button type="button" onClick={handleSubmit} className={styles.submitButton} disabled={!canSubmit}>
            {submitting ? t('api_tokens_creating') : t('api_tokens_create_submit')}
          </button>
        </div>
      }
    >
      <div className={styles.body}>
        <p className={styles.intro}>{t('api_tokens_create_intro')}</p>

        <FormField label={t('api_tokens_field_name')}>
          <input
            type="text"
            value={name}
            maxLength={API_TOKEN_NAME_MAX_LENGTH}
            placeholder={t('api_tokens_field_name_placeholder')}
            onChange={(event) => setName(event.target.value)}
            className={styles.input}
          />
        </FormField>

        <div className={styles.scopeSection}>
          <p className={styles.sectionTitle}>{t('api_tokens_field_scopes')}</p>
          {renderGroup(t('api_tokens_scope_group_read'), READ_SCOPES)}
          {renderGroup(t('api_tokens_scope_group_write'), WRITE_SCOPES)}
          <p id="api-token-scopes-error" className={styles.hint}>
            {scopesInvalid ? t('api_tokens_scopes_required') : t('api_tokens_scopes_hint')}
          </p>
        </div>

        <FormField label={t('api_tokens_field_expiry')}>
          <input
            type="number"
            value={expiresInDays}
            min={API_TOKEN_EXPIRY_MIN_DAYS}
            max={API_TOKEN_EXPIRY_MAX_DAYS}
            onChange={(event) => setExpiresInDays(Number(event.target.value))}
            className={styles.input}
          />
        </FormField>
        <p className={styles.hint}>{t('api_tokens_field_expiry_hint')}</p>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </BaseModal>
  );
}
