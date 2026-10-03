import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type {
  DeliveryChannelCategoryDraft,
  DeliveryChannelCategoryInventory,
  DeliveryChannelCategoryItemOverride,
} from '@/types/deliveryChannelMenuSelection';
import type { CategorySelectionError } from '@/hooks/admin/useDeliveryChannelCategoryDraftSave';

interface Attempt {
  readonly sourceRevision: string;
  readonly categoryIds: ReadonlySet<string>;
  readonly overrides: Readonly<Record<string, DeliveryChannelCategoryItemOverride>>;
}

interface Props {
  readonly loaded: DeliveryChannelCategoryInventory;
  readonly previous: DeliveryChannelCategoryInventory | null;
  readonly attempt: Attempt | null;
  readonly uncertainWrite: MutableRefObject<boolean>;
  readonly matchesAttempt: (draft: DeliveryChannelCategoryDraft | null, attempt: Attempt) => boolean;
  readonly markDraftSaved: (draft: DeliveryChannelCategoryDraft) => void;
  readonly synchronizeDraft: (draft: DeliveryChannelCategoryDraft | null) => void;
  readonly clearAttempt: () => void;
  readonly setWriteUncertain: Dispatch<SetStateAction<boolean>>;
  readonly setError: Dispatch<SetStateAction<CategorySelectionError | null>>;
}

export function applyCanonicalCategoryInventoryRead({
  loaded,
  previous,
  attempt,
  uncertainWrite,
  matchesAttempt,
  markDraftSaved,
  synchronizeDraft,
  clearAttempt,
  setWriteUncertain,
  setError,
}: Readonly<Props>): DeliveryChannelCategoryInventory {
  const result =
    loaded.itemStatuses === undefined &&
    previous?.sourceRevision === loaded.sourceRevision &&
    previous.itemStatuses !== undefined
      ? { ...loaded, itemStatuses: previous.itemStatuses }
      : loaded;
  if (uncertainWrite.current && attempt && matchesAttempt(result.draft, attempt)) {
    markDraftSaved(result.draft!);
    clearAttempt();
    uncertainWrite.current = false;
    setWriteUncertain(false);
    setError(null);
  } else {
    synchronizeDraft(result.draft);
  }
  return result;
}
