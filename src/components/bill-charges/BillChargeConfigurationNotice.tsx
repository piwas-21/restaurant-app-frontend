'use client';
import { useTranslation } from 'react-i18next';
import StaffButton from '@/components/design-system/StaffButton';
import type { useBillChargeConfiguration } from '@/hooks/useBillChargeConfiguration';

export default function BillChargeConfigurationNotice({
  reader,
}: Readonly<{
  reader: ReturnType<typeof useBillChargeConfiguration>;
}>) {
  const { t } = useTranslation();
  if (reader.failed)
    return (
      <output>
        <p>{reader.message ?? t('billCharges.loadFailed')}</p>
        <StaffButton
          disabled={reader.loading}
          onClick={() => void reader.refresh()}
          aria-label={`${t('retry')}: ${t('billCharges.title')}`}
        >
          {t('retry')}
        </StaffButton>
      </output>
    );
  if (!reader.configuration)
    return (
      <output>
        {t('billCharges.title')}: {t('loading')}
      </output>
    );
  return null;
}
