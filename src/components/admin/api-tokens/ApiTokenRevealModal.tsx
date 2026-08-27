'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Check, AlertTriangle } from 'lucide-react';
import BaseModal from '@/components/design-system/BaseModal';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { CreatedApiToken } from '@/types/apiToken';
import styles from './ApiTokenRevealModal.module.css';

interface ApiTokenRevealModalProps {
  /** Null when there is nothing to reveal. The plaintext lives here and nowhere else. */
  createdToken: CreatedApiToken | null;
  /** Called once the admin confirms they stored it — the caller then forgets the value. */
  onConfirm: () => void;
}

/**
 * The reveal-once step. The backend returns the plaintext in the 201 and never again
 * (plan §4), so this screen is the single opportunity to copy it.
 *
 * Deliberately NOT dismissable by ESC or a backdrop click: a stray key press here costs
 * the admin the token. The only way out is the explicit confirmation.
 */
export default function ApiTokenRevealModal({ createdToken, onConfirm }: Readonly<ApiTokenRevealModalProps>) {
  const { t } = useTranslation();
  const [stored, setStored] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopy = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken.token);
      setCopied(true);
      setCopyError(null);
    } catch (error) {
      // A denied clipboard permission carries no server sentence to show, and the value is on
      // screen and selectable — so the honest surfacing is to point at the manual path, and to
      // keep the browser's own reason in the console for whoever is asked why.
      console.warn('Clipboard write refused', error);
      setCopied(false);
      setCopyError(t('api_tokens_copy_failed'));
    }
  };

  const handleConfirm = () => {
    setStored(false);
    setCopied(false);
    setCopyError(null);
    onConfirm();
  };

  return (
    <BaseModal
      isOpen={createdToken !== null}
      onClose={() => undefined}
      title={t('api_tokens_reveal_title')}
      size="md"
      disableBackdropClose
      disableEscapeClose
      footer={
        <button type="button" onClick={handleConfirm} className={styles.confirmButton} disabled={!stored}>
          {t('api_tokens_reveal_confirm')}
        </button>
      }
    >
      <div className={styles.body}>
        <p className={styles.warning} role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          {t('api_tokens_reveal_warning')}
        </p>

        <p className={styles.tokenName}>{createdToken?.name}</p>

        <div className={styles.tokenRow}>
          <code className={styles.token}>{createdToken?.token}</code>
          <button type="button" onClick={handleCopy} className={styles.copyButton}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t('api_tokens_copied') : t('api_tokens_copy')}
          </button>
        </div>

        {copyError && (
          <p className={styles.copyError} role="alert">
            {copyError}
          </p>
        )}

        <p className={styles.usage}>{t('api_tokens_reveal_usage')}</p>

        <CheckboxField
          label={t('api_tokens_reveal_stored')}
          checked={stored}
          onChange={setStored}
          data-testid="api-token-stored"
        />
      </div>
    </BaseModal>
  );
}
