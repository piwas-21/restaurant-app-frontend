// Craft's menu section heading + states (S15 T4 surface slot): an Amatic SC
// heading over a dotted rule, kraft skeleton "plates" while loading, a soft-brick
// handwritten note on error, and a hand-drawn empty plate + Caveat line when a
// category is empty — the "hand-kept menu board" states (craft-stitch-prompts.md
// Prompt 4). Same info + i18n strings as the shared default; only the skin
// differs. Rendered only in the craft build (resolved via surfaceOr). No hooks →
// no 'use client' needed (renders inside the client MenuContent tree either way).
import type { MenuSectionStatusProps } from '@/components/menu/MenuSectionStatus';
import styles from './CraftMenuSectionStatus.module.css';

// Stable keys for the static skeleton plates (no reordering — index-free keys).
const SKELETON_KEYS = ['sk-a', 'sk-b', 'sk-c'];

export default function CraftMenuSectionStatus({
  headingId,
  title,
  isLoading,
  errorMessage,
  isEmpty,
  loadingMessage,
  emptyMessage,
}: Readonly<MenuSectionStatusProps>) {
  return (
    <div className={styles.section}>
      <h2 id={headingId} className={styles.heading}>
        {title}
      </h2>

      {isLoading && (
        <output className={styles.loading}>
          <p className={styles.loadingText}>{loadingMessage}</p>
          <div className={styles.skeletonGrid} aria-hidden="true">
            {SKELETON_KEYS.map((key) => (
              <div key={key} className={styles.skeleton} />
            ))}
          </div>
        </output>
      )}

      {errorMessage && (
        <p className={styles.error} role="alert">
          {errorMessage}
        </p>
      )}

      {!isLoading && !errorMessage && isEmpty && (
        <div className={styles.empty}>
          <svg className={styles.emptyPlate} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
            <ellipse cx="32" cy="34" rx="26" ry="19" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <ellipse
              cx="32"
              cy="34"
              rx="16"
              ry="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeDasharray="3 4"
            />
          </svg>
          <p className={styles.emptyText}>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
