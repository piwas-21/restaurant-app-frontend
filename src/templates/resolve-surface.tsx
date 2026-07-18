// Resolve a per-surface component (S15 T4): the active template's override if it
// ships one, else the shared default. `@active-template/surfaces` resolves at build
// time to the active template's `surfaces.ts`, so a template without the slot never
// bundles the override — classic stays byte-identical.

import { surfaces } from '@active-template/surfaces';
import type { TemplateSurfaces } from './types';

export function surfaceOr<K extends keyof TemplateSurfaces>(
  key: K,
  fallback: NonNullable<TemplateSurfaces[K]>,
): NonNullable<TemplateSurfaces[K]> {
  return (surfaces[key] ?? fallback) as NonNullable<TemplateSurfaces[K]>;
}
