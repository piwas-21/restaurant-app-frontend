'use client';

import { useTranslation } from 'react-i18next';
import type { DeliveryChannelStepId } from '@/types/deliveryChannelManagement';
import styles from './DeliveryChannelWorkspace.module.css';

interface DeliveryChannelStepNavigationProps {
  readonly activeStep: DeliveryChannelStepId;
  readonly canReviewMenu: boolean;
  readonly canPublish: boolean;
  readonly onChange: (step: DeliveryChannelStepId) => void;
}

const STEPS: readonly DeliveryChannelStepId[] = ['connect', 'menu', 'publish'];

export default function DeliveryChannelStepNavigation({
  activeStep,
  canReviewMenu,
  canPublish,
  onChange,
}: Readonly<DeliveryChannelStepNavigationProps>) {
  const { t } = useTranslation();
  const available: Record<DeliveryChannelStepId, boolean> = {
    connect: true,
    menu: canReviewMenu,
    publish: canPublish,
  };

  return (
    <nav aria-label={t('deliveryChannels.steps.navigation')}>
      <ol className={styles.stepNav}>
        {STEPS.map((step, index) => (
          <li key={step}>
            <button
              type="button"
              className={styles.stepButton}
              aria-current={activeStep === step ? 'step' : undefined}
              disabled={!available[step]}
              onClick={() => onChange(step)}
            >
              <span className={styles.stepNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.stepLabel}>{t(`deliveryChannels.steps.${step}`)}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
