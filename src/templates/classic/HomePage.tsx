'use client';

import React, { useState, useEffect } from 'react';
import styles from './HomePage.module.css';
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import FooterCookieLink from '@/components/FooterCookieLink';
import { UtensilsCrossed, CalendarCheck } from 'lucide-react';
import { workingHoursService } from '@/services/workingHoursService';
import { WorkingHoursDto } from '@/types/workingHours';
import { formatDayHours } from '@/lib/workingHoursDisplay';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import ContactIcons from '@/components/home/ContactIcons';
import { BRANDING_HERO, RESTAURANT_NAME } from '@/lib/config';
import { firstPaintCopy } from '@/lib/firstPaintCopy';
import { homePageTitle } from '@/utils/homePageTitle';
import { useModuleEnabled } from '@/contexts/ModulesContext';

export default function HomePage() {
  // A CTA into a module this tenant did not buy leads only to the blocked page (O5).
  const reservationsEnabled = useModuleEnabled('reservations');
  const { t, i18n } = useTranslation();
  const { info } = useRestaurantInfo();
  const [isClient, setIsClient] = useState(false);
  const [workingHours, setWorkingHours] = useState<WorkingHoursDto[]>([]);
  const [isLoadingHours, setIsLoadingHours] = useState(true);
  // Before hydration this resolves against en.json + this image's tenant copy pack; after it,
  // against the visitor's own language. One callsite per string either way — see lib/firstPaintCopy.ts.
  const copy = isClient ? t : firstPaintCopy(i18n);

  useEffect(() => {
    setIsClient(true);
    document.body.classList.add('is-homepage');
    return () => {
      document.body.classList.remove('is-homepage');
    };
  }, []);

  // Fetch working hours
  useEffect(() => {
    const fetchWorkingHours = async () => {
      try {
        const hours = await workingHoursService.getAll();
        // Sort by day of week (Sunday=0, Monday=1, etc.)
        const sorted = hours.sort((a, b) => {
          const dayA = typeof a.dayOfWeek === 'number' ? a.dayOfWeek : getDayNumber(a.dayOfWeek);
          const dayB = typeof b.dayOfWeek === 'number' ? b.dayOfWeek : getDayNumber(b.dayOfWeek);
          return dayA - dayB;
        });
        setWorkingHours(sorted);
      } catch (error) {
        console.error('Failed to fetch working hours:', error);
        // Keep empty array, will fall back to hardcoded values
      } finally {
        setIsLoadingHours(false);
      }
    };

    // fetchWorkingHours has its own try/catch (logs and keeps empty); fire-and-forget.
    void fetchWorkingHours();
  }, []);

  useEffect(() => {
    if (isClient) {
      document.title = homePageTitle(t, {
        name: info?.name ?? RESTAURANT_NAME,
        city: info?.city,
        country: info?.country,
      });
    }
  }, [isClient, t, i18n.language, info]);

  // Maps embed built from the RestaurantInfo API address (issue #125) —
  // no tenant coordinates are hardcoded; the iframe renders only once the
  // API address is available.
  const mapAddressQuery = info?.addressLine1
    ? [info.addressLine1, info.postalCode, info.city, info.country].filter(Boolean).join(', ')
    : null;
  const googleMapsEmbedUrl = mapAddressQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapAddressQuery)}&output=embed`
    : null;
  const backgroundImageUrl = BRANDING_HERO;

  // Helper functions for working hours
  const getDayNumber = (day: string | number): number => {
    if (typeof day === 'number') return day;
    const dayMap: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    return dayMap[day] ?? 0;
  };

  const getDayName = (dayOfWeek: string | number): string => {
    const dayNum = typeof dayOfWeek === 'number' ? dayOfWeek : getDayNumber(dayOfWeek);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return t(days[dayNum]);
  };

  const groupWorkingHours = () => {
    if (workingHours.length === 0) return [];

    const groups: Array<{ days: string; hours: string }> = [];
    let currentGroup: number[] = [];
    let currentHours = '';

    workingHours.forEach((wh, index) => {
      const dayNum = getDayNumber(wh.dayOfWeek);
      // EVERY window of the day, not just the first: a restaurant serving 11:00-15:00 and
      // 18:00-23:00 reads as "11:00 AM - 3:00 PM, 6:00 PM - 11:00 PM" here (G11). Days that share
      // the resulting string still group, exactly as before.
      const hours = formatDayHours(wh, t('closed', 'Closed'));

      if (currentHours === hours) {
        currentGroup.push(dayNum);
      } else {
        if (currentGroup.length > 0) {
          groups.push({
            days: formatDayRange(currentGroup),
            hours: currentHours,
          });
        }
        currentGroup = [dayNum];
        currentHours = hours;
      }

      if (index === workingHours.length - 1 && currentGroup.length > 0) {
        groups.push({
          days: formatDayRange(currentGroup),
          hours: currentHours,
        });
      }
    });

    return groups;
  };

  const formatDayRange = (days: number[]): string => {
    if (days.length === 0) return '';
    if (days.length === 1) return getDayName(days[0]);

    // Check if consecutive
    const isConsecutive = days.every((day, i) => i === 0 || day === days[i - 1] + 1);

    if (isConsecutive) {
      return `${getDayName(days[0])} - ${getDayName(days[days.length - 1])}`;
    }

    // Not consecutive, list all days
    return days.map((d) => getDayName(d)).join(', ');
  };

  // Restaurant identity comes exclusively from the RestaurantInfo API
  // (issue #125): no tenant-1 literals — sections stay blank until it loads.
  const restaurantName = info?.name ?? RESTAURANT_NAME;
  const addressStreet = info?.addressLine1 ?? '';
  const addressCityCountry = info ? `${info.postalCode} ${info.city}, ${info.country}` : '';
  // The hero names the tenant's city, so it waits for RestaurantInfo like every other
  // identity value above rather than baking one in (#125). Interpolating an empty city
  // would leave a dangling "…Begins Here in ." on the most visible copy on the site, so
  // the cityless variant covers the pre-load window instead.
  const heroSubtitle = info?.city
    ? copy('home_hero_subtitle', { city: info.city })
    : copy('home_hero_subtitle_no_city');
  const primaryPhone = info?.phoneNumbers.find((p) => p.isActive) ?? info?.phoneNumbers[0] ?? null;
  const phoneDisplay = primaryPhone?.number ?? '';
  const phoneTel = phoneDisplay.replace(/\s/g, '');

  return (
    <div className={styles.homeContainer}>
      <section
        className={styles.heroHeaderSection}
        style={{ backgroundImage: `url(${backgroundImageUrl})` }}
        aria-labelledby="hero-heading"
      >
        <div className={styles.glassOverlay}></div>
        <div className={styles.heroContent}>
          <h1 id="hero-heading" className={styles.heroTitle}>
            {copy('home_hero_title')}
          </h1>
          <p className={styles.heroSubtitle}>{heroSubtitle}</p>
          <div className={styles.ctaButtons}>
            <Link href="/menu" className={styles.ctaButtonPrimary} role="button">
              <UtensilsCrossed size={24} strokeWidth={2.5} />
              <span className={styles.ctaButtonText}>{copy('home_menu_cta')}</span>
            </Link>
            {reservationsEnabled && (
              <Link href="/reservations" className={styles.ctaButtonSecondary} role="button">
                <CalendarCheck size={24} strokeWidth={2.5} />
                <span className={styles.ctaButtonText}>{copy('home_reservations_cta')}</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className={styles.pageContentWrapper}>
        <section className={styles.storySection} aria-labelledby="story-heading">
          <h2 id="story-heading">{copy('home_story_title')}</h2>
          <p>{copy('home_story_content', { name: restaurantName, city: info?.city ?? '' })}</p>
        </section>

        {info?.interiorImageUrl && (
          // Rendered only when the restaurant uploaded a photo. There is deliberately no
          // fallback: BRANDING_HERO is a neutral platform graphic that belongs to no
          // restaurant, so showing it under this heading would say something untrue about
          // this tenant. The backend normalises an absent value to null (never ''), which
          // is what lets this guard work.
          <section className={styles.interiorSection} aria-labelledby="interior-heading">
            <h2 id="interior-heading">{copy('home_interior_title')}</h2>
            <Image
              src={info.interiorImageUrl}
              alt={t('home_interior_alt', 'Inside {{name}}', { name: restaurantName })}
              width={1200}
              height={800}
              className={styles.interiorImage}
              sizes="(max-width: 768px) 100vw, 900px"
            />
          </section>
        )}

        {info && info.phoneNumbers.some((p) => p.isActive) && <ContactIcons phones={info.phoneNumbers} />}

        <section className={styles.openingHoursSection} aria-labelledby="hours-heading">
          <h2 id="hours-heading">{copy('home_opening_hours_title')}</h2>
          {isLoadingHours ? (
            <p>{t('loading', 'Loading...')}</p>
          ) : workingHours.length > 0 ? (
            <div>
              {groupWorkingHours().map((group, index) => (
                <p key={index}>
                  {group.days}: {group.hours}
                </p>
              ))}
            </div>
          ) : (
            <p>
              {copy('home_opening_hours_days_1')}: {copy('home_opening_hours_time_1')}
              <br />
              {copy('home_opening_hours_days_2')}: {copy('home_opening_hours_time_2')}
            </p>
          )}
        </section>

        <section className={styles.locationSection} aria-labelledby="location-heading">
          <h2 id="location-heading">{copy('home_location_title')}</h2>
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
            <div className={styles.mapContainer}>
              <iframe
                src={googleMapsEmbedUrl}
                width="100%"
                height="450"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={copy('google_maps_iframe_title', { name: restaurantName })}
                aria-label={copy('google_maps_iframe_aria_label')}
              ></iframe>
            </div>
          )}
        </section>

        <footer className={styles.homeFooter}>
          <p>
            {/* Name from the RestaurantInfo API (issue #125); baked build-time
                name while it loads / if it's unreachable. */}
            {copy('home_footer_copyright', { year: new Date().getFullYear(), name: restaurantName })}
          </p>
          {info && (
            <p>
              {addressStreet}, {addressCityCountry}
            </p>
          )}
          <div
            style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}
          >
            <Link href="/privacy-policy" style={{ color: 'inherit', textDecoration: 'underline', fontSize: '0.9rem' }}>
              {copy('footer_privacy_policy')}
            </Link>
            <Link href="/terms-of-usage" style={{ color: 'inherit', textDecoration: 'underline', fontSize: '0.9rem' }}>
              {copy('footer_terms_of_usage')}
            </Link>
          </div>
          <FooterCookieLink />
        </footer>
      </div>
    </div>
  );
}
