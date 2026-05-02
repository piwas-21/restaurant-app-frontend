'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import { Star, LogIn } from 'lucide-react';
import styles from '../../app/styles/CustomerInfoPage.module.css';

/**
 * Sign-up CTA shown to anonymous customers on the customer-info checkout
 * page. Static — no state of its own, just navigation handlers.
 *
 * Stylesheet is shared with the customer-info page rather than duplicated;
 * the design tokens belong to the page surface and the styles read more
 * naturally as one document.
 */
export default function RegistrationEncouragement() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <div className={styles.registrationSection}>
      <div className={styles.registrationCard}>
        <div className={styles.registrationHeader}>
          <Star size={24} className={styles.registrationIcon} />
          <h2 className={styles.registrationTitle}>{t('dont_have_account', "Don't have an account yet?")}</h2>
        </div>
        <p className={styles.registrationDescription}>
          {t('register_benefits', 'Create a RUMI account to unlock exclusive benefits')}
        </p>
        <div className={styles.benefitsList}>
          <div className={styles.benefitItem}>
            <Star size={18} className={styles.benefitIcon} />
            <span>{t('benefit_fidelity', 'Earn Fidelity Points on every order')}</span>
          </div>
          <div className={styles.benefitItem}>
            <Star size={18} className={styles.benefitIcon} />
            <span>{t('benefit_rewards', 'Redeem points for discounts')}</span>
          </div>
          <div className={styles.benefitItem}>
            <Star size={18} className={styles.benefitIcon} />
            <span>{t('benefit_tracking', 'Track your order history')}</span>
          </div>
          <div className={styles.benefitItem}>
            <Star size={18} className={styles.benefitIcon} />
            <span>{t('benefit_reservations', 'Manage your reservations easily')}</span>
          </div>
        </div>
        <button type="button" onClick={() => router.push('/auth/register')} className={styles.registerButton}>
          <LogIn size={18} />
          {t('register_now', 'Register Now')}
        </button>
        <p className={styles.registrationFooter}>
          {t('already_member', 'Already a member?')}
          <button type="button" onClick={() => router.push('/auth/login')} className={styles.loginLink}>
            {t('login_here', 'Login here')}
          </button>
        </p>
      </div>
    </div>
  );
}
