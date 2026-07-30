'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { moduleForPath } from '@/lib/modules';
import { useModules } from '@/contexts/ModulesContext';
import { isSetupStepReachable } from '@/lib/setupSteps';
import { useSetupChecklist } from '@/hooks/admin/useSetupChecklist';
import SetupChecklistRow from './SetupChecklistRow';
import styles from './SetupChecklist.module.css';

/**
 * The guided first-run checklist a new owner works through
 * (SOFRA-ONBOARDING-PLAN O4). Definition of done: they take their first real order
 * without the founder on a call.
 *
 * Two things it must never do, both of which the API also enforces:
 *
 *  - claim a DERIVED step is done. `menu` and `staff` are observed from real data, so
 *    they get no checkbox at all — only the link that lets the owner go do the thing.
 *  - offer a step whose route this instance does not run. The backend already filters
 *    by module, and this filters again against the SAME route map `ModuleRouteGuard`
 *    and the sidebar use, because a checklist row IS a link to a route: offering one
 *    the guard would block is the same defect as leaving a nav entry behind a hidden
 *    page, met on the first thing the product ever asked them to do.
 */
export default function SetupChecklist() {
  const { t } = useTranslation();
  const modules = useModules();
  const { checklist, isLoading, isSaving, saveFailed, pending, setStepDone, setDismissed } = useSetupChecklist();

  // A checklist that could not be read renders as NOTHING, never as an empty list —
  // an empty list reads as "you are all done", the one wrong answer on this surface.
  if (isLoading || !checklist) return null;

  const steps = checklist.steps
    .filter((s) => isSetupStepReachable(s, moduleForPath, (moduleId) => moduleId === null || modules.has(moduleId)))
    // Show the in-flight value for the row being written. The server answer overwrites
    // it a moment later; without this the controlled checkbox re-renders back to the old
    // value on click and visibly un-ticks for the whole round-trip.
    .map((s) => (pending && pending.key === s.key ? { ...s, isDone: pending.isDone } : s));
  if (steps.length === 0) return null;

  const doneCount = steps.filter((s) => s.isDone).length;
  const allDone = doneCount === steps.length;

  if (checklist.isDismissed) {
    return (
      <section className={styles.dismissed}>
        <p className={styles.dismissedText}>
          {t('setup_checklist_hidden')}{' '}
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => void setDismissed(false)}
            disabled={isSaving}
          >
            {t('setup_checklist_show')}
          </button>
        </p>
      </section>
    );
  }

  const heading = allDone ? t('setup_checklist_done_title') : t('setup_checklist_title');

  return (
    <section className={styles.panel} aria-labelledby="setup-checklist-heading">
      <header className={styles.header}>
        <div>
          <h2 id="setup-checklist-heading" className={styles.title}>
            {heading}
          </h2>
          <p className={styles.subtitle}>
            {allDone
              ? t('setup_checklist_done_subtitle')
              : t('setup_checklist_progress', { done: doneCount, total: steps.length })}
          </p>
        </div>
        <button type="button" className={styles.linkButton} onClick={() => void setDismissed(true)} disabled={isSaving}>
          {t('setup_checklist_hide')}
        </button>
      </header>

      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-label={heading}
      >
        <div className={styles.progressFill} style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>

      <ol className={styles.list}>
        {steps.map((step) => (
          <SetupChecklistRow
            key={step.key}
            step={step}
            isSaving={isSaving}
            onToggle={(isDone) => void setStepDone(step.key, isDone)}
          />
        ))}
      </ol>

      {saveFailed && (
        <p className={styles.error} role="alert">
          {t('setup_checklist_save_failed')}
        </p>
      )}
    </section>
  );
}
