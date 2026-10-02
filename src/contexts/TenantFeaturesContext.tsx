'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface TenantFeaturesState {
  serverWorkspaceV2: boolean;
  tableAccountV1: boolean;
}

const DEFAULT_FEATURES: TenantFeaturesState = { serverWorkspaceV2: false, tableAccountV1: false };
const TenantFeaturesContext = createContext<TenantFeaturesState>(DEFAULT_FEATURES);

export function TenantFeaturesProvider({
  features,
  children,
}: Readonly<{ features: Partial<TenantFeaturesState>; children: ReactNode }>) {
  return (
    <TenantFeaturesContext.Provider value={{ ...DEFAULT_FEATURES, ...features }}>
      {children}
    </TenantFeaturesContext.Provider>
  );
}

export function useTenantFeatures(): TenantFeaturesState {
  return useContext(TenantFeaturesContext);
}
