'use client';

import { useTranslation } from 'react-i18next';
import { useTenantPartner } from '@/hooks/useTenantPartner';
import styles from './PartnerCredit.module.css';

/**
 * "Site by <partner>" in a tenant footer — the render half of SOFRA-PARTNER-PLAN §11e,
 * decision D-B1: ATTRIBUTION ONLY. A brand name and a website, nothing else. No postal
 * address, no personal legal name, no phone — those are `BillingIdentity`, a private legal
 * record, and publishing them on a restaurant's page is what §11b exists to prevent.
 *
 * ONE component for FOUR render sites, because the chrome hides its footer on the home page
 * and each template's home page composes its own: classic chrome + classic HomePage +
 * CraftFooter + craft HomePage. Shipping two of the four would make the credit appear on the
 * menu page and vanish on the most-visited page of the site.
 *
 * Renders NOTHING — no wrapper, no whitespace — when there is no name to show. "No partner",
 * "not loaded yet" and "the API is unreachable" are deliberately one branch: the backend
 * answers a tenant with no attribution with `200 {"name":null,"url":null}`, not a 404, and
 * every one of the three must leave the footer byte-identical to what it renders today.
 *
 * It takes no props: the credit inherits its colour and font from whichever footer holds it,
 * so the same markup sits correctly in the classic band and in the craft kraft band.
 */
export default function PartnerCredit() {
  const { t } = useTranslation();
  const partner = useTenantPartner();

  const name = partner?.name?.trim();
  if (!name) return null;

  // Safe to translate without an `isClient` guard, unlike its neighbours in these footers:
  // the attribution is fetched in an effect, so `name` is null on the server AND on the
  // first client render. Nothing here is ever part of the hydrated HTML.
  const label = t('footer_site_by', { name });
  const url = partner?.url?.trim();

  return (
    <p className={styles.credit}>
      {url ? (
        // A partner-supplied URL on a public page: `noopener noreferrer` is not optional.
        <a href={url} className={styles.link} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        // The backend withholds a non-https url and still serves the name. Plain text, never
        // an anchor with no destination.
        label
      )}
    </p>
  );
}
