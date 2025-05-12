// src/app/auth-mobile/login/page.tsx
"use client";

import React, { useState } from "react";
// import type { Metadata } from "next"; // Static metadata
import Link from "next/link";
import styles from "../../styles/AuthMobile.module.css";
import { useTranslation } from "react-i18next"; // Import useTranslation

// export const metadata: Metadata = {
//   title: "Login - RUMI Restaurant Mobile",
//   description: "Login to your RUMI Restaurant account to access member perks and order history.",
// };

export default function LoginMobilePage() {
  const { t } = useTranslation(); // Initialize useTranslation
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Mobile Login attempt:", { email });
    alert(t("login_attempt_placeholder"));
  };

  return (
    <main className={styles.authMobileContainer} aria-labelledby="login-heading">
      <header className={styles.authHeaderMobile}>
        <Link href="/welcome-mobile" className={styles.backButtonAuthMobile} aria-label={t("back_to_welcome")}>
          &larr;
        </Link>
        <h1 id="login-heading">{t("login_title")}</h1>
        <span style={{width: "40px"}}></span> {/* Spacer */}
      </header>
      <p className={styles.authDescriptionMobile}>{t("login_description")}</p>

      <form onSubmit={handleLogin} className={styles.authFormMobile}>
        <div className={styles.formGroupAuthMobile}>
          <label htmlFor="emailMobile">{t("email_address_label")}</label>
          <input
            type="email"
            id="emailMobile"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.inputFieldAuthMobile}
            placeholder={t("email_placeholder")}
          />
        </div>

        <div className={styles.formGroupAuthMobile}>
          <label htmlFor="passwordMobile">{t("password_label")}</label>
          <input
            type="password"
            id="passwordMobile"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.inputFieldAuthMobile}
            placeholder={t("password_placeholder")}
          />
        </div>

        <button type="submit" className={styles.submitButtonAuthMobile}>
          {t("login_button")}
        </button>

        <p className={styles.authLinkMobile}>
          {t("login_no_account")}{" "}
          <Link href="/auth-mobile/register">{t("register_here_link")}</Link>
        </p>
      </form>
    </main>
  );
}

