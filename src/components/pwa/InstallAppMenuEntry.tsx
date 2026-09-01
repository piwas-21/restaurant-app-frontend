'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import PwaIosInstallModal from './PwaIosInstallModal';

interface InstallAppMenuEntryProps {
  /** Called when the entry is activated (the chromes close their mobile menu). */
  onActivate?: () => void;
}

/**
 * The PWA install offer as a FIXED NAV ITEM — the owner's redesign of the retired banner
 * (see usePwaInstall for why the popup approach was unstable).
 *
 * Visibility is honest per platform: a native prompt on Chromium (the event is captured at
 * module scope, so there is no hydration race), Apple's own share/menu flow on iOS (Apple
 * exposes no install API — the modal walks the two taps), and NOTHING where we cannot truly
 * offer an install. Hidden entirely once the app is installed.
 */
export default function InstallAppMenuEntry({ onActivate }: Readonly<InstallAppMenuEntryProps>) {
  const { t } = useTranslation();
  const { platform, canPrompt, promptInstall, standalone } = usePwaInstall();
  const [isIosSheetOpen, setIosSheetOpen] = useState(false);

  if (standalone || platform === 'unsupported') return null;

  const activate = async () => {
    if (platform === 'chromium' && canPrompt) {
      // The native Chromium dialog. An accepted install flips the standalone check and this
      // entry disappears; a dismissal costs nothing — the entry is simply here again.
      await promptInstall();
      onActivate?.();
      return;
    }
    onActivate?.();
    setIosSheetOpen(true);
  };

  return (
    <>
      <button type="button" className="nav-link" onClick={() => void activate()}>
        <Smartphone size={18} />
        <span>{t('nav_install_app', 'Install app')}</span>
      </button>
      <PwaIosInstallModal isOpen={isIosSheetOpen} onClose={() => setIosSheetOpen(false)} />
    </>
  );
}
