'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import OptionSetEditorWorkspace from '@/components/admin/option-sets/OptionSetEditorWorkspace';
import { OPTION_SET_KINDS } from '@/types/optionSet';
import type { OptionSetKind } from '@/types/optionSet';
import styles from '@/components/admin/option-sets/OptionSetEditorWorkspace.module.css';

function NewOptionSetForm() {
  const params = useSearchParams();
  const requestedKind = params.get('kind');
  const initialKind = OPTION_SET_KINDS.includes(requestedKind as OptionSetKind)
    ? (requestedKind as OptionSetKind)
    : undefined;
  return <OptionSetEditorWorkspace initialKind={initialKind} />;
}

export default function NewOptionSetPage() {
  const { t } = useTranslation();
  return (
    <AdminAuthGuard>
      <Suspense
        fallback={
          <main className={styles.page}>
            <output>{t('loading')}</output>
          </main>
        }
      >
        <NewOptionSetForm />
      </Suspense>
    </AdminAuthGuard>
  );
}
