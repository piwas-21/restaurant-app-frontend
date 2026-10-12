import type { CustomerStepScreen } from './customerStepManifest';

/** Stable refs keep their price/required rules; only the unlabeled guest screen grouping changes. */
export function compactBundleSideScreens(screens: readonly CustomerStepScreen[]): CustomerStepScreen[] {
  const result: CustomerStepScreen[] = [];
  const targets = new Map<string, CustomerStepScreen>();
  for (const screen of screens) {
    if (screen.kind !== 'BundleComponentSide' || screen.presentationLabel?.trim()) {
      result.push(screen);
      continue;
    }
    const key = `${screen.sectionItemId}:${screen.compositionRole}`;
    const target = targets.get(key);
    if (target) target.refs.push(...screen.refs);
    else {
      const copy = { ...screen, refs: [...screen.refs] };
      targets.set(key, copy);
      result.push(copy);
    }
  }
  return result;
}
