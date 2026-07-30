'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '@/app/styles/AdminPage.module.css';
import PageHeader from '@/components/admin/PageHeader';
import { AdminAuthGuard } from '@/components/admin/AdminAuthGuard';
import SetupChecklist from '@/components/admin/setup/SetupChecklist';

export default function AdminDashboardPage() {
  const { t } = useTranslation();

  return (
    <AdminAuthGuard>
      <main className={styles.adminContainer}>
        <PageHeader title={t('admin_dashboard_title')} />
        {/* First-run setup guide (SOFRA-ONBOARDING-PLAN O4). Renders nothing once the
            owner dismisses it, and nothing at all when the checklist cannot be read —
            so an established restaurant sees the page it has always seen. */}
        <SetupChecklist />
        <section className={styles.adminContent}>
          <h2>{t('welcome_admin')}</h2>
          <p>{t('admin_dashboard_welcome_message')}</p>
        </section>
      </main>
    </AdminAuthGuard>
  );
}
