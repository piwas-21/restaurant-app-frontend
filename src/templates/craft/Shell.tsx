// craft template Shell (ADR-006, S15 T3 slice 1).
//
// Slice 1 scope is tokens + fonts + a new home page ONLY (see
// SOFRA-TENANT-TEMPLATES-PLAN §3.3/T3 row) — the distinct craft customer
// chrome (sticky header, hand-lettered wordmark, letterpress CTAs, the
// customer/staff chrome split) is slice 2. Until then craft re-exports the
// shared chrome exactly like classic/Shell.tsx does: same rationale (visual
// parity for staff/admin, zero risk to the one thing every tenant already
// depends on), just deferred one slice further because craft's own chrome
// is net-new design work, not an extraction.
export { default } from '@/app/app-internal-layout';
