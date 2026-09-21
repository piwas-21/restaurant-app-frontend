'use client';

import { createContext, useContext, type ReactNode } from 'react';

export interface TenantFeaturesState {
  serverWorkspaceV2: boolean;
}

const TenantFeaturesContext = createContext<TenantFeaturesState>({ serverWorkspaceV2: false });

export function TenantFeaturesProvider({
  features,
  children,
}: Readonly<{ features: TenantFeaturesState; children: ReactNode }>) {
  return <TenantFeaturesContext.Provider value={features}>{children}</TenantFeaturesContext.Provider>;
}

export function useTenantFeatures(): TenantFeaturesState {
  return useContext(TenantFeaturesContext);
}
