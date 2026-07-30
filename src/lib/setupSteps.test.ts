import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TAB_IDS } from '@/app/admin/restaurant-settings/tabs';
import { moduleForPath, type ModuleId } from '@/lib/modules';
import { SETUP_STEP_KEYS, isSetupStepReachable, setupStepHref, setupStepPathname } from '@/lib/setupSteps';

const all = (): ((m: ModuleId | null) => boolean) => () => true;
const only =
  (...enabled: ModuleId[]) =>
  (m: ModuleId | null) =>
    m === null || enabled.includes(m);

describe('setupStepHref', () => {
  it('maps every step key the backend can send', () => {
    // The backend owns the vocabulary; an unmapped key would render as a step with no
    // way to act on it. `printing` is the one deliberate null — the printer app is a
    // binary, not a page here.
    const unmapped = SETUP_STEP_KEYS.filter((k) => k !== 'printing' && !setupStepHref(k));
    expect(unmapped).toEqual([]);
    expect(setupStepHref('printing')).toBeNull();
  });

  it('points every step at a page that actually exists on disk', () => {
    // The assertion above only proves a step maps to a NON-EMPTY string. That is the
    // weaker claim, and it stays green if any of these pages is renamed or moved — at
    // which point the checklist ships a row that 404s, which is the whole defect class
    // this map exists to avoid. So resolve each route to its App Router file.
    const missing = SETUP_STEP_KEYS.map((key) => ({ key, path: setupStepPathname(key) }))
      .filter(({ path }) => path !== null)
      .filter(({ path }) => !existsSync(join(process.cwd(), 'src/app', path!, 'page.tsx')))
      .map(({ key }) => key);
    expect(missing).toEqual([]);
  });

  it('only deep-links to restaurant-settings tabs that exist', () => {
    // An unknown `?tab=` silently falls back to the default tab, so a typo here sends
    // the owner to Working Hours when the step said "choose your look" — wrong page,
    // no error, and nothing to notice.
    const tabs = SETUP_STEP_KEYS.map((k) => setupStepHref(k))
      .filter((href): href is string => !!href && href.includes('?tab='))
      .map((href) => new URLSearchParams(href.split('?')[1]).get('tab'));
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.filter((t) => !TAB_IDS.includes(t as (typeof TAB_IDS)[number]))).toEqual([]);
  });

  it('returns null for a key this build does not know', () => {
    // A backend that ships a new step before the frontend does must degrade to
    // guidance without a link, never to a link that 404s.
    expect(setupStepHref('a-step-from-the-future')).toBeNull();
  });
});

describe('setupStepPathname', () => {
  it('strips the query so module lookup sees a real path', () => {
    // `moduleForPath` matches on segment boundaries; handing it
    // `/admin/restaurant-settings?tab=general` would silently find no module and read
    // a gated route as ungated.
    expect(setupStepPathname('restaurant-info')).toBe('/admin/restaurant-settings');
    expect(setupStepPathname('opening-hours')).toBe('/admin/restaurant-settings');
    expect(setupStepPathname('menu')).toBe('/admin/menu-management');
    expect(setupStepPathname('printing')).toBeNull();
  });
});

describe('isSetupStepReachable', () => {
  it('keeps every step when the instance runs every module', () => {
    const dropped = SETUP_STEP_KEYS.filter((k) => !isSetupStepReachable({ key: k }, moduleForPath, all()));
    expect(dropped).toEqual([]);
  });

  it('drops a step whose route this instance would block', () => {
    // A checklist row IS a link to a route. Offering one the route guard blocks is the
    // same defect as leaving a nav entry behind a hidden page — and the owner meets it
    // on the first thing the product ever asked them to do.
    const core = only();
    expect(isSetupStepReachable({ key: 'reservations' }, moduleForPath, core)).toBe(false);
    expect(isSetupStepReachable({ key: 'loyalty' }, moduleForPath, core)).toBe(false);
    expect(isSetupStepReachable({ key: 'cashier' }, moduleForPath, core)).toBe(false);
    expect(isSetupStepReachable({ key: 'kitchen-board' }, moduleForPath, core)).toBe(false);
    expect(isSetupStepReachable({ key: 'server' }, moduleForPath, core)).toBe(false);
  });

  it('keeps a module step once that module is enabled', () => {
    const withReservations = only('reservations');
    expect(isSetupStepReachable({ key: 'reservations' }, moduleForPath, withReservations)).toBe(true);
    expect(isSetupStepReachable({ key: 'loyalty' }, moduleForPath, withReservations)).toBe(false);
  });

  it('never drops a core step, whatever the module set', () => {
    // These are the steps a Core-only tenant needs most; gating them by accident would
    // leave the smallest customer with no guidance at all.
    const core = only();
    const coreSteps = ['restaurant-info', 'opening-hours', 'appearance', 'menu', 'staff'];
    const dropped = coreSteps.filter((k) => !isSetupStepReachable({ key: k }, moduleForPath, core));
    expect(dropped).toEqual([]);
  });

  it('keeps a step with no route — it is guidance, not a link', () => {
    expect(isSetupStepReachable({ key: 'printing' }, moduleForPath, only())).toBe(true);
    expect(isSetupStepReachable({ key: 'a-step-from-the-future' }, moduleForPath, only())).toBe(true);
  });
});
