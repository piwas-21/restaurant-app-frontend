'use client';

import CheckboxField from '@/components/design-system/CheckboxField';
import { useTranslation } from 'react-i18next';
import styles from './QuickMenuVersionModal.module.css';

interface QuickMenuVersionConfirmationsProps {
  readonly sectionsConfirmed: boolean;
  readonly priceConfirmed: boolean;
  readonly categoriesConfirmed: boolean;
  readonly scheduleConfirmed: boolean;
  readonly channelsConfirmed: boolean;
  readonly onSectionsChange: (checked: boolean) => void;
  readonly onPriceChange: (checked: boolean) => void;
  readonly onCategoriesChange: (checked: boolean) => void;
  readonly onScheduleChange: (checked: boolean) => void;
  readonly onChannelsChange: (checked: boolean) => void;
}

export default function QuickMenuVersionConfirmations({
  sectionsConfirmed,
  priceConfirmed,
  categoriesConfirmed,
  scheduleConfirmed,
  channelsConfirmed,
  onSectionsChange,
  onPriceChange,
  onCategoriesChange,
  onScheduleChange,
  onChannelsChange,
}: QuickMenuVersionConfirmationsProps) {
  const { t } = useTranslation();
  return (
    <div className={styles.confirmations}>
      <CheckboxField label={t('menu_sections')} checked={sectionsConfirmed} onChange={onSectionsChange} />
      <CheckboxField label={t('base_price')} checked={priceConfirmed} onChange={onPriceChange} />
      <CheckboxField label={t('category')} checked={categoriesConfirmed} onChange={onCategoriesChange} />
      <CheckboxField label={t('menu_availability_schedule')} checked={scheduleConfirmed} onChange={onScheduleChange} />
      <CheckboxField label={t('product_order_types')} checked={channelsConfirmed} onChange={onChannelsChange} />
    </div>
  );
}
