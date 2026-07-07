// Ambient Window augmentation for the analytics dataLayer queue.
//
// Kept structurally loose (Record<string, unknown>[]) so the global
// type does not depend on a specific event-payload shape. Concrete
// typing for entries lives in src/lib/analytics.ts (DataLayerEntry).
//
// Moved out of src/lib/analytics.ts because whole-tree analyzer
// ESLint integrations (historically Qodana, retired 2026-07) could not
// parse `declare global` blocks inside a regular module; .d.ts files
// are skipped by such integrations.

interface Window {
  dataLayer?: unknown[];
}
