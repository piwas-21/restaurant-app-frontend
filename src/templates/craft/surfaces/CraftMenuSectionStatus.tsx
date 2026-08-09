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
  retryLabel,
  browseLabel,
  onRetry,
  onBrowseFullMenu,
  filtersSlot,
}: Readonly<MenuSectionStatusProps>) {
  return (
    <div className={styles.section}>
      {/* sr-only: the masking-tape category nav already shows + highlights the
          active category, so the visible Amatic sub-title is redundant; kept for
          the section's accessible name (aria-labelledby target). */}
      <h2 id={headingId} className="sr-only">
        {title}
      </h2>

      {/* Forwarded, not ignored. This is the menu's filter row, and it has to sit ABOVE the state
          panels below — a row rendered after them lands under the "nothing matches" state it
          caused. Craft dropping the slot would leave its guests with no filters at all, which is
          the same omission that briefly cost craft its basket button. */}
      {filtersSlot}

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

      {/* The note keeps craft's handwritten voice; the BUTTON is the part S10 added, because the
          copy behind `errorMessage` has always ended "Please try again." with nothing to press.
          `emptyHeading` / `errorHeading` are deliberately not rendered here: the shared default
          takes the screen's two-line anatomy, and craft's states are one hand-written line by
          design (craft-stitch-prompts.md Prompt 4). Same information, different skin — which is the
          surface-slot contract. */}
      {errorMessage && (
        <div className={styles.stateBlock} role="alert">
          <p className={styles.error}>{errorMessage}</p>
          {onRetry && (
            <button type="button" className={styles.stateAction} onClick={onRetry}>
              {retryLabel}
            </button>
          )}
        </div>
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
          {onBrowseFullMenu && (
            <button type="button" className={styles.stateAction} onClick={onBrowseFullMenu}>
              {browseLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
