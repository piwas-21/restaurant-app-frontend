'use client';

import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import { useTableGuestVisit } from '@/contexts/TableGuestVisitContext';
import TenantLink from '@/components/TenantLink';
import { reportTableGuestFailure } from '@/lib/tableGuestFailureDiagnostics';
import styles from './TableGuestAdmissionForm.module.css';

interface TableGuestAdmissionFormProps {
  readonly qrCodeData: string;
  readonly tableId: string;
  readonly tableLabel: string;
}

const admissionCodePattern = /^(?:[0-9A-HJKMNP-TV-Z]{6}|[0-9A-HJKMNP-TV-Z]{10})$/;

function normalizeAdmissionCode(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export default function TableGuestAdmissionForm({ qrCodeData, tableId, tableLabel }: TableGuestAdmissionFormProps) {
  const { t } = useTranslation();
  const { joinVisit, phase, featureEnabled } = useTableGuestVisit();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const admissionCode = normalizeAdmissionCode(code);
    if (!admissionCodePattern.test(admissionCode)) {
      setError(t('table_guest_code_length'));
      return;
    }

    setIsJoining(true);
    setError('');
    try {
      await joinVisit(qrCodeData, admissionCode, tableId);
    } catch (joinError) {
      reportTableGuestFailure('join visit', joinError);
      setError(t('table_guest_join_failed'));
      setIsJoining(false);
    }
  };

  if (phase === 'loading') {
    return (
      <p className={styles.message}>
        <output>{t('loading')}</output>
      </p>
    );
  }
  if (!featureEnabled || phase !== 'notJoined') {
    let message = t('table_guest_ended_detail');
    if (phase === 'active') message = t('table_guest_already_joined');
    else if (phase === 'storageUnavailable') message = t('table_guest_storage_help');
    return (
      <section className={styles.panel} aria-labelledby="table-guest-join-heading">
        <h1 id="table-guest-join-heading" className={styles.title}>
          {t('table_guest_join_title')}
        </h1>
        <p className={styles.description}>{message}</p>
        <TenantLink href="/table-account" className={styles.accountLink}>
          {t('table_guest_account_link')}
        </TenantLink>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-labelledby="table-guest-join-heading">
      <h1 id="table-guest-join-heading" className={styles.title}>
        {t('table_guest_join_title')}
      </h1>
      <p className={styles.description}>{t('table_guest_join_description', { table: tableLabel })}</p>
      <form className={styles.form} onSubmit={(event) => void handleSubmit(event)} noValidate>
        <FormField label={t('table_guest_code_label')} error={error}>
          <input
            type="text"
            value={code}
            onChange={(event) => setCode(event.currentTarget.value.toUpperCase().slice(0, 12))}
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            aria-describedby={error ? undefined : 'table-guest-code-help'}
            disabled={isJoining}
          />
        </FormField>
        {!error && (
          <p id="table-guest-code-help" className={styles.help}>
            {t('table_guest_code_help')}
          </p>
        )}
        <button
          type="submit"
          className={styles.submitButton}
          disabled={isJoining || !admissionCodePattern.test(normalizeAdmissionCode(code))}
        >
          {isJoining ? t('table_guest_joining') : t('table_guest_join_action')}
        </button>
      </form>
    </section>
  );
}
