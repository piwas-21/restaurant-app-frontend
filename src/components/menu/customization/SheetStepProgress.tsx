'use client';

import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { stepLabel } from './stepLabel';
import type { CustomizationStep } from '@/utils/customizationSteps';
import styles from './SheetStepProgress.module.css';

interface SheetStepProgressProps {
  steps: readonly CustomizationStep[];
  index: number;
  /** The furthest step reached — everything beyond it stays unreachable, so no gate is skipped. */
  furthest: number;
  onJump: (index: number) => void;
  onBack: () => void;
}

/**
 * The flow's orientation bar (MENU-CUSTOMIZATION-FLOW-PLAN §3.2): where the guest is, how much is
 * left, and the way back.
 *
 * A segment is only reachable once it has been REACHED. Letting the bar jump forward would route
 * around the required-step gate `useSheetSteps` enforces on Continue — the same hole the collapsed
 * disclosures left open in the layout this replaces.
 *
 * The rail is a hairline, so "done" is a colour change and nothing else on screen. That is fine for
 * a progress *indicator* and not fine as the only channel, which is why each segment carries a
 * visually-hidden label naming the step, its position AND its state.
 */
export default function SheetStepProgress({
  steps,
  index,
  furthest,
  onJump,
  onBack,
}: Readonly<SheetStepProgressProps>) {
  const { t } = useTranslation();
  const current = steps[index];

  return (
    <div className={styles.bar}>
      <button type="button" className={styles.back} onClick={onBack} disabled={index === 0} aria-label={t('step_back')}>
        {/* Mirrored by the stylesheet under [dir='rtl'] rather than swapped for a second icon —
            one glyph, one rule, and no way for the two directions to drift apart. */}
        <ChevronLeft size={20} aria-hidden="true" />
      </button>

      <nav className={styles.track} aria-label={t('step_progress')}>
        <ol className={styles.segments}>
          {steps.map((step, position) => {
            const isCurrent = position === index;
            const isDone = position < index;
            const label = t('step_n_of_m', {
              current: position + 1,
              total: steps.length,
              title: stepLabel(step, t),
            });

            return (
              <li key={step.id} className={styles.segmentItem}>
                <button
                  type="button"
                  className={`${styles.segment} ${isCurrent ? styles.current : ''} ${isDone ? styles.done : ''}`}
                  onClick={() => onJump(position)}
                  disabled={position > furthest}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {/* The rail is a CHILD, not the button itself: globals.css forces
                      `min-height: 44px` on every button under 768px, which inflated a 4px hairline
                      into a 44px blob on exactly the viewport this redesign is for. The button stays
                      the (transparent) touch target; this span is the only thing painted. */}
                  <span className={styles.rail} aria-hidden="true" />
                  <span className={styles.srOnly}>{isDone ? `${label} — ${t('step_done')}` : label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <p className={styles.counter} aria-hidden="true">
        {index + 1}
        <span className={styles.counterTotal}>/{steps.length}</span>
      </p>

      {/* The step change announced once, politely — the panel swap is silent to a screen reader on
          its own, and the visible counter above is hidden from it so the same fact is not read
          twice in two different shapes. */}
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {current ? t('step_n_of_m', { current: index + 1, total: steps.length, title: stepLabel(current, t) }) : ''}
      </p>
    </div>
  );
}
