import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The craft-skin contract for the guest sauces group (S6).
 *
 * `ItemCustomizationSheet` is NOT a template surface: craft does not override it, it re-skins the
 * shared sheet purely through the `--modal-body-*` custom properties it declares in
 * `templates/craft/tokens.css`. Every shared module CSS in this folder therefore has to write a
 * skinnable property as `var(--modal-body-*, <classic literal>)` — a literal renders as an
 * unskinned classic block inside craft's torn-paper sheet, which is a defect no unit test and no
 * screenshot can see today: the sheet is CLICK-OPENED, so the Playwright screenshot suite (which
 * captures routes) never reaches it.
 *
 * So this file is the gate that stands in for a baseline. It reads the real stylesheet and pins
 * three things: the skinnable properties go through the craft hooks, every hook that is used is one
 * craft actually declares (a typo would silently take the fallback forever), and no colour is a
 * literal (CLAUDE.md §5.5).
 */

const CSS = readFileSync(join(__dirname, 'SauceGroupSection.module.css'), 'utf8');
const CRAFT_TOKENS = readFileSync(join(__dirname, '../../../templates/craft/tokens.css'), 'utf8');

/** The declarations of one class body, e.g. `.row { … }`. */
function rule(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`selector not found: ${selector}`);
  return CSS.slice(start, CSS.indexOf('\n}', start));
}

describe('SauceGroupSection.module.css — craft re-skins it, so it must ask craft first', () => {
  it.each([
    ['.group', 'border', '--modal-body-option-border'],
    ['.group', 'border-radius', '--modal-body-option-radius'],
    ['.group', 'box-shadow', '--modal-body-option-shadow'],
    ['.title', 'font-family', '--modal-body-title-font'],
    ['.title', 'font-size', '--modal-body-title-size'],
    ['.row', 'border-block-start', '--modal-body-rule'],
    ['.rowExclusive', 'border-block-start', '--modal-body-option-border'],
    ['.price', 'font-family', '--modal-body-accent-font'],
  ])('%s writes %s through %s, with a classic fallback', (selector, property, token) => {
    const declaration = rule(selector)
      .split('\n')
      .find((line) => line.trim().startsWith(`${property}:`));

    expect(declaration).toBeDefined();
    expect(declaration).toContain(`var(${token},`);
  });

  it('uses only hooks craft actually declares — a typo would take the fallback forever', () => {
    const used = new Set(Array.from(CSS.matchAll(/var\((--modal-body-[\w-]+)/g), (match) => match[1]));

    expect(used.size).toBeGreaterThan(0);
    for (const token of used) {
      expect(CRAFT_TOKENS).toContain(`${token}:`);
    }
  });

  it('carries the accent colour on a token and no literal colour anywhere (§5.5)', () => {
    expect(rule('.input')).toContain('accent-color: var(--brand-primary)');
    expect(CSS).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(CSS).not.toMatch(/\b(rgb|hsl)a?\(/);
  });
});
