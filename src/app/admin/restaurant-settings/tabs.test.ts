import { MODULE_IDS, type ModuleId } from '@/lib/modules';
import { isSetupStepReachable } from '@/lib/setupSteps';
import { TAB_IDS, TAB_MODULE, isTabAvailable, isTabId, type TabType } from './tabs';

/**
 * The payments tab is the FIRST tab on this page that is not universal, and the page it
 * lives on is core and ungated. So `ROUTE_MODULE_ENTRIES` — which is what stops a nav entry
 * appearing in front of a hidden page — cannot express "this one strip is not for you", and
 * `TAB_MODULE` is what does (SOFRA-PAYMENTS-PLAN §9 P7a).
 */
describe('TAB_MODULE', () => {
  it('names a real module for every tab it gates, and gates only tabs that exist', () => {
    for (const [tab, moduleId] of Object.entries(TAB_MODULE)) {
      expect(TAB_IDS).toContain(tab as TabType);
      expect(MODULE_IDS).toContain(moduleId as ModuleId);
    }
  });

  it('gates the payments tab and nothing else — every other tab is core', () => {
    // Stated as an equality rather than a membership check: a tab silently ACQUIRING a
    // module would hide it from tenants who have always had it, which nobody would report
    // as a bug because a missing tab looks like a tab that was never there.
    expect(Object.keys(TAB_MODULE)).toEqual(['payments']);
    expect(TAB_MODULE.payments).toBe('online-payments');
  });

  it('agrees with the checklist step that deep-links to it', () => {
    // Two independent gates on the same surface, and they must not disagree: the step is
    // dropped by its OWN moduleId (the payload carries it), the tab by TAB_MODULE. If one
    // said yes and the other no, the checklist would hand out `?tab=payments` to a tenant
    // whose tab strip does not contain it.
    const withoutPayments = (m: ModuleId | null) => m === null || m !== 'online-payments';
    expect(
      isSetupStepReachable({ key: 'online-payments', moduleId: 'online-payments' }, () => null, withoutPayments),
    ).toBe(false);
    expect(
      isSetupStepReachable(
        { key: 'online-payments', moduleId: 'online-payments' },
        () => null,
        () => true,
      ),
    ).toBe(true);
  });

  it('still recognises payments as a tab id', () => {
    expect(isTabId('payments')).toBe(true);
  });
});

describe('isTabAvailable', () => {
  const has = (...ids: ModuleId[]) => new Set<ModuleId>(ids);

  it('hides the payments tab from a tenant that did not buy it', () => {
    // The defect this prevents: a tab whose only endpoint answers THIS tenant 404, sitting
    // in the strip next to six that work. Nobody reports a tab that does nothing as a bug;
    // they just stop trusting the page.
    expect(isTabAvailable('payments', has('core', 'cashier'))).toBe(false);
    expect(isTabAvailable('payments', has('core', 'online-payments'))).toBe(true);
  });

  it('never hides a tab no module owns, whatever the module set', () => {
    // These are the tabs a Core-only tenant has always had. Gating one by accident would
    // take away settings they have been using, and a missing tab looks like one that was
    // never there.
    const core = has('core');
    const universal = TAB_IDS.filter((id) => id !== 'payments');
    expect(universal.filter((id) => !isTabAvailable(id, core))).toEqual([]);
  });

  it('offers everything to an instance running everything — RUMI included', () => {
    // `ModulesContext` defaults to the FULL set, because the live RUMI install reports no
    // module list and "no information" must mean everything. A tab gate that read that as
    // "nothing" would empty tenant 1's settings page.
    const all = new Set<ModuleId>(MODULE_IDS);
    expect(TAB_IDS.filter((id) => !isTabAvailable(id, all))).toEqual([]);
  });
});
