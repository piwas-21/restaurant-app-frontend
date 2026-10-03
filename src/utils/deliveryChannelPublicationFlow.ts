import type {
  DeliveryChannelCatalogue,
  DeliveryChannelPreview,
  DeliveryChannelPublication,
} from '@/types/deliveryChannelCatalogue';

interface PublishGuard {
  readonly catalogue: DeliveryChannelCatalogue | null;
  readonly preview: DeliveryChannelPreview | null;
  readonly confirmedTaxProfile: boolean;
  readonly dirty: boolean;
  readonly stale: boolean;
  readonly unresolvedPublication: boolean;
  readonly draftWriteUncertain: boolean;
  readonly writeUncertain: boolean;
}

export function publicationRequiresTaxProfile(preview: DeliveryChannelPreview | null): boolean {
  return preview?.selectionMode === 'categoryItemsV1';
}

export function publicationHasCurrentTaxProfile(preview: DeliveryChannelPreview | null): boolean {
  const revision = preview?.taxProfileRevision;
  return Boolean(revision && preview?.taxProfile?.profileRevision === revision);
}

export function publishIsBlocked({
  catalogue,
  preview,
  confirmedTaxProfile,
  dirty,
  stale,
  unresolvedPublication,
  draftWriteUncertain,
  writeUncertain,
}: PublishGuard): boolean {
  return Boolean(
    !catalogue ||
    !preview?.canPublish ||
    (publicationRequiresTaxProfile(preview) && (!confirmedTaxProfile || !publicationHasCurrentTaxProfile(preview))) ||
    dirty ||
    stale ||
    unresolvedPublication ||
    draftWriteUncertain ||
    writeUncertain,
  );
}

export async function pollPendingPublication(
  refreshPublication: () => Promise<DeliveryChannelPublication | null>,
): Promise<{ finished: boolean; publication: DeliveryChannelPublication | null }> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    const publication = await refreshPublication();
    if (publication?.state !== 'pending') return { finished: true, publication };
  }
  return { finished: false, publication: null };
}
