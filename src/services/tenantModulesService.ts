import { MODULE_IDS, type ModuleId, isModuleId } from '@/lib/modules';

// Server-side tenant-modules service (sofra ADR-010 / S11). Uses a raw `fetch` (NOT
// apiClient) for the same reason tenantThemeService does: it runs in the RSC layout
// render and needs Next's ISR fetch-cache options, which apiClient — a client-side
// module that reads localStorage and refreshes tokens — cannot provide.
//
// This is read SERVER-side and handed down through a context rather than fetched in the
// browser, so a gated route never flashes its content before disappearing.
const SERVER_API_BASE = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL;

/** `GET /api/tenant/modules` payload (backend Features/Tenant/Dtos/TenantModulesDto). */
interface TenantModulesResponse {
  data?: { modules?: unknown; enforced?: unknown };
}

/**
 * The modules this instance runs.
 *
 * FAILS OPEN, always. An unreachable backend, a non-OK response, a malformed body — and,
 * importantly, an OLDER BACKEND that has no such endpoint and 404s — all resolve to the
 * full module set, which renders exactly the app that shipped before gating existed.
 * The backend is the enforcement boundary; this is presentation, and presentation that
 * fails closed would take features away over a network blip.
 *
 * ISR-cached for 30s (tagged so it can be invalidated): a tenant's module set changes on
 * re-provision, not per request.
 */
export async function getTenantModules(): Promise<ModuleId[]> {
  if (!SERVER_API_BASE) return [...MODULE_IDS];
  try {
    const res = await fetch(`${SERVER_API_BASE}/api/tenant/modules`, {
      next: { revalidate: 30, tags: ['tenant-modules'] },
    });
    if (!res.ok) return [...MODULE_IDS];
    const body = (await res.json()) as TenantModulesResponse;
    const modules = body?.data?.modules;
    if (!Array.isArray(modules)) return [...MODULE_IDS];
    const known = modules.filter((m): m is ModuleId => typeof m === 'string' && isModuleId(m));
    // An empty or all-unrecognised list is the unrestricted signal on the backend side
    // too — never read it as "this tenant has nothing".
    return known.length > 0 ? known : [...MODULE_IDS];
  } catch {
    // IGNORED ON PURPOSE: an unreadable module list is the UNRESTRICTED signal, same as an absent
    // one (see the note above and RUMI's own case). Surfacing this failure would mean gating a
    // paying tenant's features on a network blip — the enforcement fails OPEN by design here, and
    // the authoritative check is server-side.
    return [...MODULE_IDS];
  }
}
