// src/app/page.tsx
"use client";

import React from "react";
import styles from "./styles/HomePage.module.css";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t, i18n } = useTranslation();

  const googleMapsEmbedUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2761.9879077000003!2d6.1423647!3d46.2093549!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x478c6527ab39c7f7%3A0x1d5b380909c0e60a!2sRue%20de%20Berne%2013%2C%201201%20Gen%C3%A8ve%2C%20Switzerland!5e0!3m2!1sen!2sch!4v1715517619196!5m2!1sen!2sch";

  React.useEffect(() => {
    document.title = t("home_page_title");
  }, [t, i18n.language]);

  return (
    <main aria-labelledby="main-heading">
      <section className={styles.heroSection} aria-labelledby="hero-heading">
        <h1 id="hero-heading" className={styles.heroTitle}>{t("home_hero_title")}</h1>
        <p className={styles.heroSubtitle}>{t("home_hero_subtitle")}</p>
        <div className={styles.ctaButtons}>
            <Link href="/menu" className={styles.ctaButtonPrimary} role="button">{t("home_menu_cta")}</Link>
            <Link href="/reservations" className={styles.ctaButtonSecondary} role="button">{t("home_reservations_cta")}</Link>
        </div>
      </section>

      <section className={styles.storySection} aria-labelledby="story-heading">
        <h2 id="story-heading">{t("home_story_title")}</h2>
        <p>{t("home_story_content")}</p>
      </section>

      <section className={styles.openingHoursSection} aria-labelledby="hours-heading">
        <h2 id="hours-heading">{t("home_opening_hours_title")}</h2>
        <p>
          {t("home_opening_hours_days_1")}: {t("home_opening_hours_time_1")}<br/>
          {t("home_opening_hours_days_2")}: {t("home_opening_hours_time_2")}
        </p>
      </section>

      <section className={styles.locationSection} aria-labelledby="location-heading">
        <h2 id="location-heading">{t("home_location_title")}</h2>
        <address>
          {t("rumi_address_street")}<br/>
          {t("rumi_address_city_country")}<br/>
          {t("phone_label")}: <a href={`tel:${t("rumi_phone_number").replace(/\s/g, "")}`}>{t("rumi_phone_number")}</a>
        </address>
        <div className={styles.mapContainer}>
          <iframe 
            src={googleMapsEmbedUrl}
            width="100%" 
            height="450" 
            style={{border:0}} 
            allowFullScreen={true} 
            loading="lazy" 
            referrerPolicy="no-referrer-when-downgrade"
            title={t("google_maps_iframe_title")}
            aria-label={t("google_maps_iframe_aria_label")}
          ></iframe>
        </div>
      </section>
    </main>
  );
}

