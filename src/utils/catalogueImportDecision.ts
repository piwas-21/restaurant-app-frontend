import type {
  CatalogueImportDecision,
  CatalogueImportSession,
  CatalogueImportSessionItem,
} from '@/services/catalogueImportService';

export function catalogueImportDecisionForRequest(decision: CatalogueImportDecision): CatalogueImportDecision {
  if (decision.resolution === 'Reuse') return reuseRequest(decision);
  const { localEntityId, ...createRequest } = decision;
  void localEntityId;
  return createRequest;
}

function reuseRequest(decision: CatalogueImportDecision): CatalogueImportDecision {
  return {
    templateId: decision.templateId,
    revision: decision.revision,
    resolution: 'Reuse',
    ...(decision.localEntityId ? { localEntityId: decision.localEntityId } : {}),
    ...(decision.rejectedCandidateIds ? { rejectedCandidateIds: decision.rejectedCandidateIds } : {}),
  };
}

export function catalogueImportDecisionFor(item: CatalogueImportSessionItem): CatalogueImportDecision {
  if (item.decision) return item.decision;
  return {
    templateId: item.templateId,
    revision: item.revision,
    resolution: item.localEntityId ? 'Reuse' : 'Create',
    ...(item.localEntityId ? { localEntityId: item.localEntityId } : {}),
  };
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
