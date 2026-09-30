'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { reportBrowserStorageFailure } from '@/lib/browserStorageDiagnostics';

const COOKIE_CONSENT_KEY = 'rumi_cookie_consent';

function readConsentPreference(): string | null {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch (storageError) {
    reportBrowserStorageFailure('read consent preference', storageError);
    return null;
  }
}

function writeConsentPreference(value: string): void {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch (storageError) {
    reportBrowserStorageFailure('write consent preference', storageError);
  }
}

function clearLegacyLocalePreference(): void {
  try {
    localStorage.removeItem('i18nextLng');
  } catch (storageError) {
    reportBrowserStorageFailure('clear legacy locale cache', storageError);
  }
}

interface ConsentState {
  preferences: boolean | null; // null = not set, true = accepted, false = declined
  // Add other categories here later e.g., analytics: boolean | null;
}

interface CookieConsentContextType {
  consent: ConsentState;
  isConsentPending: boolean;
  isSettingsModalOpen: boolean;
  acceptPreferences: () => void;
  declinePreferences: () => void;
  updateConsent: (newConsent: Partial<ConsentState>) => void; // Expose for modal
  openSettingsModal: () => void;
  closeSettingsModal: () => void;
}

const CookieConsentContext = createContext<CookieConsentContextType | undefined>(undefined);

export const CookieConsentProvider = ({ children }: { children: ReactNode }) => {
  const [consent, setConsent] = useState<ConsentState>({ preferences: null });
  const [isConsentPending, setIsConsentPending] = useState(true);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  useEffect(() => {
    const storedConsent = readConsentPreference();
    if (storedConsent) {
      try {
        const parsedConsent = JSON.parse(storedConsent) as ConsentState;
        setConsent(parsedConsent);
      } catch (error) {
        console.error('Error parsing stored cookie consent:', error);
        try {
          localStorage.removeItem(COOKIE_CONSENT_KEY);
        } catch (storageError) {
          reportBrowserStorageFailure('remove consent preference', storageError);
        }
      }
    }
    setIsConsentPending(false);
  }, []);

  const updateConsentStateAndStorage = (newConsentSettings: Partial<ConsentState>) => {
    setConsent((prevConsent) => {
      const updatedConsent = { ...prevConsent, ...newConsentSettings };
      writeConsentPreference(JSON.stringify(updatedConsent));
      // Remove detector-cache values left by older releases. The versioned locale cookie is an
      // essential routing choice and is independent of optional preferences.
      if (updatedConsent.preferences === false) {
        clearLegacyLocalePreference();
      }
      return updatedConsent;
    });
    setIsConsentPending(false);
  };

  const acceptPreferences = () => {
    updateConsentStateAndStorage({ preferences: true });
  };

  const declinePreferences = () => {
    updateConsentStateAndStorage({ preferences: false });
  };

  const openSettingsModal = () => setIsSettingsModalOpen(true);
  const closeSettingsModal = () => setIsSettingsModalOpen(false);

  return (
    <CookieConsentContext.Provider
      value={{
        consent,
        isConsentPending,
        isSettingsModalOpen,
        acceptPreferences,
        declinePreferences,
        updateConsent: updateConsentStateAndStorage,
        openSettingsModal,
        closeSettingsModal,
      }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
};

export const useCookieConsent = () => {
  const context = useContext(CookieConsentContext);
  if (context === undefined) {
    throw new Error('useCookieConsent must be used within a CookieConsentProvider');
  }
  return context;
};
