"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../../app/styles/AccountPage.module.css'; // Assuming styles are shared

interface FidelityPointsSectionProps {
  fidelityPoints: number;
  pointsForNextReward?: number; // Optional: can be configured or fetched
}

export default function FidelityPointsSection({ fidelityPoints, pointsForNextReward = 500 }: FidelityPointsSectionProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('fidelity_points_title', 'Fidelity Points')}</h2>
      <p className={styles.fidelityPointsText}>
        {t('total_fidelity_points_label', 'Your Total Points:')} <strong>{fidelityPoints}</strong>
      </p>
      {fidelityPoints > 0 && pointsForNextReward && (
          (pointsForNextReward - (fidelityPoints % pointsForNextReward) > 0 && fidelityPoints < 10000) ? // Arbitrary upper limit for this specific message
          <p className={styles.fidelityMessage}>
              {t('points_to_next_reward_message', { points: pointsForNextReward - (fidelityPoints % pointsForNextReward) })}
          </p>
          :
          <p className={styles.fidelityMessage}>{t('earn_more_points_message', 'Earn more points with every order!')}</p>
      )}
       {fidelityPoints === 0 && (
           <p className={styles.fidelityMessage}>{t('earn_more_points_message', 'Earn more points with every order!')}</p>
       )}
    </section>
  );
}
