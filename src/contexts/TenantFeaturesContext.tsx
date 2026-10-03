'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';

export interface TenantFeaturesState {
  serverWorkspaceV2: boolean;
  tableAccountV1: boolean;
  orderAmendmentsV1: boolean;
  tableGuestVisitsV1: boolean;
  tableAccountPaymentsV1: boolean;
}

const DEFAULT_FEATURES: TenantFeaturesState = {
  serverWorkspaceV2: false,
  tableAccountV1: false,
  orderAmendmentsV1: false,
  tableGuestVisitsV1: false,
  tableAccountPaymentsV1: false,
};
const TenantFeaturesContext = createContext<TenantFeaturesState>(DEFAULT_FEATURES);

export function TenantFeaturesProvider({
  features,
  children,
}: Readonly<{ features: Partial<TenantFeaturesState>; children: ReactNode }>) {
  const value = useMemo(() => ({ ...DEFAULT_FEATURES, ...features }), [features]);

  return <TenantFeaturesContext.Provider value={value}>{children}</TenantFeaturesContext.Provider>;
}

export function useTenantFeatures(): TenantFeaturesState {
  return useContext(TenantFeaturesContext);
}
