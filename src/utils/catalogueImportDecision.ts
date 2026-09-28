import type {
  CatalogueImportDecision,
  CatalogueImportDecisionWire,
  CatalogueImportSession,
  CatalogueImportSessionItem,
} from '@/services/catalogueImportService';
import { exactMaskFromOrderTypes, orderTypesFromMask } from '@/utils/orderChannels';

function explicitReviewedLists(
  itemType: CatalogueImportSessionItem['type'],
  decision: CatalogueImportDecision,
): CatalogueImportDecision {
  if (decision.resolution !== 'Create') return decision;
  return {
    ...decision,
    ...(itemType === 'item' && decision.ingredientsReviewed === true && decision.ingredients == null
      ? { ingredients: [] }
      : {}),
    ...((itemType === 'item' || itemType === 'bundle') &&
    decision.allergensReviewed === true &&
    decision.allergens == null
      ? { allergens: [] }
      : {}),
  };
}

export function catalogueImportDecisionForRequest(
  decision: CatalogueImportDecision,
  itemType: CatalogueImportSessionItem['type'],
): CatalogueImportDecisionWire {
  if (decision.resolution === 'Reuse') return reuseRequest(decision);
  const { availableOrderTypes, ...createRequest } = explicitReviewedLists(itemType, decision);
  const request = { ...createRequest };
  delete request.localEntityId;
  return {
    ...request,
    ...(availableOrderTypes === undefined
      ? {}
      : { availableOrderTypes: availableOrderTypes === null ? null : exactMaskFromOrderTypes(availableOrderTypes) }),
  };
}

function reuseRequest(decision: CatalogueImportDecision): CatalogueImportDecisionWire {
  return {
    templateId: decision.templateId,
    revision: decision.revision,
    resolution: 'Reuse',
    ...(decision.localEntityId ? { localEntityId: decision.localEntityId } : {}),
    ...(decision.rejectedCandidateIds ? { rejectedCandidateIds: decision.rejectedCandidateIds } : {}),
  };
}

export function catalogueImportDecisionFor(item: CatalogueImportSessionItem): CatalogueImportDecision {
  if (item.decision) {
    const { availableOrderTypes, ...savedDecision } = item.decision;
    const decision = explicitReviewedLists(item.type, savedDecision);
    return {
      ...decision,
      ...(availableOrderTypes === undefined
        ? {}
        : {
            availableOrderTypes: availableOrderTypes === null ? null : orderTypesFromMask(availableOrderTypes),
          }),
    };
  }
  return {
    templateId: item.templateId,
    revision: item.revision,
    resolution: item.localEntityId ? 'Reuse' : 'Create',
    ...(!item.localEntityId && (item.type === 'item' || item.type === 'bundle')
      ? { localName: item.displayName, localDescription: item.description ?? '' }
      : {}),
    ...(item.localEntityId ? { localEntityId: item.localEntityId } : {}),
  };
}

export function hasEmptyCustomOrderTypes(decision: CatalogueImportDecision): boolean {
  return (
    decision.resolution === 'Create' &&
    Array.isArray(decision.availableOrderTypes) &&
    decision.availableOrderTypes.length === 0
  );
}

export function hasEmptyCustomOrderTypesInSelection(
  items: readonly CatalogueImportSessionItem[],
  decisions: Readonly<Record<string, CatalogueImportDecision>>,
): boolean {
  return items.some((item) => {
    const key = `${item.templateId}@${item.revision}`;
    return hasEmptyCustomOrderTypes(decisions[key] ?? catalogueImportDecisionFor(item));
  });
}

export function canEditCatalogueImportDecision(
  session: CatalogueImportSession,
  item: CatalogueImportSessionItem,
): boolean {
  if (session.status === 'Draft') return true;
  return (
    (session.status === 'PartiallyImported' || session.status === 'Failed') &&
    item.isSelected &&
    item.status === 'Failed'
  );
}

export function canManageCatalogueImportSession(session: CatalogueImportSession): boolean {
  return (
    session.status === 'Draft' ||
    ((session.status === 'PartiallyImported' || session.status === 'Failed') &&
      session.items.some((item) => item.isSelected && item.status === 'Failed'))
  );
}
