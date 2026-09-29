'use client';

import React from 'react';
import type { CatalogueImportDecision } from '@/services/catalogueImportService';
import type { CatalogueTemplateType } from '@/services/catalogueTemplateService';
import CatalogueImportRecipeReview from './CatalogueImportRecipeReview';
import CatalogueImportServiceReview from './CatalogueImportServiceReview';

interface Props {
  readonly itemType: CatalogueTemplateType;
  readonly decision: CatalogueImportDecision;
  readonly disabled: boolean;
  readonly onDecisionChange: (patch: Partial<CatalogueImportDecision>) => void;
}

export default function CatalogueImportOperationalReview(props: Props) {
  if ((props.itemType !== 'item' && props.itemType !== 'bundle') || props.decision.resolution === 'Reuse') return null;

  return (
    <>
      <CatalogueImportRecipeReview {...props} />
      <CatalogueImportServiceReview {...props} />
    </>
  );
}
