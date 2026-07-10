// classic template Shell (ADR-006, S15 T2).
//
// v1 extraction = COMPOSITION, not rewrite: app-internal-layout.tsx still
// interleaves customer chrome (header/nav/footer) with the staff/admin
// chrome (Sidebar, admin toggles) that is deliberately NOT templated in v1.
// Splitting that 330-LOC file risks visual drift on live prod for zero v1
// benefit, so the classic Shell re-exports it unchanged — visual parity
// beats structural purity (screenshot suite is the gate). When the craft
// template (T3) needs its own customer chrome, the customer/staff split
// happens then, against the baseline this extraction preserves.
export { default } from '@/app/app-internal-layout';
