// The checkout review/confirm page belongs to the active tenant template
// (ADR-006 — Prompt 6, mirrors app/page.tsx + auth): a thin re-export so the
// template selected at build time (NEXT_PUBLIC_TEMPLATE → @active-template alias)
// owns the whole review composition + its CSS. Page logic stays in the shared
// `useCheckoutReview` hook that each template's layout consumes.
export { default } from '@active-template/CheckoutReviewPage';
