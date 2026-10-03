import Link from '@/components/TenantLink';
import { useTranslation } from 'react-i18next';
import { useTenantFeatures } from '@/contexts/TenantFeaturesContext';
import styles from '@/app/styles/ServerPage.module.css';

export default function ServerLegacyWorkspaceActions() {
  const { t } = useTranslation();
  const { orderAmendmentsV1 } = useTenantFeatures();
  return (
    <div className={styles.pageActions}>
      {orderAmendmentsV1 && (
        <Link className={styles.takeawayLink} href="/server/orders">
          {t('serverOrders.title', 'Orders')}
        </Link>
      )}
      <Link className={styles.takeawayLink} href="/server/marketplace">
        {t('marketplaceStaff.kitchen_title')}
      </Link>
      <Link className={styles.takeawayLink} href="/server/takeaway">
        {t('server.takeaway.link')}
      </Link>
    </div>
  );
}
