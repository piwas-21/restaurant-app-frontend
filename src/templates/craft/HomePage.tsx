'use client';

// craft HomePage (ADR-006, S15 T3 slice 1). Same data sources as
// classic/HomePage.tsx (useRestaurantInfo, workingHoursService,
// ContactIcons, BRANDING_HERO/RESTAURANT_NAME, FooterCookieLink,
// useTranslation via useCraftHomeData.ts) composed as a distinct craft
// layout: a full-bleed photo hero with a warm tint overlay + centered
// craft content, tilted letterpress cards, and a dotted-leader
// menu-board section for opening hours. Zero gradients — styled
// exclusively via craft tokens (./tokens.css) + craft utility classes
// (./craft.module.css). Reuses every existing i18n key; no
// `template.craft.*` keys were needed.
import React from 'react';
import Link from 'next/link';
import { UtensilsCrossed, CalendarCheck } from 'lucide-react';
import FooterCookieLink from '@/components/FooterCookieLink';
import PartnerCredit from '@/components/PartnerCredit';
import ContactIcons from '@/components/home/ContactIcons';
import styles from './HomePage.module.css';
import craft from './craft.module.css';
import { useCraftHomeData } from './useCraftHomeData';
import { useModuleEnabled } from '@/contexts/ModulesContext';

export default function HomePage() {
  // A CTA into a module this tenant did not buy leads only to the blocked page (O5).
  const reservationsEnabled = useModuleEnabled('reservations');
  const {
    t,
    copy,
    info,
    isLoadingHours,
    groupedHours,
    backgroundImageUrl,
    googleMapsEmbedUrl,
    restaurantName,
    heroSubtitle,
    addressStreet,
    addressCityCountry,
    phoneDisplay,
    phoneTel,
  } = useCraftHomeData();

  return (
    <div className={styles.homeContainer}>
      <section
        className={styles.hero}
        style={{ backgroundImage: `url(${backgroundImageUrl})` }}
        aria-labelledby="hero-heading"
      >
        <div className={styles.heroOverlay} aria-hidden="true" />
        <div className={styles.heroContent}>
          <span className={craft.tapeLabel}>{copy('home_hero_eyebrow')}</span>
          <h1 id="hero-heading" className={styles.heroTitle}>
            {copy('home_hero_title')}
          </h1>
          <p className={styles.heroSubtitle}>{heroSubtitle}</p>
          <div className={styles.ctaRow}>
            <Link href="/menu" className={styles.ctaPrimary} role="button">
              <UtensilsCrossed size={20} strokeWidth={2.5} />
              <span>{copy('home_menu_cta')}</span>
            </Link>
            {reservationsEnabled && (
              <Link href="/reservations" className={styles.ctaSecondary} role="button">
                <CalendarCheck size={20} strokeWidth={2.5} />
                <span>{copy('home_reservations_cta')}</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className={styles.pageContentWrapper}>
        <section aria-labelledby="story-heading">
          <div className={styles.storyCard}>
            <h2 id="story-heading" className={craft.tapeLabel}>
              {copy('home_story_title')}
            </h2>
            <p>{copy('home_story_content', { name: restaurantName, city: info?.city ?? '' })}</p>
          </div>
        </section>

        {info && info.phoneNumbers?.some((p) => p.isActive) && <ContactIcons phones={info.phoneNumbers} />}

        <section aria-labelledby="hours-heading">
          <h2 id="hours-heading" className={craft.tapeLabel}>
            {copy('home_opening_hours_title')}
          </h2>
          <div className={styles.menuBoard}>
            {isLoadingHours ? (
              <p>{t('loading', 'Loading...')}</p>
            ) : groupedHours.length > 0 ? (
              groupedHours.map((group, index) => (
                <p key={index} className={craft.menuLeader}>
                  <span>{group.days}</span>
                  <span>{group.hours}</span>
                </p>
              ))
            ) : (
              <>
                <p className={craft.menuLeader}>
                  <span>{copy('home_opening_hours_days_1')}</span>
                  <span>{copy('home_opening_hours_time_1')}</span>
                </p>
                <p className={craft.menuLeader}>
                  <span>{copy('home_opening_hours_days_2')}</span>
                  <span>{copy('home_opening_hours_time_2')}</span>
                </p>
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="location-heading">
          <div className={styles.locationCard}>
            <h2 id="location-heading" className={craft.tapeLabel}>
              {copy('home_location_title')}
            </h2>
            <address>
              {addressStreet}
              <br />
              {addressCityCountry}
              <br />
              {phoneDisplay && (
                <>
                  {copy('phone_label')}: <a href={`tel:${phoneTel}`}>{phoneDisplay}</a>
                </>
              )}
            </address>
            {googleMapsEmbedUrl && (
              <div className={styles.mapFrame}>
                <iframe
                  src={googleMapsEmbedUrl}
                  width="100%"
                  height="380"
                  style={{ border: 0 }}
                  allowFullScreen={true}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={copy('google_maps_iframe_title', { name: restaurantName })}
                  aria-label={copy('google_maps_iframe_aria_label')}
                ></iframe>
              </div>
            )}
          </div>
        </section>

        <footer className={styles.homeFooter}>
          <p>{copy('home_footer_copyright', { year: new Date().getFullYear(), name: restaurantName })}</p>
          {info && (
            <p>
              {addressStreet}, {addressCityCountry}
            </p>
          )}
          <div className={styles.footerLinks}>
            <Link href="/privacy-policy" className={styles.footerLink}>
              {copy('footer_privacy_policy')}
            </Link>
            <Link href="/terms-of-usage" className={styles.footerLink}>
              {copy('footer_terms_of_usage')}
            </Link>
          </div>
          <FooterCookieLink />
          <PartnerCredit />
        </footer>
      </div>
    </div>
  );
}
