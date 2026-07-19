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
      {/* sr-only: the category nav already shows + highlights the active category,
          so the visible sub-title is redundant; kept for the section's accessible
          name (aria-labelledby target) and as a screen-reader landmark. */}
      <h2 id={headingId} className="sr-only">
        {title}
      </h2>
      {isLoading && <p>{loadingMessage}</p>}
      {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}
      {!isLoading && !errorMessage && isEmpty && <p>{emptyMessage}</p>}
    </>
  );
}
