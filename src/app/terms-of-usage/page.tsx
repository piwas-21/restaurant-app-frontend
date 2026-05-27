'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';

export default function TermsOfUsagePage() {
  const { t } = useTranslation();
  const { info } = useRestaurantInfo();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Address resolution mirrors src/app/page.tsx and src/app/app-internal-layout.tsx:
  // admin-edited live value (API) → i18n string → SSR literal. Issue #3 considered
  // pinning the address at print time for legal stability, but the page's
  // "last updated" line already renders today's date dynamically (no version
  // snapshot semantics exist), so the live value is the consistent choice and
  // keeps the address locale-aware (notably for the ar/ru/zh scripts).
  const addressStreet = info?.addressLine1 ?? (isClient ? t('rumi_address_street') : 'Rue du Grand-Pré 45');
  const addressCityCountry = info
    ? `${info.postalCode} ${info.city}, ${info.country}`
    : isClient
      ? t('rumi_address_city_country')
      : '1202 Genève, Switzerland';

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">{t('terms_of_usage.title', 'Terms of Usage')}</h1>

      <div className="prose dark:prose-invert max-w-none">
        <p className="mb-4">{t('terms_of_usage.last_updated', { date: new Date().toLocaleDateString() })}</p>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">
            {t('terms_of_usage.agreement_title', '1. Agreement to Terms')}
          </h2>
          <p>{t('terms_of_usage.agreement_text')}</p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">
            {t('terms_of_usage.ip_rights_title', '2. Intellectual Property Rights')}
          </h2>
          <p>{t('terms_of_usage.ip_rights_text')}</p>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">
            {t('terms_of_usage.user_reps_title', '3. User Representations')}
          </h2>
          <p>{t('terms_of_usage.user_reps_text')}</p>
          <ul className="list-disc pl-6 mt-2">
            <li>
              {t(
                'terms_of_usage.user_reps_list_1',
                'All registration information you submit will be true, accurate, current, and complete.',
              )}
            </li>
            <li>
              {t(
                'terms_of_usage.user_reps_list_2',
                'You will maintain the accuracy of such information and promptly update such registration information as necessary.',
              )}
            </li>
            <li>
              {t(
                'terms_of_usage.user_reps_list_3',
                'You have the legal capacity and you agree to comply with these Terms of Usage.',
              )}
            </li>
            <li>
              {t('terms_of_usage.user_reps_list_4', 'You are not a minor in the jurisdiction in which you reside.')}
            </li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-2xl font-semibold mb-3">{t('terms_of_usage.contact_title', '4. Contact Us')}</h2>
          <p>{t('terms_of_usage.contact_text')}</p>
          <address className="mt-2 not-italic">
            {info?.name ?? 'RUMI Restaurant'}
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
