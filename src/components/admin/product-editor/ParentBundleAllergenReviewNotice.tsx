import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { useParentBundleAllergenReview } from '@/hooks/admin/useParentBundleAllergenReview';
import modalStyles from '@/app/styles/RegisterStaffModal.module.css';
import styles from './EditorPreSaveReview.module.css';

interface ParentBundleAllergenReviewNoticeProps {
  readonly review: ReturnType<typeof useParentBundleAllergenReview>;
}

export default function ParentBundleAllergenReviewNotice({ review }: ParentBundleAllergenReviewNoticeProps) {
  const { t } = useTranslation();

  if (review.state.status === 'idle' && !review.needsReview) return null;
  if (review.state.status === 'idle' || review.state.status === 'loading') {
    return (
      <li className={styles.note} role="status">
        {t('editor_review_parent_bundle_checking')}
      </li>
    );
  }
  if (review.state.status === 'failed') {
    return (
      <li className={styles.warning} role="alert">
        {t('editor_review_parent_bundle_check_failed')}{' '}
        <button type="button" className={modalStyles.cancelButton} onClick={review.retry}>
          {t('editor_review_parent_bundle_retry')}
        </button>
      </li>
    );
  }
  if (review.state.status !== 'ready') return null;
  if (review.state.bundles.length === 0) return null;

  return (
    <li className={styles.warning} role="alert">
      {t('editor_review_parent_bundle_allergens')}
      <ul className={styles.parentBundles}>
        {review.state.bundles.map((bundle) => (
          <li key={bundle.id}>
            <Link
              href={`/admin/menu-management/${encodeURIComponent(bundle.id)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {bundle.name}
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}
