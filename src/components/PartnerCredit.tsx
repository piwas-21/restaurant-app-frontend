'use client';

import { useTranslation } from 'react-i18next';
import { useTenantPartner } from '@/hooks/useTenantPartner';
import styles from './PartnerCredit.module.css';

/** Same runtime attribution in both templates and each public footer. */
export default function PartnerCredit() {
  const { t } = useTranslation();
  const partner = useTenantPartner();
  const name = partner?.name?.trim();
  if (!name) return null;
  const label = t('footer_site_by', { name });
  const url = partner?.url?.trim();
  const email = partner?.email?.trim();
  return (
    <p className={styles.credit}>
      {url ? (
        <a className={styles.link} href={url} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        label
      )}
      {email && (
        <>
          {' '}
          ·{' '}
          <a className={styles.link} href={`mailto:${email}`}>
            {email}
          </a>
        </>
      )}
    </p>
  );
}
