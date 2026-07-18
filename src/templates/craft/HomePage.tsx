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
import ContactIcons from '@/components/home/ContactIcons';
import styles from './HomePage.module.css';
import craft from './craft.module.css';
import { useCraftHomeData } from './useCraftHomeData';

export default function HomePage() {
  const {
    t,
    info,
    isClient,
    isLoadingHours,
    groupedHours,
    backgroundImageUrl,
    googleMapsEmbedUrl,
    restaurantName,
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
          <span className={craft.tapeLabel}>
            {isClient ? t('authentic_turkish_cuisine') : 'Authentic Turkish Cuisine'}
          </span>
          <h1 id="hero-heading" className={styles.heroTitle}>
            {isClient ? t('home_hero_title') : 'Discover Authentic Turkish Flavors'}
          </h1>
          <p className={styles.heroSubtitle}>
            {isClient ? t('home_hero_subtitle') : 'Your journey into rich tastes and traditions begins here.'}
          </p>
          <div className={styles.ctaRow}>
            <Link href="/menu" className={styles.ctaPrimary} role="button">
              <UtensilsCrossed size={20} strokeWidth={2.5} />
              <span>{isClient ? t('home_menu_cta') : 'View Menu'}</span>
            </Link>
            <Link href="/reservations" className={styles.ctaSecondary} role="button">
              <CalendarCheck size={20} strokeWidth={2.5} />
              <span>{isClient ? t('home_reservations_cta') : 'Book a Table'}</span>
            </Link>
          </div>
        </div>
      </section>

      <div className={styles.pageContentWrapper}>
        <section aria-labelledby="story-heading">
          <div className={styles.storyCard}>
            <h2 id="story-heading" className={craft.tapeLabel}>
              {isClient ? t('home_story_title') : 'Our Story'}
            </h2>
            <p>
              {isClient
                ? t('home_story_content', { name: restaurantName, city: info?.city ?? '' })
                : `${restaurantName} brings the heart of Turkish culinary traditions to your table. Each dish is crafted with the freshest ingredients and a deep respect for authentic recipes.`}
            </p>
          </div>
        </section>

        {info && info.phoneNumbers?.some((p) => p.isActive) && <ContactIcons phones={info.phoneNumbers} />}

        <section aria-labelledby="hours-heading">
          <h2 id="hours-heading" className={craft.tapeLabel}>
            {isClient ? t('home_opening_hours_title') : 'Opening Hours'}
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
                  <span>{isClient ? t('home_opening_hours_days_1') : 'Monday - Saturday'}</span>
                  <span>{isClient ? t('home_opening_hours_time_1') : '11:00 AM - 10:00 PM'}</span>
                </p>
                <p className={craft.menuLeader}>
                  <span>{isClient ? t('home_opening_hours_days_2') : 'Sunday'}</span>
                  <span>{isClient ? t('home_opening_hours_time_2') : '12:00 PM - 9:00 PM'}</span>
                </p>
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="location-heading">
          <div className={styles.locationCard}>
            <h2 id="location-heading" className={craft.tapeLabel}>
              {isClient ? t('home_location_title') : 'Visit Us'}
            </h2>
            <address>
              {addressStreet}
              <br />
              {addressCityCountry}
              <br />
              {phoneDisplay && (
                <>
                  {isClient ? t('phone_label') : 'Phone'}: <a href={`tel:${phoneTel}`}>{phoneDisplay}</a>
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
                  title={
                    isClient ? t('google_maps_iframe_title', { name: restaurantName }) : `Location of ${restaurantName}`
                  }
                  aria-label={
                    isClient ? t('google_maps_iframe_aria_label') : `Google Maps showing location of ${restaurantName}`
                  }
                ></iframe>
              </div>
            )}
          </div>
        </section>

        <footer className={styles.homeFooter}>
          <p>
            {isClient
              ? t('home_footer_copyright', { year: new Date().getFullYear(), name: restaurantName })
              : `© ${new Date().getFullYear()} ${restaurantName}. All rights reserved.`}
          </p>
          {info && (
            <p>
              {addressStreet}, {addressCityCountry}
            </p>
          )}
          <div className={styles.footerLinks}>
            <Link href="/privacy-policy" className={styles.footerLink}>
              {isClient ? t('footer_privacy_policy', 'Privacy Policy') : 'Privacy Policy'}
            </Link>
            <Link href="/terms-of-usage" className={styles.footerLink}>
              {isClient ? t('footer_terms_of_usage', 'Terms of Usage') : 'Terms of Usage'}
            </Link>
          </div>
          <FooterCookieLink />
        </footer>
      </div>
    </div>
  );
}
