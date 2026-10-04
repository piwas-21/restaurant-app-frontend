'use client';

import { createContext, useContext } from 'react';

export interface AmendmentResolutionUi {
  readonly canStart: boolean;
  readonly open: (amendmentId: string, expected?: { readonly currency: string; readonly creditMinor: number }) => void;
}

export const AmendmentResolutionUiContext = createContext<AmendmentResolutionUi | null>(null);
export function useAmendmentResolutionUi() {
  return useContext(AmendmentResolutionUiContext);
}
