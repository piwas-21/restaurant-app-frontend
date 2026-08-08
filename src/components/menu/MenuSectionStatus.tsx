import { RefreshCw, UtensilsCrossed, WifiOff } from 'lucide-react';
import MenuSkeletonRows from './MenuSkeletonRows';
import headingStyles from './MenuContent.module.css';
import styles from './MenuSectionStatus.module.css';

// The menu section's heading + its loading / error / empty placeholders (the
// non-grid content). Extracted from MenuContent so a template can re-skin it via
// the `MenuSectionStatus` surface slot (craft ships an Amatic heading + kraft
// skeleton plates + a hand-drawn empty plate).
//
// Until S10 the shared default rendered all three states as a bare <p>. The governing screen is
// `docs/stitch-screens/mobile_menu_loading_empty_error_states/code.html` (classic; three frames),
// with `mobile_states_rtl_mirror` and `mobile_special_states_dark` as the RTL and dark companions.
export interface MenuSectionStatusProps {
  /** id for the heading (the section's aria-labelledby target). */
  headingId: string;
  /** Localized category / view name. */
  title: string;
  isLoading: boolean;
  /** Localized error message, or null when there's no error. */
  errorMessage: string | null;
  /** True when the (non-loading, non-error) result set is empty. */
  isEmpty: boolean;
  loadingMessage: string;
  emptyMessage: string;
  /** Generic heading above `emptyMessage` — the screen's two-line anatomy. */
  emptyHeading: string;
  /** Generic heading above `errorMessage`. */
  errorHeading: string;
  /** Label for the error state's retry button. */
  retryLabel: string;
  /** Label for the empty state's escape hatch. */
  browseLabel: string;
  /**
   * Reload the active view. Optional so a host that has nothing to retry with renders no button
   * rather than a dead one — the rule the blocked card and the locked price editor already follow.
   */
  onRetry?: () => void;
  /**
   * Leave an empty category for the full menu (D5: "the only escape from an empty Combos tab,
   * which on RUMI prod is every Combos tab"). Absent when the empty view IS the full menu, in
   * which case the button would reload the page into the state the guest is already looking at.
   */
  onBrowseFullMenu?: () => void;
}

export default function MenuSectionStatus({
  headingId,
  title,
  isLoading,
  errorMessage,
  isEmpty,
  loadingMessage,
  emptyMessage,
  emptyHeading,
  errorHeading,
  retryLabel,
  browseLabel,
  onRetry,
  onBrowseFullMenu,
}: Readonly<MenuSectionStatusProps>) {
  return (
    <>
      {/* VISIBLE again. It was `sr-only` on the reasoning that the category nav already highlights
          the active category — true, but every generated screen carries this heading as a
          Playfair rule-underlined band above the grid
          (`desktop_menu_light_full_page`: `<h2 class="font-section-heading …">Mains</h2>` inside a
          `border-b … pb-2` row). It is the anchor that makes a scrolling page read as a menu with
          sections rather than one undifferentiated grid, and the redundancy with the nav is the
          same redundancy a printed menu has. The trailing hairline is decorative, so it is
          aria-hidden. */}
      <div className={headingStyles.sectionHeadingRow}>
        <h2 id={headingId} className={headingStyles.sectionHeading}>
          {title}
        </h2>
        <span className={headingStyles.sectionHeadingRule} aria-hidden="true" />
      </div>

      {/* Skeleton rows rather than a spinner (see MenuSkeletonRows). `<output>` with the sentence
          inside it and the bars aria-hidden: the bars carry nothing a screen reader can use, and a
          live region announcing three empty boxes is worse than one that says "Loading items".
          Same split craft's override already makes. */}
      {isLoading && (
        <output className={styles.loading}>
          <span className="sr-only">{loadingMessage}</span>
          <MenuSkeletonRows />
        </output>
      )}

      {/* Error and empty share one anatomy — 128px circle glyph, serif heading, body copy, one
          button — because the screen draws them that way and because they are the same moment for
          a guest: the grid they expected is not there, and here is the one thing to do about it.
          They differ in tint (error-container vs surface) and in button weight (solid vs outlined),
          which is the whole of the hierarchy between "we broke" and "there is nothing here". */}
      {errorMessage && (
        <div className={styles.state} role="alert">
          <div className={`${styles.glyph} ${styles.glyphError}`} aria-hidden="true">
            <WifiOff size={48} />
          </div>
          <h3 className={styles.stateHeading}>{errorHeading}</h3>
          <p className={styles.stateBody}>{errorMessage}</p>
          {onRetry && (
            <button type="button" className={styles.solidAction} onClick={onRetry}>
              <RefreshCw size={16} aria-hidden="true" />
              {retryLabel}
            </button>
          )}
        </div>
      )}

      {/* D5 takes the screen's CONTENTS inside a dashed panel rather than its full-height centred
          flex: a `flex-1 … justify-center pt-32` illustration does not sit under a sticky nav. */}
      {!isLoading && !errorMessage && isEmpty && (
        <div className={`${styles.state} ${styles.statePanel}`}>
          <div className={styles.glyph} aria-hidden="true">
            <UtensilsCrossed size={48} />
          </div>
          <h3 className={styles.stateHeading}>{emptyHeading}</h3>
          <p className={styles.stateBody}>{emptyMessage}</p>
          {onBrowseFullMenu && (
            <button type="button" className={styles.outlinedAction} onClick={onBrowseFullMenu}>
              {browseLabel}
            </button>
          )}
        </div>
      )}
    </>
  );
}
