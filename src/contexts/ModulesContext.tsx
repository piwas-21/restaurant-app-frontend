'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import { MODULE_IDS, type ModuleId } from '@/lib/modules';

/**
 * ModulesContext — which product modules this tenant instance runs (sofra ADR-010 / S11,
 * SOFRA-ONBOARDING-PLAN O5).
 *
 * The value is fetched SERVER-side in the root layout and passed in, not fetched here:
 * a client fetch would let a gated route paint before the answer arrived, and the whole
 * point is that a surface the tenant did not buy is never offered.
 *
 * The default is EVERY module. That matters — the live RUMI install has no module list
 * at all and its backend reports the full set, so "no information" must mean "everything",
 * never "nothing". A component rendered outside the provider (a test, a stray subtree)
 * therefore behaves exactly as it did before gating existed.
 */
const ModulesContext = createContext<ReadonlySet<ModuleId>>(new Set(MODULE_IDS));

export function ModulesProvider({ modules, children }: Readonly<{ modules: ModuleId[]; children: ReactNode }>) {
  const value = useMemo(() => new Set(modules), [modules]);
  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

/** The enabled module set. Prefer {@link useModuleEnabled} for a single check. */
export function useModules(): ReadonlySet<ModuleId> {
  return useContext(ModulesContext);
}

/**
 * Whether a module is available here. `null` means "no module owns this", which is
 * always true — it keeps callers from having to special-case an ungated surface.
 */
export function useModuleEnabled(moduleId: ModuleId | null): boolean {
  const modules = useModules();
  return moduleId === null || modules.has(moduleId);
}
