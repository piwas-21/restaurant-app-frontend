'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import { RESTAURANT_NAME } from '@/lib/config';

export default function PrivacyPolicyPage() {
  const { t } = useTranslation();
  const { info } = useRestaurantInfo();

  // Address resolution mirrors src/app/page.tsx and src/app/app-internal-layout.tsx:
  // admin-edited live value (API) only — blank until it loads (issue #125:
  // no tenant-1 literals). Issue #3 considered pinning the address at print
  // time for legal stability, but the page's "last updated" line already
  // renders today's date dynamically (no version snapshot semantics exist),
  // so the live value is the consistent choice.
  const addressStreet = info?.addressLine1 ?? '';
  const addressCityCountry =
    info?.postalCode && info?.city && info?.country ? `${info.postalCode} ${info.city}, ${info.country}` : '';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">{t('privacy_policy.title', 'Privacy Policy')}</h1>

      <div className="prose dark:prose-invert max-w-none">
        <p className="mb-4">{t('privacy_policy.last_updated', { date: new Date().toLocaleDateString() })}</p>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">{t('privacy_policy.intro_title', '1. Introduction')}</h2>
          <p>{t('privacy_policy.intro_text', { name: info?.name ?? RESTAURANT_NAME })}</p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">
            {t('privacy_policy.info_collect_title', '2. Information We Collect')}
          </h2>
          <p>{t('privacy_policy.info_collect_text')}</p>
          <ul className="list-disc pl-6 mt-2">
            <li>{t('privacy_policy.info_collect_list_1', 'Name and Contact Data')}</li>
            <li>{t('privacy_policy.info_collect_list_2', 'Credentials')}</li>
            <li>{t('privacy_policy.info_collect_list_3', 'Payment Data')}</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">
            {t('privacy_policy.how_use_title', '3. How We Use Your Information')}
          </h2>
          <p>{t('privacy_policy.how_use_text')}</p>
          <ul className="list-disc pl-6 mt-2">
            <li>{t('privacy_policy.how_use_list_1', 'To facilitate account creation and logon process.')}</li>
            <li>{t('privacy_policy.how_use_list_2', 'To send you marketing and promotional communications.')}</li>
            <li>{t('privacy_policy.how_use_list_3', 'To fulfill and manage your orders.')}</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">{t('privacy_policy.contact_title', '4. Contact Us')}</h2>
          <p>{t('privacy_policy.contact_text')}</p>
          <address className="mt-2 not-italic">
            {info?.name ?? RESTAURANT_NAME}
            <br />
            {addressStreet}
            <br />
            {addressCityCountry}
          </address>
        </section>
      </div>
    </div>
  );
}
