// src/app/auth-mobile/register/page.tsx
"use client";

import React, { useState } from "react";
// import type { Metadata } from "next"; // Static metadata
import Link from "next/link";
import styles from "../../styles/AuthMobile.module.css"; // Shared style with login
import { useTranslation } from "react-i18next"; // Import useTranslation

// export const metadata: Metadata = {
//   title: "Register - RUMI Restaurant Mobile",
//   description: "Create your RUMI Restaurant account to enjoy member benefits.",
// };

export default function RegisterMobilePage() {
  const { t } = useTranslation(); // Initialize useTranslation
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert(t("passwords_do_not_match"));
      return;
    }
    console.log("Mobile Registration attempt:", { name, email });
    alert(t("registration_attempt_placeholder"));
  };

  return (
    <main className={styles.authMobileContainer} aria-labelledby="register-heading">
      <header className={styles.authHeaderMobile}>
        <Link href="/welcome-mobile" className={styles.backButtonAuthMobile} aria-label={t("back_to_welcome")}>
          &larr;
        </Link>
        <h1 id="register-heading">{t("register_title")}</h1>
        <span style={{width: "40px"}}></span> {/* Spacer */}
      </header>
      <p className={styles.authDescriptionMobile}>{t("register_description")}</p>

      <form onSubmit={handleRegister} className={styles.authFormMobile}>
        <div className={styles.formGroupAuthMobile}>
          <label htmlFor="nameMobile">{t("full_name_label")}</label>
          <input
            type="text"
            id="nameMobile"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={styles.inputFieldAuthMobile}
            placeholder={t("full_name_placeholder")}
          />
        </div>

        <div className={styles.formGroupAuthMobile}>
          <label htmlFor="emailRegisterMobile">{t("email_address_label")}</label>
          <input
            type="email"
            id="emailRegisterMobile"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.inputFieldAuthMobile}
            placeholder={t("email_placeholder")}
          />
        </div>

        <div className={styles.formGroupAuthMobile}>
          <label htmlFor="passwordRegisterMobile">{t("password_label")}</label>
          <input
            type="password"
            id="passwordRegisterMobile"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className={styles.inputFieldAuthMobile}
            placeholder={t("create_password_placeholder")}
          />
        </div>

        <div className={styles.formGroupAuthMobile}>
          <label htmlFor="confirmPasswordMobile">{t("confirm_password_label")}</label>
          <input
            type="password"
            id="confirmPasswordMobile"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            className={styles.inputFieldAuthMobile}
            placeholder={t("confirm_password_placeholder")}
          />
        </div>

        <button type="submit" className={styles.submitButtonAuthMobile}>
          {t("register_button")}
        </button>

        <p className={styles.authLinkMobile}>
          {t("register_has_account")}{" "}
          <Link href="/auth-mobile/login">{t("login_here_link")}</Link>
        </p>
      </form>
    </main>
  );
}

