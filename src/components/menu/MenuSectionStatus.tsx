import styles from './MenuContent.module.css';

// The menu section's heading + its loading / error / empty placeholders (the
// non-grid content). Extracted from MenuContent so a template can re-skin it via
// the `MenuSectionStatus` surface slot (craft ships an Amatic heading + kraft
// skeleton plates + a hand-drawn empty plate). The shared default below renders
// exactly what MenuContent rendered inline, so classic stays byte-identical.
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
}

export default function MenuSectionStatus({
  headingId,
  title,
  isLoading,
  errorMessage,
  isEmpty,
  loadingMessage,
  emptyMessage,
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
      <div className={styles.sectionHeadingRow}>
        <h2 id={headingId} className={styles.sectionHeading}>
          {title}
        </h2>
        <span className={styles.sectionHeadingRule} aria-hidden="true" />
      </div>
      {isLoading && <p>{loadingMessage}</p>}
      {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
      {!isLoading && !errorMessage && isEmpty && <p>{emptyMessage}</p>}
    </>
  );
}
