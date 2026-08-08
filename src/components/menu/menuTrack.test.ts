import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * The menu page has ONE content track, and it is the width the design system names (S15, D11+D12).
 *
 * The slice is pure CSS, so the screenshot gate is the thing that sees it — but only at the two
 * desktop widths it captures, and only as pixels. What it cannot see is the invariant the whole
 * arrangement rests on: that the four surfaces sharing the track read the SAME declaration.
 * `.menuLayout`, the Chef's Special strip, the category bar's tab row and (by exclusion) the grid
 * are in three different stylesheets, and the failure mode is one of them being "fixed" to a
 * literal 1200px that later drifts from the others — which is exactly the two-track state S11
 * created and this slice removes.
 *
 * So: one declaration, three consumers, no second literal. Plus the numbers, read out of DESIGN.md
 * rather than restated from it.
 */

const ROOT = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const PAGE = read('app/styles/MenuPage.module.css');
const CONTENT = read('components/menu/MenuContent.module.css');
const DESIGN_MD = readFileSync(join(ROOT, '../docs/stitch-screens/heritage_table/DESIGN.md'), 'utf8');

/** A declaration's value, comments stripped — this slice's comments quote the values it removed. */
function decl(css: string, prop: string): string | undefined {
  return new RegExp(`(?:^|;|\\n)\\s*${prop}:\\s*([^;]+);`).exec(css.replace(/\/\*[\s\S]*?\*\//g, ''))?.[1].trim();
}

describe('menu page content track', () => {
  /**
   * DESIGN.md §Layout: "12-column grid with a max-width of 1200px. Content is centered with
   * generous outer margins to simulate a centered menu page." Also its front-matter `max-width`.
   * Both are read, because the file contradicts itself on the radius and it is worth knowing early
   * if it ever does so here.
   */
  it('takes the width the design system names, from both places it names it', () => {
    const prose = /max-width of (\d+px)\b/.exec(DESIGN_MD);
    const frontMatter = /^\s*max-width:\s*(\d+px)\s*$/m.exec(DESIGN_MD);

    expect(prose).not.toBeNull();
    expect(frontMatter).not.toBeNull();
    expect(frontMatter![1]).toBe(prose![1]);
    expect(decl(PAGE, '--menu-track-max')).toBe(prose![1]);
  });

  /**
   * Declared exactly once, tree-wide.
   *
   * The point of a variable here rather than four copies of `1200px`: `.menuLayout`, the hero and
   * the nav row live in three stylesheets, and a page whose bar is on a different track from its
   * cards is the defect S11 shipped and this slice closes. A second declaration re-opens it
   * silently — nothing renders wrong until someone changes one of them.
   */
  it('is declared in exactly one place', () => {
    let found = '';
    try {
      found = execFileSync('grep', ['-rl', '--include=*.css', '--', '--menu-track-max:', ROOT], { encoding: 'utf8' });
    } catch (error) {
      // grep exits 1 on no matches; that case must fail as a diff, not as a shell error.
      if ((error as { status?: number }).status !== 1) throw error;
    }

    expect(
      found
        .split('\n')
        .filter(Boolean)
        .map((p) => p.replace(/^.*\/src\//, 'src/')),
    ).toEqual(['src/app/styles/MenuPage.module.css']);
  });

  /** Every surface that should be on the track reads the variable — both templates. */
  it.each([
    'app/styles/MenuPage.module.css',
    'components/menu/FeaturedSpecial.module.css',
    'components/menu/CategoryNav.module.css',
    'templates/craft/surfaces/CraftFeaturedSpecial.module.css',
    'templates/craft/surfaces/CraftCategoryNav.module.css',
  ])('%s reads the shared track', (file) => {
    expect(read(file).replace(/\/\*[\s\S]*?\*\//g, '')).toContain('max-width: var(--menu-track-max');
  });

  /**
   * NO surface on this page carries a second track — asserted over every `max-width` in the page's
   * own stylesheets, not over the string `1200px`.
   *
   * The first version of this file pinned "no second literal", and that is a weaker claim than it
   * reads as. Two forks passed it: a `max-width: 900px` on `.itemsGrid` (in a file the per-surface
   * list did not name, and needing no `1200px` at all), and a `max-width: 1000px` on `.menuMain` —
   * inside the very file the test calls the single source of truth, one line below `.menuLayout`,
   * putting `<main>` on its own track while the nav stayed on the shared one. That is precisely the
   * two-track state S11 shipped and this slice exists to close, and the test was blind to it.
   *
   * So the invariant is stated positively, and scoped to the declarations that can BE a track: a
   * pixel `max-width` of 900px or more on this page is a claim about the content track, and it must
   * be made through the variable. Smaller and non-pixel caps are left alone — `max-width: 16ch` on a
   * tab label is a measure, not a track, and a rule that failed on it would be turned off.
   */
  it('declares no second track anywhere on the page', () => {
    const FILES = [
      'app/styles/MenuPage.module.css',
      'components/menu/MenuContent.module.css',
      'components/menu/CategoryNav.module.css',
      'components/menu/FeaturedSpecial.module.css',
    ];
    const offenders = FILES.flatMap((file) => {
      // Media-query preludes are not declarations; `@media (max-width: 968px)` is not a cap.
      const body = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/@media[^{]*\{/g, '{');
      return [...body.matchAll(/(?:^|;|\n)\s*max-width:\s*(\d+)px\s*;/g)]
        .filter(([, px]) => Number(px) >= 900)
        .map(([, px]) => `${file}: ${px}px`);
    });

    expect(offenders).toEqual([]);
  });

  /**
   * Two columns while the rail is on screen (D11), and the dead caps are gone.
   *
   * `1400px` stood on `.itemsGrid`, `.sectionHeadingRow` and `.bundlesGrid` and could never bind
   * once the track caps at 1200 and the rail takes 384 of it — the widest the grid reaches is 816px
   * with the rail and 928px without. A cap that cannot bind reads as a live constraint to the next
   * person widening the track, so this asserts they are gone rather than merely harmless.
   * (`.bundlesGrid` is dead CSS besides — no consumer anywhere in `src`.)
   */
  it('drops the grid to two columns and removes the caps that can no longer bind', () => {
    const base = CONTENT.replace(/\/\*[\s\S]*?\*\//g, '').split('@media')[0];

    expect(decl(base.slice(base.indexOf('.itemsGrid')), 'grid-template-columns')).toBe('repeat(2, 1fr)');
    expect(CONTENT.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('1400px');
  });

  /**
   * The page box itself must NOT be capped, which is the half most likely to be "simplified".
   *
   * `.menuContainer` paints the page canvas and is what `.stickyNav` cancels its inline gutter
   * against to run edge to edge — S11's gain, measured 0->1280 at 1280px. Capping the box would
   * take that back while looking like the tidier way to centre the content. Measured on the branch:
   * the bar spans 0->1920 at 1920px while its row sits on the 1200 track.
   */
  it('caps the content and not the page box', () => {
    const container = PAGE.replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = container.slice(container.indexOf('.menuContainer'), container.indexOf('.menuLayout'));

    expect(decl(rule, 'max-width')).toBe('none');
    expect(decl(rule, 'width')).toBe('auto');
  });
});
