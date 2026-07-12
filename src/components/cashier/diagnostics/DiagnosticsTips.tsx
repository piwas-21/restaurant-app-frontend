'use client';

import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import styles from '../CashierDiagnostics.module.css';

interface DiagnosticsTipsProps {
  audioBlockedByPolicy: boolean;
  sseConnectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
}

/**
 * Contextual troubleshooting tips. Renders only when audio is blocked by
 * autoplay policy or the SSE connection is in the error state — otherwise
 * nothing (mirrors the parent's original conditional render).
 */
export default function DiagnosticsTips({ audioBlockedByPolicy, sseConnectionState }: DiagnosticsTipsProps) {
  const { t } = useTranslation();

  if (!(audioBlockedByPolicy || sseConnectionState === 'error')) {
    return null;
  }

  return (
    <div className={styles.tipsBox}>
      <Info size={16} style={{ color: '#2196f3', flexShrink: 0 }} />
      <div>
        <h5 className={styles.tipsTitle}>{t('tips') || 'Tips'}</h5>
        <ul className={styles.tipsList}>
          {audioBlockedByPolicy && (
            <>
              <li>
                {t('click_or_interact_with_the_page_to_allow_audio') ||
                  'Click or interact with the page to allow audio.'}
              </li>
              <li>{t('check_your_browsers_autoplay_settings') || "Check your browser's autoplay settings."}</li>
            </>
          )}
          {sseConnectionState === 'error' && (
            <>
              <li>{t('check_your_internet_connection') || 'Check your internet connection.'}</li>
              <li>{t('try_a_hard_refresh') || 'Try a hard refresh (Ctrl+F5).'}.</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}
