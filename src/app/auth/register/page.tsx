// The register page belongs to the active tenant template (ADR-006 — auth
// surface, mirrors app/page.tsx): a thin re-export so the template selected
// at build time (NEXT_PUBLIC_TEMPLATE → @active-template alias) owns the whole
// register composition + its CSS module.
export { default } from '@active-template/RegisterPage';
