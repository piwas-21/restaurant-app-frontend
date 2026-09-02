'use client';

import { useTranslation } from 'react-i18next';
import SpecialRequestSection from './SpecialRequestSection';
import { stepLabel } from './stepLabel';
import type { CustomizationStep } from '@/utils/customizationSteps';
import styles from './SheetReviewStep.module.css';

export interface ReviewRow {
  step: CustomizationStep;
  /** What the guest chose. **Empty means they chose nothing** and is rendered as an explicit None. */
  values: string[];
}

interface SheetReviewStepProps {
  rows: readonly ReviewRow[];
  onJump: (step: CustomizationStep) => void;
  specialInstructions: string;
  onInstructionsChange: (instructions: string) => void;
}

/**
 * The last step (MENU-CUSTOMIZATION-FLOW-PLAN §3.3), and the part of this redesign that actually
 * answers "make sure guests are not missing any section".
 *
 * A step walked past is not omitted from this list — it is listed with **None**, next to a Change
 * link that goes straight back to it. The old layout could not do this: a collapsed disclosure the
 * guest never opened left no trace anywhere, so a missed sauce choice reached the kitchen as a
 * deliberate-looking absence.
 */
export default function SheetReviewStep({
  rows,
  onJump,
  specialInstructions,
  onInstructionsChange,
}: Readonly<SheetReviewStepProps>) {
  const { t } = useTranslation();

  return (
    <>
      <dl className={styles.list}>
        {rows.map(({ step, values }) => {
          const label = stepLabel(step, t);
          return (
            <div key={step.id} className={styles.row}>
              <dt className={styles.term}>{label}</dt>
              <dd className={styles.value}>
                {values.length > 0 ? (
                  <ul className={styles.values}>
                    {values.map((value, position) => (
                      // Keyed by POSITION: two same-named options in different partitions are a
                      // real payload, and the value alone would collide. The list is derived fresh
                      // from state on every render and never reordered in place, so the index is
                      // stable for as long as the row exists.
                      <li key={`${step.id}-${position}`} dir="auto">
                        {value}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className={styles.empty}>{t('step_nothing_selected')}</span>
                )}
                <button type="button" className={styles.change} onClick={() => onJump(step)}>
                  {/* Names the step it returns to, so a screen-reader guest reading the buttons out
                      of context does not hear "Change" five times with nothing to tell them apart. */}
                  <span aria-hidden="true">{t('step_change')}</span>
                  <span className={styles.srOnly}>{t('step_change_named', { title: label })}</span>
                </button>
              </dd>
            </div>
          );
        })}
      </dl>

      <SpecialRequestSection specialInstructions={specialInstructions} onInstructionsChange={onInstructionsChange} />
    </>
  );
}
