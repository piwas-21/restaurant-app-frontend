'use client';

import { useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TableGuestFeatureProvider, useTableGuestFeature } from '@/contexts/TableGuestFeatureContext';
import { createTableGuestAdmissionCode } from '@/services/tableGuestAdmissionCodeService';
import { reportTableGuestFailure } from '@/lib/tableGuestFailureDiagnostics';
import styles from './TableGuestAdmissionCodeAction.module.css';

interface TableGuestAdmissionCodeActionProps {
  readonly enabled: boolean;
  readonly serviceSessionId: string;
  readonly disabled?: boolean;
}

export default function TableGuestAdmissionCodeAction({
  enabled,
  serviceSessionId,
  disabled = false,
}: TableGuestAdmissionCodeActionProps) {
  if (!enabled || !serviceSessionId) return null;
  return (
    <TableGuestFeatureProvider features={{ tableGuestVisitsV1: true }}>
      <AdmissionCodePanel serviceSessionId={serviceSessionId} disabled={disabled} />
    </TableGuestFeatureProvider>
  );
}

function AdmissionCodePanel({ serviceSessionId, disabled }: Omit<TableGuestAdmissionCodeActionProps, 'enabled'>) {
  const { t, i18n } = useTranslation();
  const { tableGuestFeatureStatus, retryTableGuestFeature } = useTableGuestFeature();
  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const requestLock = useRef(false);

  const generate = async () => {
    if (requestLock.current || disabled) return;
    requestLock.current = true;
    setIsGenerating(true);
    setCode(null);
    setExpiresAt(null);
    setUncertain(false);
    try {
      const result = await createTableGuestAdmissionCode(serviceSessionId);
      const expiry = Date.parse(result.expiresAt);
      if (!/^[A-Z0-9]{10}$/.test(result.admissionCode) || !Number.isFinite(expiry) || expiry <= Date.now()) {
        throw new Error('The guest code response could not be confirmed.');
      }
      setCode(result.admissionCode);
      setExpiresAt(result.expiresAt);
    } catch (requestError) {
      reportTableGuestFailure('create admission code', requestError);
      // The request may have succeeded before its response was lost; retry only by explicit replacement.
      setUncertain(true);
    } finally {
      requestLock.current = false;
      setIsGenerating(false);
    }
  };

  if (tableGuestFeatureStatus === 'loading' || tableGuestFeatureStatus === 'idle') {
    return <output className={styles.panel}>{t('loading')}</output>;
  }
  if (tableGuestFeatureStatus === 'unavailable') {
    return (
      <section className={styles.panel} aria-label={t('table_guest_staff_code_title', t('unavailable', 'Unavailable'))}>
        <p className={styles.detail}>{t('table_guest_unavailable_detail', t('unavailable', 'Unavailable'))}</p>
        <button type="button" className={styles.button} onClick={retryTableGuestFeature}>
          {t('table_guest_unavailable_retry_action', t('retry', 'Retry'))}
        </button>
      </section>
    );
  }

  const formattedExpiry = expiresAt
    ? new Intl.DateTimeFormat(i18n.language || 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(expiresAt),
      )
    : null;
  let actionLabel = t('table_guest_staff_code_action');
  if (code || uncertain) actionLabel = t('table_guest_staff_code_replace_action');
  if (isGenerating) actionLabel = t('table_guest_staff_code_generating');

  return (
    <section className={styles.panel} aria-label={t('table_guest_staff_code_title')}>
      <div className={styles.heading}>
        <strong>{t('table_guest_staff_code_title')}</strong>
        <button
          type="button"
          className={styles.helpButton}
          aria-label={t('table_guest_staff_code_help_label')}
          aria-expanded={helpVisible}
          aria-controls="table-guest-code-help"
          onClick={() => setHelpVisible((visible) => !visible)}
        >
          <Info size={18} aria-hidden="true" />
        </button>
      </div>
      {helpVisible && (
        <div className={styles.helpContent} id="table-guest-code-help">
          <p className={styles.detail}>{t('table_guest_staff_code_help_text')}</p>
          <p className={styles.detail}>{t('table_guest_staff_code_replacement_detail')}</p>
        </div>
      )}
      {code && formattedExpiry && (
        <div className={styles.codeResult} role="status" aria-live="polite">
          <code className={styles.code} dir="ltr">
            {code}
          </code>
          <p className={styles.expiry}>{t('table_guest_staff_code_expiry', { expiresAt: formattedExpiry })}</p>
        </div>
      )}
      {uncertain && (
        <p className={styles.error} role="alert">
          {t('table_guest_staff_code_uncertain')}
        </p>
      )}
      <button
        type="button"
        className={styles.button}
        onClick={() => void generate()}
        disabled={disabled || isGenerating}
      >
        {actionLabel}
      </button>
    </section>
  );
}
