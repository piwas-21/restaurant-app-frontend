'use client';

import React from 'react';
import Image from 'next/image';
import { useTranslation } from 'react-i18next';
import { Star, X } from 'lucide-react';
import styles from '@/app/styles/AdminPage.module.css';
import type { SpecialProduct } from '@/hooks/useSpecialsManagement';

interface FeaturedSpecialCardProps {
  featuredSpecial: SpecialProduct | null;
  onRemoveFeatured: () => void;
}

const FeaturedSpecialCard: React.FC<FeaturedSpecialCardProps> = ({ featuredSpecial, onRemoveFeatured }) => {
  const { t } = useTranslation();

  if (!featuredSpecial) {
    return (
      <div className={styles.featuredSpecialCard}>
        <div className={styles.noFeaturedSpecial}>
          <Star size={48} color="#ccc" />
          <p>{t('no_featured_special', 'No featured special selected')}</p>
          <p className={styles.helpText}>
            {t('select_featured_help', 'Select a special from the table below to feature it on the menu page')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.featuredSpecialCard}>
      <div className={styles.featuredSpecialHeader}>
        <div className={styles.featuredSpecialTitle}>
          <Star size={24} fill="gold" color="gold" />
          <h3>{t('featured_special_label', 'Featured Special')}</h3>
        </div>
        <button
          className={`${styles.adminButton} ${styles.delete}`}
          onClick={onRemoveFeatured}
          title={t('remove_featured', 'Remove Featured')}
        >
          <X size={16} />
          {t('remove', 'Remove')}
        </button>
      </div>
      <div className={styles.featuredSpecialContent}>
        {featuredSpecial.imageUrl && (
          <div className={styles.featuredSpecialImage}>
            <Image
              src={featuredSpecial.imageUrl}
              alt={featuredSpecial.name}
              width={200}
              height={200}
              style={{ objectFit: 'cover', borderRadius: '8px' }}
            />
          </div>
        )}
        <div className={styles.featuredSpecialDetails}>
          <h4>{featuredSpecial.name}</h4>
          {featuredSpecial.description && <p>{featuredSpecial.description}</p>}
          <div className={styles.featuredSpecialPrice}>CHF {featuredSpecial.basePrice.toFixed(2)}</div>
          {featuredSpecial.featuredDate && (
            <div className={styles.featuredSpecialDate}>
              {t('featured_since', 'Featured since')}: {new Date(featuredSpecial.featuredDate).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeaturedSpecialCard;
