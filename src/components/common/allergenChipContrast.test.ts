import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The allergen chip, gated on the stylesheet that actually ships.
 *
 * `AllergenDisplay` renders on the menu card, the Chef's Special strip, the item sheet, the bundle
 * rows, the server console and the admin product editor, in BOTH templates — and no automated gate
 * could see any of it. The E2E seed products carry `allergens: '[]'`, so the screenshot baselines
 * render zero chips and the axe pass has nothing to measure. That blind spot is why fourteen rules
 * across eleven colour families survived two redesign PRs, and why two of them were below AA the
 * whole time: `--success-color-dark` on `--success-color-xlight` measured 3.66:1 and the gluten-free
 * amber 3.46:1, on customer-facing allergen text.
 *
 * So this file reads the real CSS Module rather than a fixture. `presets.test.ts` gates the tenant
 * PALETTE pairs and `adminPriceEditorContrast.test.ts` gates the menu card's own tokens; neither can
 * see which token a chip rule reaches for, which is the thing that was wrong here.
 *
 * MENU-DESIGN-CONFORMANCE-PLAN S12.
 */

const HERE = __dirname;
const CHIP_CSS = readFileSync(join(HERE, 'AllergenDisplay.module.css'), 'utf8');
const DETAILS_CSS = readFileSync(join(HERE, '../menu/MenuItemDetails.module.css'), 'utf8');

/**
 * The stylesheet with comments removed.
 *
 * Not tidiness: this file's comments NAME the token families it removed, in order to explain why
 * they are gone. A scan of the raw text would match its own documentation and stay green over a rule
 * that put the colour back — the same trap `adminPriceEditorContrast.test.ts` records hitting.
 */
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Token values for one theme block of one token file, literals plus one alias hop. */
function tokens(file: string, selector: string): Record<string, string> {
  const css = readFileSync(join(HERE, file), 'utf8');
  const start = css.indexOf(selector);
  if (start === -1) throw new Error(`selector not found in ${file}: ${selector}`);
  const block = css.slice(start, css.indexOf('\n}', start));
  const out: Record<string, string> = {};
  for (const [, name, value] of block.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    out[name] = value;
  }
  for (const [, name, target] of block.matchAll(/(--[\w-]+):\s*var\((--[\w-]+)\)\s*;/g)) {
    if (out[target]) out[name] = out[target];
  }
  return out;
}

/** The declarations of one rule, comments already stripped. */
function rule(css: string, selector: string): string {
  const body = strip(css);
  const start = body.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  const end = body.indexOf('\n}', start);
  if (end === -1) throw new Error(`unterminated rule: ${selector}`);
  return body.slice(start, end);
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance(hex: string): number {
  const full = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex;
  const n = parseInt(full.replace('#', ''), 16);
  return 0.2126 * channel((n >> 16) & 0xff) + 0.7152 * channel((n >> 8) & 0xff) + 0.0722 * channel(n & 0xff);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;

/** The three surfaces a menu card takes: resting, hovered, and blocked (MenuItem.module.css). */
const CARD_SURFACES = ['--surface-card', '--surface-secondary-light', '--surface-secondary'] as const;

const TOKEN_FILES = [
  ['classic', '../../design-system/tokens/colors.css'],
  ['craft', '../../templates/craft/tokens.css'],
] as const;

const THEMES = [
  ['light', ':root {'],
  ['dark', "html[data-theme='dark'] {"],
] as const;

describe('the allergen chip carries no fill and no off-palette colour', () => {
  const body = strip(CHIP_CSS);

  /**
   * DESIGN.md §Components, verbatim: "No background fills for chips." Eleven of the fourteen rules
   * that shipped opened with one, and nine of those fills had no dark-theme override — so a dark
   * card carried a near-white pastel pill whose text had darkened underneath it.
   */
  it('declares no background anywhere except an explicit transparent', () => {
    // `background[a-z-]*`, not `background(-color)?`: the narrow form let `background-image:
    // linear-gradient(...)` through, which is a fill AND a gradient — the thing #458 had just
    // finished removing from the page — while this test still reported green.
    const fills = [...body.matchAll(/\n\s*background[a-z-]*:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(fills).toEqual(['transparent']);
  });

  /**
   * The families the design system prohibits or the semantic layer replaced.
   *
   * `--color-material-*` and `--color-green-*`/`--color-gold-*` are PRIMITIVES — raw palette entries
   * that no theme block redeclares. Reaching past the semantic layer for one is how the missing dark
   * overrides happened: there is nothing to override. DESIGN.md §Colors puts green and gold on an
   * explicit prohibition list on top of that.
   */
  it.each([
    ['material primitives', /--color-material-/],
    ['raw green primitives', /--color-green-/],
    ['gold', /--color-gold-|--warning-color|gold/i],
    ['success green', /--success-color|--status-success|--feedback-success/],
    ['info blue', /--status-info|--color-material-blue/],
  ])('carries no %s token', (_name, pattern) => {
    expect(body).not.toMatch(pattern);
  });

  /**
   * §5.5: no raw colour values in a module. The dark block held six `rgba()` literals, which is
   * exactly the shape a "just nudge the dark one" fix takes when the semantic token is missing.
   */
  it('carries no raw colour literal', () => {
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  /** One chip, one rule: nothing left that varies by which allergen it is. */
  it('has exactly one chip rule plus the counter modifier', () => {
    // Split on `}` and read each block's whole SELECTOR, rather than matching a line that carries
    // both the selector text and its `{`. The line-based form could not see `.allergenTag` when it
    // was the first member of a multi-line selector list — and prettier formats it that way, so the
    // bypass was stable rather than a fluke.
    const chipRules = body
      .split('}')
      .map((block) => block.slice(0, block.indexOf('{')).trim())
      .filter((selector) => selector.includes('.allergenTag'))
      .map((selector) => selector.replace(/\s*\n\s*/g, ' '));
    expect(chipRules).toEqual(['.allergenTag', '.allergenTag.more']);
  });

  /** Binds the ratios below to the declarations that ship — a measured pair no rule uses is not a gate. */
  it('reaches for the tokens this file measures', () => {
    const chip = rule(CHIP_CSS, '.allergenTag');
    expect(chip).toContain('color: var(--text-secondary)');
    expect(chip).toContain('border: 1px solid var(--chip-border, var(--border-default))');
    expect(chip).toContain('border-radius: 10px');
  });

  /**
   * The card's other chip family. `MenuItemDetails`' `.allergyTag` renders the dietary tags on the
   * same card as these chips and had drifted to a different radius and a different ink; leaving it
   * would mean two "one neutral outline" chips that are not the same outline.
   */
  it('keeps MenuItemDetails’ dietary chip on the same outline', () => {
    const chip = rule(DETAILS_CSS, '.allergyTag');
    expect(chip).toContain('background-color: transparent');
    expect(chip).toContain('color: var(--text-secondary)');
    expect(chip).toContain('border: 1px solid var(--border-default)');
    expect(chip).toContain('border-radius: 10px');
  });
});

describe.each(TOKEN_FILES)('%s chip contrast', (_template, file) => {
  describe.each(THEMES)('%s theme', (_theme, selector) => {
    const v = tokens(file, selector);

    it.each(CARD_SURFACES)('the chip label clears AA on %s', (surface) => {
      expect(contrast(v['--text-secondary'], v[surface])).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });
});

/**
 * The measurements that decided the rule, fired so nobody re-derives them from the token names.
 */
describe('what the retired chip styling actually measured', () => {
  const light = tokens('../../design-system/tokens/colors.css', ':root {');
  const dark = tokens('../../design-system/tokens/colors.css', "html[data-theme='dark'] {");

  /**
   * Why the chip is NOT on `--text-muted`, which is DESIGN.md's chip colour to the byte.
   *
   * It passes on the resting card (4.59:1) and fails on the two surfaces the same card takes the
   * rest of the time: hovered and blocked. Reading only the resting card — the state every
   * screenshot baseline captures — would have called it correct.
   */
  it('records that the design’s literal muted grey fails on a hovered and a blocked card', () => {
    expect(contrast(light['--text-muted'], light['--surface-card'])).toBeGreaterThanOrEqual(AA_TEXT);

    expect(contrast(light['--text-muted'], light['--surface-secondary-light'])).toBeLessThan(AA_TEXT);
    expect(contrast(light['--text-muted'], light['--surface-secondary'])).toBeLessThan(AA_TEXT);
    expect(contrast(dark['--text-muted'], dark['--surface-secondary-light'])).toBeLessThan(AA_TEXT);
  });

  /**
   * The two chips that were below AA in the shipped file, each measured on its OWN fill — which is
   * the reading a guest actually got, and the one nobody took: `.vegan`/`.vegetarian` at 3.66:1 and
   * `.glutenFree` at 3.46:1. `colors.css` even flags the green token in its own comment as below AA
   * for normal text, and the chip used it as normal text anyway.
   */
  it('records that the green and the gluten-free gold chips failed on their own fills', () => {
    expect(contrast(light['--feedback-success-dark'], light['--feedback-success-xlight'])).toBeLessThan(AA_TEXT);
    expect(contrast(light['--color-material-orange-900'], light['--color-gold-100'])).toBeLessThan(AA_TEXT);
  });

  /**
   * The half-flipped pair. The `*-xlight` fills and the `--color-*` primitives are declared only on
   * `:root`, so a dark card kept the LIGHT pastel while nothing about it flipped — the vegan pill
   * rendered at 13.63:1 against the dark card, a near-white lozenge. Invisible to any check that
   * reads one token, and why the colour rules were deleted rather than given dark overrides.
   */
  it('records that the chip fills had no dark value at all', () => {
    expect(light['--feedback-success-xlight']).toBeDefined();
    expect(dark['--feedback-success-xlight']).toBeUndefined();
    expect(dark['--color-gold-100']).toBeUndefined();

    expect(contrast(light['--feedback-success-xlight'], dark['--surface-card'])).toBeGreaterThan(10);
  });
});
