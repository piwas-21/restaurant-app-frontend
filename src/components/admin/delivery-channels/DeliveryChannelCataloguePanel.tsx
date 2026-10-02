'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { DeliveryChannelCatalogue, DeliveryChannelCatalogueCandidate } from '@/types/deliveryChannelCatalogue';
import DeliveryChannelServiceHoursReview from './DeliveryChannelServiceHoursReview';
import DeliveryChannelMappingList from './DeliveryChannelMappingList';
import workspaceStyles from './DeliveryChannelWorkspace.module.css';
import styles from './DeliveryChannelCataloguePanel.module.css';

interface Props {
  readonly catalogue: DeliveryChannelCatalogue;
  readonly candidates: readonly DeliveryChannelCatalogueCandidate[];
  readonly selected: Readonly<Record<string, string>>;
  readonly candidateCursor: string | null;
  readonly busy: string | null;
  readonly error: string | null;
  readonly errorMessage?: string | null;
  readonly stale: boolean;
  readonly dirty: boolean;
  readonly duplicateSelection: boolean;
  readonly writeUncertain: boolean;
  readonly locale: string;
  readonly onChoose: (providerItemId: string, value: string) => void;
  readonly onSearch: (query: string, cursor?: string | null) => Promise<unknown>;
  readonly onSave: () => Promise<boolean>;
  readonly onPreview: () => Promise<boolean>;
}

export default function DeliveryChannelCataloguePanel({
  catalogue,
  candidates,
  selected,
  candidateCursor,
  busy,
  error,
  errorMessage,
  stale,
  dirty,
  duplicateSelection,
  writeUncertain,
  locale,
  onChoose,
  onSearch,
  onSave,
  onPreview,
}: Readonly<Props>) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const saveDisabled = !dirty || duplicateSelection || stale || writeUncertain || busy !== null;
  const previewDisabled = dirty || stale || writeUncertain || busy !== null;

  return (
    <section className={workspaceStyles.panel} aria-labelledby="delivery-channel-menu-title">
      <div className={styles.header}>
        <div>
          <h2 id="delivery-channel-menu-title" className={styles.title}>
            {t('deliveryChannels.menu.title')}
          </h2>
          <p className={styles.description}>{t('deliveryChannels.menu.description')}</p>
        </div>
        <StatusBadge tone={stale ? 'warning' : 'info'}>
          {t(stale ? 'deliveryChannels.menu.stale' : 'deliveryChannels.menu.sourceTenant')}
        </StatusBadge>
      </div>

      <div className={styles.capabilityNote}>
        <strong>{t('deliveryChannels.menu.supportedScope')}</strong>
        <p>{t('deliveryChannels.menu.unsupportedScope')}</p>
      </div>
      <DeliveryChannelServiceHoursReview
        kind="planned"
        days={catalogue.serviceAvailability}
        status={catalogue.serviceHoursStatus}
        editable={catalogue.serviceHoursEditable}
      />
      <DeliveryChannelServiceHoursReview
        kind="provider"
        days={catalogue.currentServiceAvailability}
        status={catalogue.currentServiceHoursStatus}
      />

      <div className={styles.search}>
        <FormField label={t('deliveryChannels.menu.searchTenantMenu')}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void onSearch(query, null);
              }
            }}
          />
        </FormField>
        <button
          className={workspaceStyles.secondaryAction}
          type="button"
          onClick={() => void onSearch(query, null)}
          disabled={busy !== null}
        >
          {busy === 'search' ? t('deliveryChannels.loading') : t('deliveryChannels.menu.search')}
        </button>
      </div>

      {error && (
        <p className={styles.error} role="alert">
          {errorMessage ??
            t(`deliveryChannels.errors.${error}`, { defaultValue: t('deliveryChannels.errors.generic') })}
        </p>
      )}
      {duplicateSelection && (
        <p className={styles.error} role="alert">
          {t('deliveryChannels.menu.duplicateMapping')}
        </p>
      )}
      {writeUncertain && (
        <p className={styles.warning} role="alert">
          {t('deliveryChannels.menu.saveUncertain')}
        </p>
      )}
      {stale && (
        <p className={styles.warning} role="status">
          {t('deliveryChannels.menu.refreshBeforeEditing')}
        </p>
      )}

      <DeliveryChannelMappingList
        catalogue={catalogue}
        candidates={candidates}
        selected={selected}
        busy={busy}
        stale={stale}
        writeUncertain={writeUncertain}
        locale={locale}
        onChoose={onChoose}
      />
      {candidateCursor && (
        <button
          className={workspaceStyles.textAction}
          type="button"
          onClick={() => void onSearch(query, candidateCursor)}
          disabled={busy !== null}
        >
          {t('deliveryChannels.menu.loadMoreCandidates')}
        </button>
      )}
      <p className={styles.sourceNote}>
        {t('deliveryChannels.menu.sourceNote', {
          revision: catalogue.sourceRevision ?? t('deliveryChannels.menu.notRead'),
        })}
      </p>
      <div className={workspaceStyles.actions}>
        <button
          className={workspaceStyles.secondaryAction}
          type="button"
          onClick={() => void onSave()}
          disabled={saveDisabled}
        >
          {busy === 'save' ? t('deliveryChannels.loading') : t('deliveryChannels.menu.saveMapping')}
        </button>
        <button
          className={workspaceStyles.action}
          type="button"
          onClick={() => void onPreview()}
          disabled={previewDisabled}
        >
          {busy === 'preview' ? t('deliveryChannels.loading') : t('deliveryChannels.menu.preparePreview')}
        </button>
      </div>
    </section>
  );
}
