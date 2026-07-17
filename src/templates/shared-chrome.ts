// Staff/admin chrome routing (ADR-006, S15 T3 slice 2).
//
// Staff/admin surfaces are deliberately NOT templated in v1 (see the
// TemplateDefinition contract in ./types.ts): on these routes every
// template's Shell must render the identical shared chrome
// (src/app/app-internal-layout.tsx — Sidebar, admin toggles, the shared
// header/footer staff see today). Templates only own the CUSTOMER chrome.
//
// Kept as one shared helper so the two Shells can never drift on which
// routes count as staff/admin.
const SHARED_CHROME_PREFIXES = ['/admin', '/cashier', '/server', '/kitchen-staff'];

export function isSharedChromeRoute(pathname: string): boolean {
  return SHARED_CHROME_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
