import styles from './MenuSkeletonRows.module.css';

/** The screen's three rows, each with its own bar widths. Index-free keys — nothing reorders. */
const SKELETON_ROWS = ['rowA', 'rowB', 'rowC'] as const;

/**
 * The menu grid's loading placeholder: skeleton ROWS, not a spinner.
 *
 * The governing screen (`mobile_menu_loading_empty_error_states`, frame 1) draws an 80x80 image
 * block plus three text bars inside a bordered card — so the wait shows the shape of what is coming
 * rather than only that something is happening. The bar widths differ per row (see the module);
 * three identical rows read as a repeating pattern where the screen reads as varied content.
 *
 * Purely decorative: every bar is `aria-hidden`, and the sentence a screen reader needs lives in
 * the `<output>` this renders inside. A live region announcing three empty boxes is worse than one
 * that says "Loading items".
 */
export default function MenuSkeletonRows() {
  return (
    <div className={styles.skeletonList} aria-hidden="true">
      {SKELETON_ROWS.map((row) => (
        <div key={row} className={`${styles.skeletonRow} ${styles[row]}`}>
          <div className={styles.skeletonThumb} />
          <div className={styles.skeletonLines}>
            <span className={styles.skeletonLineWide} />
            <span className={styles.skeletonLineMid} />
            <span className={styles.skeletonLineShort} />
          </div>
        </div>
      ))}
    </div>
  );
}
