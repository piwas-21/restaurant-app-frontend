"use client";

import React from 'react';
import { useTranslation } from 'react-i18next';
import styles from '../../app/styles/AccountPage.module.css'; 
// Import the specific error keys type from the main page
import type { UserProfile, ProfileErrorKeys } from '../../app/account/page';

interface PersonalInfoSectionProps {
  profile: UserProfile;
  // Use the imported ProfileErrorKeys for profileErrors prop
  profileErrors: Partial<Record<ProfileErrorKeys, string>>;
  profileSuccess: string;
  handleProfileChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleProfileSave: (e: React.FormEvent) => Promise<void>;
}

export default function PersonalInfoSection({ 
    profile, 
    profileErrors, 
    profileSuccess, 
    handleProfileChange, 
    handleProfileSave 
}: PersonalInfoSectionProps) {
  const { t } = useTranslation();

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{t('personal_information_title', 'Personal Information')}</h2>
      {profileSuccess && <p className={styles.successMessage}>{profileSuccess}</p>}
      {profileErrors.form && <p className={styles.errorMessage}>{profileErrors.form}</p>}
      <form onSubmit={handleProfileSave} noValidate>
        <div className={styles.formGroup}>
          <label htmlFor="fullName">{t('full_name_label', 'Full Name')}</label>
          <input type="text" id="fullName" name="fullName" value={profile.fullName} onChange={handleProfileChange} className={styles.formInput} />
          {profileErrors.fullName && <p className={styles.errorMessage}>{profileErrors.fullName}</p>}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="email">{t('email_label', 'Email')}</label>
          <input type="email" id="email" name="email" value={profile.email} onChange={handleProfileChange} className={styles.formInput} />
          {profileErrors.email && <p className={styles.errorMessage}>{profileErrors.email}</p>}
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="phoneNumber">{t('customer_phone_label', 'Phone Number')}</label>
          <input type="tel" id="phoneNumber" name="phoneNumber" value={profile.phoneNumber} onChange={handleProfileChange} className={styles.formInput} />
          {profileErrors.phoneNumber && <p className={styles.errorMessage}>{profileErrors.phoneNumber}</p>}
        </div>

        <h3 style={{ marginTop: '2rem', marginBottom: '1rem', fontSize: '1.2rem' }}>{t('delivery_address_label', 'Delivery Address')}</h3>
        <div className={styles.addressGrid}>
            <div className={styles.formGroup}>
                <label htmlFor="deliveryAddress.street">{t('address_street_label', 'Street & Number')}</label>
                <input type="text" id="deliveryAddress.street" name="deliveryAddress.street" value={profile.deliveryAddress.street} onChange={handleProfileChange} className={styles.formInput} />
                {profileErrors["deliveryAddress.street"] && <p className={styles.errorMessage}>{profileErrors["deliveryAddress.street"]}</p>}
            </div>
            <div className={styles.formGroup}>
                <label htmlFor="deliveryAddress.city">{t('address_city_label', 'City')}</label>
                <input type="text" id="deliveryAddress.city" name="deliveryAddress.city" value={profile.deliveryAddress.city} onChange={handleProfileChange} className={styles.formInput} />
                {profileErrors["deliveryAddress.city"] && <p className={styles.errorMessage}>{profileErrors["deliveryAddress.city"]}</p>}
            </div>
            <div className={styles.formGroup}>
                <label htmlFor="deliveryAddress.zipCode">{t('address_zip_label', 'ZIP Code')}</label>
                <input type="text" id="deliveryAddress.zipCode" name="deliveryAddress.zipCode" value={profile.deliveryAddress.zipCode} onChange={handleProfileChange} className={styles.formInput} />
                {profileErrors["deliveryAddress.zipCode"] && <p className={styles.errorMessage}>{profileErrors["deliveryAddress.zipCode"]}</p>}
            </div>
            <div className={styles.formGroup}>
                <label htmlFor="deliveryAddress.country">{t('address_country_label', 'Country')}</label>
                <input type="text" id="deliveryAddress.country" name="deliveryAddress.country" value={profile.deliveryAddress.country} onChange={handleProfileChange} className={styles.formInput} />
                {profileErrors["deliveryAddress.country"] && <p className={styles.errorMessage}>{profileErrors["deliveryAddress.country"]}</p>}
            </div>
        </div>
        
        <div className={styles.formActions}>
          <button type="submit" className={styles.saveButton}>{t('save_changes_button', 'Save Changes')}</button>
        </div>
      </form>
    </section>
  );
}
