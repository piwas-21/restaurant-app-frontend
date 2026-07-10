// Type declarations for the `@active-template` alias (ADR-006, S15).
//
// `@active-template` resolves at BUILD time to `src/templates/<NEXT_PUBLIC_TEMPLATE>`
// via next.config.ts (webpack `resolve.alias` for `next build`, `turbopack.resolveAlias`
// for `next dev --turbopack`).
//
// These ambient declarations REPLACE the former `tsconfig.json` `paths` entry
// (which pointed `@active-template` at `classic` as a type-source). That `paths`
// entry was silently honored by Next's webpack build OVER the `resolve.alias`,
// so every non-`classic` template built as `classic` (S15 T3 fix). Removing it
// makes the build-time alias the sole resolver; these declarations keep tsc and
// editors type-checking every template against the shared contract. Templates
// stay structurally interchangeable, so a single classic-shaped contract is
// correct regardless of which template the current build selects.

declare module '@active-template' {
  export const template: import('./types').TemplateDefinition;
}

declare module '@active-template/HomePage' {
  const HomePage: import('react').ComponentType;
  export default HomePage;
}

declare module '@active-template/tokens.css';
