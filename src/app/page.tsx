// The home page belongs to the active tenant template (ADR-006, S15 T2):
// this route is a thin re-export so the template selected at build time
// (NEXT_PUBLIC_TEMPLATE → @active-template alias in next.config.ts) owns
// the whole landing composition + its CSS module.
export { default } from '@active-template/HomePage';
