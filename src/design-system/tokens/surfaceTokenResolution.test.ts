import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The surfaces that `--background-light` was replaced by, gated on the token files that ship (#335).
 *
 * `--background-light` was referenced 22 times across 8 CSS Modules and defined NOWHERE — no
 * `:root`, no theme block, no template, no legacy alias. (#335 says "9 modules" in its summary and
 * then lists 8 paths; 8 is right.) Every one of those declarations was invalid and dropped, so
 * eight components painted no background at all and composited onto whatever happened to sit behind
 * them. Confirmed in the running app before the fix: reading `--background-light` off
 * `document.documentElement` returned the empty string.
 *
 * Nothing in CI could see it. `identity-obj-proxy` makes every `styles.x` lookup truthy, so no jest
 * test fails; the selector, bindings, composes and physical-CSS gates all parse structure rather
 * than resolve values; and no screenshot baseline renders any of the eight (the baselined routes are
 * home, menu, cart-empty, checkout-review, login, register and reservations).
 *
 * WHY --surface-card, and why this test exists rather than a comment. The replacement was chosen by
 * measurement, not taste: of the three plausible surfaces it is the ONLY one that clears WCAG AA
 * 4.5:1 for all three text tokens in all four theme/template combinations. `--surface-secondary`
 * fails `--text-muted` in three of the four and `--surface-secondary-light` fails it in ALL four —
 * and `--text-muted` genuinely lands on these surfaces (`QuickConfirmModal .infoText`,
 * `ConfirmationPage .additionalInfo`, `.itemVariation`, `.itemInstructions`). So the choice is
 * load-bearing, and a later edit to any of these token VALUES could quietly invalidate it. That is
 * what this file catches: it reads the real token files and re-derives the ratios.
 *
 * FOUR SITES ARE DELIBERATELY NOT --surface-card, and they are the more interesting half. A surface
 * that equals its own parent's is not merely redundant — where the rule is a `:hover`, it is a dead
 * declaration that looks alive, which is how `--background-light` survived unnoticed in the first
 * place. So: `OrderDetails .notesHeader` (gradient) and `.statusDropdownItem:hover`, plus
 * `OrderConfirmationModal .secondaryButton` (whose `:hover` sets `background: transparent`, which
 * only means anything if the resting fill differs from BaseModal's `--card-background`) take
 * `--surface-secondary`; `PointRuleForm .closeButton:hover` takes `--surface-secondary-light`,
 * because that modal's own fill FLIPS token between themes — `--card-background` in light,
 * `--secondary-color` in dark — so `--surface-secondary` there would be an exact no-op in both dark
 * themes. Every one of those four carries only `--text-color`, which is why stepping off
 * `--surface-card` is safe for them and not for the other 18. All of it is asserted below rather
 * than trusted to the comment.
 */

const CLASSIC = join(__dirname, 'colors.css');
const CRAFT = join(__dirname, '..', '..', 'templates', 'craft', 'tokens.css');
const SRC = join(__dirname, '..', '..');

/** AA for normal-size text. */
const AA = 4.5;

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = [0, 2, 4].map((i) => channel(parseInt(full.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The hex-valued custom properties of one theme block.
 *
 * Deliberately literal-only: an alias hop would let a token resolve through a name this test does
 * not gate, and every token read here is declared as a literal in both files.
 */
function themeBlock(file: string, selector: string): Record<string, string> {
  const css = readFileSync(file, 'utf8');
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`theme block not found in ${file}: ${selector}`);
  const block = css.slice(start, css.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[name] = value;
  }
  return out;
}

const THEMES = {
  'classic light': themeBlock(CLASSIC, ':root {'),
  'classic dark': themeBlock(CLASSIC, "html[data-theme='dark'] {"),
  'craft light': themeBlock(CRAFT, ':root {'),
  'craft dark': themeBlock(CRAFT, "html[data-theme='dark'] {"),
};

/** Every `.css` under `src/`, so the hard-zero assertion cannot be narrowed into vacuity. */
function stylesheets(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) stylesheets(full, acc);
    else if (entry.name.endsWith('.css')) acc.push(full);
  }
  return acc;
}

describe('--background-light is gone', () => {
  const sheets = stylesheets(SRC);

  it('examines a real corpus (a vacuous scan would otherwise pass)', () => {
    expect(sheets.length).toBeGreaterThan(200);
  });

  it('is referenced by no stylesheet, and defined by none either', () => {
    const offenders = sheets.filter((f) => readFileSync(f, 'utf8').includes('--background-light'));
    expect(offenders).toEqual([]);
  });
});

describe('the surfaces that replaced it clear AA in every theme', () => {
  /**
   * The text tokens that actually land on the replaced surfaces. `--text-muted` is the binding one
   * and the reason `--surface-secondary` was rejected for the other 21 sites.
   */
  const TEXT_ON_SURFACE_CARD = ['--text-primary', '--text-secondary', '--text-muted'];

  it.each(Object.keys(THEMES))('%s: --surface-card carries all three text tokens', (theme) => {
    const t = THEMES[theme as keyof typeof THEMES];
    expect(t['--surface-card']).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    // Reported as one object per theme so a failure names the offending token and its ratio
    // outright. Asserting inside the loop would report only the first breach, and comparing a
    // derived object against itself would assert nothing at all. The ratio is compared UNROUNDED —
    // rounding first would let a true 4.495 read as 4.50 and pass a 4.5 threshold.
    const measured = TEXT_ON_SURFACE_CARD.map((text) => ({
      text,
      ratio: contrast(t[text], t['--surface-card']),
    }));
    for (const text of TEXT_ON_SURFACE_CARD) expect(t[text]).toMatch(/^#[0-9a-fA-F]{3,8}$/);
    expect(measured.filter((m) => m.ratio < AA).map((m) => m.text)).toEqual([]);
  });

  /**
   * The four non---surface-card sites carry only `--text-color` (`--text-primary`), which is the
   * whole reason they may step off `--surface-card` at all. Both surfaces they use are gated.
   */
  it.each(Object.keys(THEMES))('%s: the two exception surfaces carry --text-primary', (theme) => {
    const t = THEMES[theme as keyof typeof THEMES];
    const measured = ['--surface-secondary', '--surface-secondary-light'].map((surface) => ({
      surface,
      ratio: contrast(t['--text-primary'], t[surface]),
    }));
    expect(measured.filter((m) => m.ratio < AA).map((m) => m.surface)).toEqual([]);
  });

  /**
   * The measurements that DECIDED the fix, pinned so they cannot silently stop being true. If a
   * token edit ever made a rejected candidate pass, the rationale in this file's header would be
   * stale — these say so instead of rotting. `--surface-secondary-light` is pinned too: leaving the
   * rejection of half the candidate set unasserted is exactly the rot this file exists to stop.
   */
  it('the rejected candidates still fail --text-muted: secondary in 3 themes, secondary-light in 4', () => {
    const failures = (surface: string) =>
      Object.entries(THEMES).filter(([, t]) => contrast(t['--text-muted'], t[surface]) < AA).length;
    expect({
      '--surface-secondary': failures('--surface-secondary'),
      '--surface-secondary-light': failures('--surface-secondary-light'),
    }).toEqual({ '--surface-secondary': 3, '--surface-secondary-light': 4 });
  });
});

/**
 * The defect class the fix itself nearly reintroduced: a surface equal to its own parent's.
 *
 * Where the rule is a `:hover`, that is a declaration which looks alive and does nothing — the same
 * way `--background-light` looked like a background for however long it sat there. Three of these
 * were caught only in review, after the first cut had swapped all 22 sites uniformly.
 *
 * Each case is asserted as "these two tokens must not resolve equal, in every theme" rather than by
 * re-reading the CSS: the parent's token is what a future edit is most likely to move, and a colour
 * comparison catches that where a name comparison would not.
 */
describe('no interactive surface collapses into its own parent', () => {
  const CASES = [
    // OrderConfirmationModal .secondaryButton — parent is BaseModal .modal (--card-background),
    // and its :hover is `background: transparent`, so the rest state must differ from the parent.
    { site: 'OrderConfirmationModal .secondaryButton', parent: '--surface-card', own: '--surface-secondary' },
    // OrderDetails .statusDropdownItem:hover — rests transparent inside .statusDropdownMenu.
    { site: 'OrderDetails .statusDropdownItem:hover', parent: '--surface-card', own: '--surface-secondary' },
    // PointRuleForm .closeButton:hover — the modal fill FLIPS token by theme, so BOTH are checked.
    { site: 'PointRuleForm .closeButton:hover (light)', parent: '--surface-card', own: '--surface-secondary-light' },
    {
      site: 'PointRuleForm .closeButton:hover (dark)',
      parent: '--surface-secondary',
      own: '--surface-secondary-light',
    },
  ];

  it.each(Object.keys(THEMES))('%s: every hover surface differs from its parent', (theme) => {
    const t = THEMES[theme as keyof typeof THEMES];
    const collapsed = CASES.filter((c) => t[c.parent] === t[c.own]).map((c) => c.site);
    expect(collapsed).toEqual([]);
  });

  /**
   * The counter-proof, and the reason the case above is not arbitrary.
   *
   * `PointRuleForm`'s dark modal fill is `var(--secondary-color)`, and `globals.css` aliases that
   * straight onto `--surface-secondary`. THAT alias — not a colour coincidence — is what would have
   * made `--surface-secondary` an exact no-op there in both dark themes, whatever values the
   * palettes carry. Asserted against the real file, because if the alias is ever re-pointed the
   * comment on that rule becomes wrong and the choice of `--surface-secondary-light` loses its
   * reason.
   */
  it('--secondary-color aliases --surface-secondary, which is what made it a no-op there', () => {
    const globals = readFileSync(join(SRC, 'app', 'globals.css'), 'utf8');
    expect(globals).toMatch(/--secondary-color:\s*var\(--surface-secondary\)\s*;/);
  });

  /**
   * Ties the CASES table above to the code it describes.
   *
   * Without this, the whole file gates token VALUES and nothing else — a later edit could point any
   * of these four rules back at `--surface-card`, reinstating the exact dead declaration this
   * describes, and all the colour assertions would still pass. Each entry names the real rule, so a
   * rename fails loudly rather than matching nothing and passing.
   */
  const DECLARED = [
    {
      file: ['components', 'checkout', 'OrderConfirmationModal.module.css'],
      rule: '.secondaryButton {',
      token: '--surface-secondary',
    },
    {
      file: ['components', 'cashier', 'OrderDetails.module.css'],
      rule: '.statusDropdownItem:hover:not(:disabled) {',
      token: '--surface-secondary',
    },
    {
      file: ['components', 'admin', 'PointRuleForm.module.css'],
      rule: '.closeButton:hover {',
      token: '--surface-secondary-light',
    },
    {
      file: ['components', 'cashier', 'OrderDetails.module.css'],
      rule: '.notesHeader {',
      token: '--surface-secondary',
    },
  ];

  it.each(DECLARED)('$rule still declares $token', ({ file, rule, token }) => {
    const css = readFileSync(join(SRC, ...file), 'utf8');
    const start = css.indexOf(`\n${rule}`);
    expect(start).toBeGreaterThan(-1); // a renamed rule must fail, not silently match nothing
    const body = css.slice(start, css.indexOf('\n}', start));
    // Comments carry token names as prose, so they are stripped before the assertion — otherwise a
    // rule could satisfy this on its own explanation, the trap adminPriceEditorContrast.test.ts hit.
    expect(body.replace(/\/\*[\s\S]*?\*\//g, '')).toContain(`var(${token})`);
  });
});
