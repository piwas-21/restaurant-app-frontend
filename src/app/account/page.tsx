'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'next/navigation';
import styles from '../styles/AccountPage.module.css';

import PersonalInfoSection from '../../components/account/PersonalInfoSection';
import PasswordManagementSection from '../../components/account/PasswordManagementSection';
import FidelityPointsSection from '../../components/account/FidelityPointsSection';
import AddressManagement from '../../components/account/AddressManagement';
import DeleteAccountSection from '../../components/account/DeleteAccountSection';
import { getCurrentUser, updateProfile, type UpdateUserProfileCommand } from '@/services/userService';
import { useAccountPassword } from '@/hooks/account/useAccountPassword';

export interface UserProfile {
  fullName: string;
  email: string;
  phoneNumber: string;
}

export type ProfileErrorKeys = 'fullName' | 'email' | 'phoneNumber' | 'form';

const mockUserProfile: UserProfile = {
  fullName: 'Jane Doe',
  email: 'jane.doe@example.com',
  phoneNumber: '+41 79 123 45 67',
};

export default function AccountPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // Check authentication
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      router.push('/auth/login?redirect=/account');
    }
  }, [router]);

  const [profile, setProfile] = useState<UserProfile>(mockUserProfile);
  const [profileErrors, setProfileErrors] = useState<Partial<Record<ProfileErrorKeys, string>>>({});
  const [profileSuccess, setProfileSuccess] = useState<string>('');

  // Load user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userData = await getCurrentUser();
        setProfile({
          fullName: userData.fullName || `${userData.firstName} ${userData.lastName}`,
          email: userData.email,
          phoneNumber: userData.phoneNumber || '',
        });
      } catch (error) {
        console.error('Failed to load profile:', error);
      }
    };
    // loadProfile has its own try/catch (logs on failure); fire-and-forget.
    void loadProfile();
  }, []);

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
    if (profileErrors[name as ProfileErrorKeys] || profileErrors.form) {
      setProfileErrors((prev) => ({ ...prev, [name as ProfileErrorKeys]: undefined, form: undefined }));
    }
    setProfileSuccess('');
  };

  const validateProfile = (): boolean => {
    const errors: Partial<Record<ProfileErrorKeys, string>> = {};
    if (!profile.fullName.trim()) {
      errors.fullName = t('field_required_error', { fieldName: t('full_name_label', 'Full Name') });
    }
    // Email is readonly, no validation needed
    if (!profile.phoneNumber.trim()) {
      errors.phoneNumber = t('field_required_error', { fieldName: t('customer_phone_label', 'Phone Number') });
    }
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess('');
    setProfileErrors({});
    if (!validateProfile()) return;

    try {
      // Extract first and last name from full name
      const names = profile.fullName.trim().split(' ');
      const firstName = names[0] || '';
      const lastName = names.slice(1).join(' ') || '';

      const command: UpdateUserProfileCommand = {
        firstName,
        lastName,
        phoneNumber: profile.phoneNumber || undefined,
      };

      await updateProfile(command);
      setProfileSuccess(t('changes_saved_success', 'Your information has been updated!'));
    } catch (error: any) {
      console.error('Failed to update profile:', error);
      setProfileErrors({
        form: error.message || t('profile_update_error', 'Failed to update profile. Please try again.'),
      });
    }
  };

  const {
    currentPassword,
    newPassword,
    confirmNewPassword,
    passwordErrors,
    passwordSuccess,
    passwordStrength,
    passwordStrengthText,
    hasExistingPassword,
    handleCurrentPasswordChange,
    handleNewPasswordChange,
    handleConfirmNewPasswordChange,
    handlePasswordChangeSubmit,
  } = useAccountPassword();

  const getStrengthBarStyle = (strengthLevel: number): string => {
    if (passwordStrength === 0) return '';
    if (passwordStrength === 1 && strengthLevel <= 2) return styles.strengthWeak;
    if (passwordStrength === 2 && strengthLevel <= 4) return styles.strengthMedium;
    if (passwordStrength === 3 && strengthLevel <= 5) return styles.strengthStrong;
    if (strengthLevel <= 2 && passwordStrength >= 1) return styles.strengthWeak;
    if (strengthLevel <= 4 && passwordStrength >= 2) return styles.strengthMedium;
    return '';
  };

  return (
    <main className={styles.container}>
      <h1 className={styles.pageTitle}>{t('account_page_title', 'My Account')}</h1>

      <div className={styles.contentGrid}>
        {/* Left Column: Profile, Addresses, and Security */}
        <div className={styles.leftColumn}>
          <PersonalInfoSection
            profile={profile}
            profileErrors={profileErrors}
            profileSuccess={profileSuccess}
            handleProfileChange={handleProfileChange}
            handleProfileSave={handleProfileSave}
          />

          <PasswordManagementSection
            hasExistingPassword={hasExistingPassword}
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmNewPassword={confirmNewPassword}
            passwordErrors={passwordErrors}
            passwordSuccess={passwordSuccess}
            passwordStrength={passwordStrength}
            passwordStrengthText={passwordStrengthText}
            handleCurrentPasswordChange={handleCurrentPasswordChange}
            handleNewPasswordChange={handleNewPasswordChange}
            handleConfirmNewPasswordChange={handleConfirmNewPasswordChange}
            handlePasswordChangeSubmit={handlePasswordChangeSubmit}
            getStrengthBarStyle={getStrengthBarStyle}
          />

          <DeleteAccountSection />
        </div>

        {/* Right Column: Fidelity Points */}
        <div className={styles.rightColumn}>
          <AddressManagement />
          <FidelityPointsSection />
        </div>
      </div>
    </main>
  );
}
