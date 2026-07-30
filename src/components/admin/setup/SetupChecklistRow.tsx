'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { setupStepHref } from '@/lib/setupSteps';
import type { SetupStepDto } from '@/types/setupChecklist';
import styles from './SetupChecklist.module.css';

/** `tables-qr` → `tables_qr`, so a step key maps onto an i18n key. */
const i18nStem = (key: string) => key.replaceAll('-', '_');

/**
 * One row of the first-run checklist (SOFRA-ONBOARDING-PLAN O4).
 *
 * A DERIVED step gets no control — it is done when the data says so, and the API
 * refuses to acknowledge it. A disabled checkbox would still read as "something I
 * could tick", which is the wrong idea to plant: the owner's job on those rows is to
 * go and do the thing.
 */
export default function SetupChecklistRow({
  step,
  isSaving,
  onToggle,
}: Readonly<{
  step: SetupStepDto;
  isSaving: boolean;
  onToggle: (isDone: boolean) => void;
}>) {
  const { t } = useTranslation();
  const href = setupStepHref(step.key);
  const stem = i18nStem(step.key);
  const title = t(`setup_step_${stem}_title`, step.key);
  const StateIcon = step.isDone ? CheckCircle2 : Circle;

  return (
    <li className={`${styles.row} ${step.isDone ? styles.rowDone : ''}`}>
      {step.isDerived ? (
        // A derived row carries its state ONLY in this icon, and an aria-hidden icon
        // plus line-through styling says nothing to a screen reader — which would have
        // left the two steps whose completion is genuinely earned as the two whose
        // completion is never announced. `role="img"` + a label states it out loud.
        <StateIcon
          className={styles.stateIcon}
          role="img"
          aria-label={step.isDone ? t('setup_step_state_done') : t('setup_step_state_todo')}
        />
      ) : (
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={step.isDone}
          disabled={isSaving}
          onChange={(e) => onToggle(e.target.checked)}
          aria-label={title}
        />
      )}

      <div className={styles.rowText}>
        <span className={styles.rowTitle}>{title}</span>
        <span className={styles.rowHint}>
          {/* Empty default, not the key: the route layer already degrades a step this
            build has never heard of to guidance-without-a-link, and printing the raw
            `setup_step_..._hint` string as that guidance would undo it. */}
          {t(`setup_step_${stem}_hint`, { defaultValue: '' })}
        </span>
      </div>

      {href && (
        <Link href={href} className={styles.rowAction}>
          {step.isDone ? t('setup_checklist_review') : t('setup_checklist_open')}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}
