// src/app/reservations-mobile/page.tsx
"use client";

import React, { useState } from "react";
// import type { Metadata } from "next"; // Static metadata
import Link from "next/link";
import styles from "../styles/ReservationsMobile.module.css";
import { useTranslation } from "react-i18next"; // Import useTranslation

// export const metadata: Metadata = {
//   title: "Book a Table - RUMI Restaurant Mobile",
//   description: "Make a reservation at RUMI Restaurant in Geneva. Easy online booking for your convenience.",
// };

export default function ReservationsMobilePage() {
  const { t } = useTranslation(); // Initialize useTranslation
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState("2");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const handleSubmitReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !time || !guests || !name || !phone) {
      alert(t("reservation_validation_error"));
      return;
    }
    console.log("Mobile Reservation Request:", {
      date,
      time,
      guests,
      name,
      phone,
      notes,
    });
    alert(t("reservation_request_sent"));
  };

  const getTodayDate = () => {
    const today = new Date();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const day = today.getDate().toString().padStart(2, "0");
    return `${today.getFullYear()}-${month}-${day}`;
  };

  return (
    <main className={styles.reservationsContainerMobile} aria-labelledby="reservation-heading">
      <header className={styles.reservationsHeaderMobile}>
        <Link href="/welcome-mobile" className={styles.backButtonReservationsMobile} aria-label={t("back_to_welcome")}>
          &larr;
        </Link>
        <h1 id="reservation-heading">{t("reservations_title")}</h1>
        <span style={{width: "40px"}}></span> {/* Spacer */}
      </header>
      <p className={styles.pageDescriptionMobile}>{t("reservations_description")}</p>

      <form onSubmit={handleSubmitReservation} className={styles.reservationFormMobile}>
        <p className={styles.formDescriptionMobile}>
          {t("reservations_form_intro")}
        </p>

        <div className={styles.formRowMobile}>
          <div className={styles.formGroupMobileHalf}>
            <label htmlFor="reservationDateMobile">{t("date_label")}</label>
            <input
              type="date"
              id="reservationDateMobile"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              min={getTodayDate()}
              className={styles.inputFieldReservationsMobile}
            />
          </div>
          <div className={styles.formGroupMobileHalf}>
            <label htmlFor="reservationTimeMobile">{t("time_label")}</label>
            <input
              type="time"
              id="reservationTimeMobile"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
              className={styles.inputFieldReservationsMobile}
              min="11:00"
              max="22:00"
            />
          </div>
        </div>

        <div className={styles.formGroupMobile}>
          <label htmlFor="reservationGuestsMobile">{t("guests_label")}</label>
          <select
            id="reservationGuestsMobile"
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            required
            className={styles.selectFieldReservationsMobile}
          >
            {[...Array(9)].map((_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1} {t(i + 1 > 1 ? "guest_plural" : "guest_singular")}
              </option>
            ))}
            <option value="10+">{t("guests_10_plus")}</option>
          </select>
        </div>

        <div className={styles.formGroupMobile}>
          <label htmlFor="reservationNameMobile">{t("full_name_label")}</label>
          <input
            type="text"
            id="reservationNameMobile"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={styles.inputFieldReservationsMobile}
            placeholder={t("full_name_placeholder")}
          />
        </div>

        <div className={styles.formGroupMobile}>
          <label htmlFor="reservationPhoneMobile">{t("customer_phone_label")}</label>
          <input
            type="tel"
            id="reservationPhoneMobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className={styles.inputFieldReservationsMobile}
            placeholder={t("customer_phone_placeholder")}
          />
        </div>

        <div className={styles.formGroupMobile}>
          <label htmlFor="reservationNotesMobile">{t("special_requests_label")}</label>
          <textarea
            id="reservationNotesMobile"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={styles.textareaFieldReservationsMobile}
            placeholder={t("special_requests_placeholder")}
          />
        </div>

        <button type="submit" className={styles.submitButtonReservationsMobile}>
          {t("request_reservation_button")}
        </button>

        <p className={styles.confirmationNoteMobile}>
          {t("reservation_confirmation_note")}
        </p>
      </form>
    </main>
  );
}

