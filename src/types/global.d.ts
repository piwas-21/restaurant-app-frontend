// Ambient Window augmentation for the analytics dataLayer queue.
//
// Kept structurally loose (Record<string, unknown>[]) so the global
// type does not depend on a specific event-payload shape. Concrete
// typing for entries lives in src/lib/analytics.ts (DataLayerEntry).
//
// Moved out of src/lib/analytics.ts because Qodana's ESLint
// integration cannot parse `declare global` blocks inside a regular
// module and reports "ESLint: Install the 'eslint' package" on the
// whole file. .d.ts files are skipped by that integration.

interface Window {
  dataLayer?: unknown[];
}
