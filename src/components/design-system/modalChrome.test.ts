import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

/**
 * Gate for the classic modal shell (MENU-DESIGN-CONFORMANCE-PLAN S13).
 *
 * Nothing else can see it.
 *
 * Not because no capture opens a dialog — `e2e/screenshots/helpers.ts` opens two, the customization
 * sheet at :132 and the guest-details modal at :148 — but because both are CLOSED before anything is
 * shot: `await expect(modal).toBeHidden()` at :154 gates the navigation, and the seven captures in
 * `customer-routes.screen.ts` all fire on a settled page. So no committed frame contains modal
 * chrome, and every one of the seven capture names would be byte-identical with these tokens set to
 * anything at all. (The axe pass is a different spec — `e2e/tests/**`, also with no dialog open.)
 *
 * No classic design screen governs the surface either: `role="dialog"`, `aria-modal` and
 * `fixed inset-0` match zero of the `code.html` files under `docs/stitch-screens/`, and every
 * modal-shaped folder there — `modal_shell_`, `item_details_`, `confirmation_dialog_`, `order_type_`,
 * `table_selection_`, `image_lightbox_`, `contact_details_`, `delivery_address_`, `order_received_`,
 * `reservation_status_` — carries only a `screen.png`, which makes it craft (plan §0). So
 * `heritage_table/DESIGN.md` is this surface's entire specification, and this file is the only thing
 * that holds the shell to it.
 *
 * Assertions are read out of DESIGN.md rather than restated from it. A gate that hardcodes `10px`
 * stays green if the design system changes underneath it; one that parses the prose fails, which is
 * the report worth having.
 *
 * And every value assertion is paired with a CONSUMPTION assertion. An earlier draft of this file
 * compared token declarations to each other and to DESIGN.md, and stayed green through four separate
 * mutations that reverted the slice at the call site — including deleting
 * `font-family: var(--modal-title-font)` from `.title`, which restores the exact defect the slice
 * exists to fix while the test named for that defect still passed. Comparing two declarations proves
 * they agree, not that anything reads either one.
 */

const ROOT = join(__dirname, '../..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

const SHARED_TOKENS = read('design-system/tokens/colors.css');
const CLASSIC_TOKENS = read('templates/classic/tokens.css');
const CRAFT_TOKENS = read('templates/craft/tokens.css');
const BASE_MODAL = read('components/design-system/BaseModal.module.css');
const DESIGN_MD = readFileSync(join(ROOT, '../docs/stitch-screens/heritage_table/DESIGN.md'), 'utf8');

/** The seven structural tokens BaseModal's shell reads. `--modal-body-*` is a different family. */
const SHELL = ['radius', 'border', 'shadow', 'rule', 'title-font', 'title-size', 'title-weight'].map(
  (n) => `--modal-${n}`,
);

interface Rule {
  selector: string;
  body: string;
  /** The innermost enclosing at-rule prelude, or null for a top-level rule. */
  atRule: string | null;
}

/**
 * Every style rule in a stylesheet, with its at-rule nesting recorded.
 *
 * A brace scanner rather than a regex, because nesting is the whole point. A regex that treats `{`
 * and `}` as rule delimiters cannot tell a top-level `:root` from one inside `@media`, and cannot
 * tell a card's base rule from its `@media (max-width: 600px)` override — both blind spots let a
 * revert of this slice hide from the assertions below.
 */
function parse(css: string): Rule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Rule[] = [];
  const stack: string[] = [];
  let buf = '';

  for (const ch of src) {
    if (ch === '{') {
      // A prelude runs back to the previous `}`, so it can carry statements — both token files open
      // with `@import '…';`. A selector cannot contain a semicolon, so the last segment is it.
      stack.push(buf.split(';').pop()!.trim());
      buf = '';
    } else if (ch === '}') {
      const selector = stack.pop() ?? '';
      if (!selector.startsWith('@')) {
        out.push({ selector, body: buf.trim(), atRule: stack.find((s) => s.startsWith('@')) ?? null });
      }
      buf = '';
    } else {
      buf += ch;
    }
  }
  return out;
}

/**
 * Every TOP-LEVEL rule for `selector`, concatenated in declaration order.
 *
 * Both halves matter. Concatenating catches a revert appended as a second `:root` further down the
 * file — which `decl()`'s last-match then resolves the way the cascade does. Restricting to top
 * level keeps a breakpoint override out: `.menuItem` and `.itemTitle` are each declared twice, the
 * second time inside `@media (max-width: 600px)`, which deliberately strips the card chrome for the
 * borderless mobile rows. Base is what the desktop card paints and what the shell is compared to.
 */
function rule(css: string, selector: string): string {
  const found = parse(css).filter((r) => r.atRule === null && r.selector === selector);
  if (found.length === 0) throw new Error(`selector not found at top level: ${selector}`);
  return found.map((r) => r.body).join('\n');
}

/** A custom property's effective value: the LAST declaration, as the cascade takes it. */
function decl(body: string, name: string): string | undefined {
  return [...body.matchAll(new RegExp(`(?:^|;|\\n)\\s*${name}:\\s*([^;]+);`, 'g'))].pop()?.[1].trim();
}

/** `0 1px 3px rgba(0,0,0,.06)` and `0 1px 3px rgba(0, 0, 0, 0.06)` are the same shadow. */
const normalise = (v: string) => v.replace(/\s+/g, '').replace(/([(,])\./g, (_, lead) => `${lead}0.`);

describe('classic modal chrome', () => {
  const shellTokens = rule(SHARED_TOKENS, ':root');

  /**
   * The half an all-declarations gate cannot state: that BaseModal still READS each token, from the
   * rule that should carry it.
   *
   * Every mutation that reverted this slice at the call site — a literal `16px` back on `.dialog`,
   * `border: none`, the two-layer shadow, a deleted `font-family` on `.title` — was invisible to the
   * value assertions below, because they compare declarations in the token files to each other and
   * to DESIGN.md. Asserted per RULE rather than per file: a file-wide search is satisfied by any one
   * surviving `var(--modal-*)` anywhere in the stylesheet.
   */
  it.each([
    [
      '.dialog',
      ['border: var(--modal-border)', 'border-radius: var(--modal-radius)', 'box-shadow: var(--modal-shadow)'],
    ],
    ['.header', ['border-bottom: var(--modal-rule)']],
    [
      '.title',
      [
        'font-family: var(--modal-title-font)',
        'font-size: var(--modal-title-size)',
        'font-weight: var(--modal-title-weight)',
      ],
    ],
    ['.footer', ['border-top: var(--modal-rule)']],
  ])('BaseModal %s reads the tokens it is skinned by', (selector, declarations) => {
    const body = rule(BASE_MODAL, selector);
    for (const d of declarations) expect([selector, d, body.includes(d)]).toEqual([selector, d, true]);
  });

  /**
   * DESIGN.md §Shapes: "A universal **10px (rounded-lg)** radius is applied to all cards, buttons,
   * input fields, and image containers." The shell shipped 16px, carried over verbatim from the
   * pre-token modal and never reconciled with the design system.
   *
   * DESIGN.md contradicts itself here and the prose is the half to believe: its machine-readable
   * front-matter says `rounded: lg: 1rem` — 16px, the value being removed. The generated screens
   * settle it against their own token block: `design_system_specimen_sheet/code.html:193` draws the
   * card as `rounded-[10px]`, an explicit arbitrary-value override of `rounded-lg`, and
   * `MenuItem.module.css` has shipped 10px since the redesign. Recorded so the next reader does not
   * re-open it from the front-matter.
   */
  it('takes the radius the design system calls universal', () => {
    const spec = /universal \*\*(\d+px) \(rounded-lg\)\*\* radius/.exec(DESIGN_MD);
    expect(spec).not.toBeNull();
    expect(decl(shellTokens, '--modal-radius')).toBe(spec![1]);
  });

  /**
   * DESIGN.md §Elevation: "All cards must feature a 1px solid border (#DDDDDD in light, #444444 in
   * dark). This is a non-negotiable structural element". `--modal-border` was `none`.
   *
   * The token, not the literal: `--border-default` is the only border token that flips for dark, and
   * it holds exactly the two hexes the rule names. Asserted here so the pairing cannot rot into
   * `--border-light`, which has no dark override at all and paints near-white on a dark dialog —
   * the same defect S3 fixed on the dish card's foot rule.
   */
  it('draws the hairline the design system calls non-negotiable, on the token that flips', () => {
    const spec = /1px solid border \((#[0-9a-fA-F]{6}) in light, (#[0-9a-fA-F]{6}) in dark\)/i.exec(DESIGN_MD);
    expect(spec).not.toBeNull();

    expect(decl(shellTokens, '--modal-border')).toBe('1px solid var(--border-default)');
    expect(decl(shellTokens, '--modal-rule')).toBe('1px solid var(--border-default)');

    expect(decl(shellTokens, '--border-default')?.toLowerCase()).toBe(spec![1].toLowerCase());
    expect(decl(rule(SHARED_TOKENS, "html[data-theme='dark']"), '--border-default')?.toLowerCase()).toBe(
      spec![2].toLowerCase(),
    );
  });

  /**
   * One shadow literal, shared with the dish card.
   *
   * This is token hygiene rather than a conformance fix, and the distinction is worth keeping
   * straight: DESIGN.md §Elevation scopes both its rules to *cards* ("Only one shadow level is
   * permitted for cards"), and a dialog at `z-index: 9999` over a scrim is exactly the floating
   * element that section's rationale excludes — the reasoning that gave the floating cart button
   * `shadow-lg` (plan trap 7). Neither shadow is visible in any case: `.overlay` is
   * `rgba(0, 0, 0, 0.6)` and `.dialog` is its child, so both paint black onto an already-60%-black
   * scrim (0.60 → 0.64 over 25px before, 0.60 → 0.624 over 3px now). What separates the dialog from
   * the page is the scrim, and now the hairline. So the value is chosen for having one shadow
   * literal on the page instead of two, and it is bound to the card's declaration rather than to a
   * constant so the two cannot drift.
   */
  it('runs the same shadow literal the dish card carries', () => {
    const spec = /Only one shadow level is permitted[^`]*`([^`]+)`/.exec(DESIGN_MD);
    expect(spec).not.toBeNull();

    const shell = decl(shellTokens, '--modal-shadow');
    expect(normalise(shell!)).toBe(normalise(spec![1]));

    const card = /box-shadow:\s*([^;]+);/.exec(rule(read('components/menu/MenuItem.module.css'), '.menuItem'));
    expect(normalise(card![1])).toBe(normalise(shell!));
  });

  /**
   * The defect a guest actually sees: tapping a card swapped the dish name out of the serif it was
   * drawn in and into the body sans, because the shared `--modal-title-font` default is `inherit`.
   *
   * Bound to the CARD's declaration, not to a font name. The claim is "the name does not change
   * family when the sheet opens", and only comparing the two sites can state it.
   *
   * Family only, deliberately. The card draws the name at DESIGN.md's `dish-name` step (1.15rem)
   * and `--modal-title-size` stays 1.25rem, so the name still grows slightly on open. That token is
   * the shell's, shared by every BaseModal in the app — the table picker, "Almost there", the
   * confirmation dialogs — whose titles are not dish names and would all shrink with it. Sizing the
   * shell to fit one modal's content is the wrong lever; if the sheet ever wants the exact card step
   * it should set it on its own title, not on all of them.
   */
  it('keeps the dish name in the family the card drew it in', () => {
    const classicBody = rule(CLASSIC_TOKENS, 'body');
    const cardName = rule(read('components/menu/MenuItemDetails.module.css'), '.itemTitle');

    expect(/font-family:\s*var\(--font-family-display\)/.test(cardName)).toBe(true);
    expect(decl(classicBody, '--modal-title-font')).toBe('var(--font-family-display)');
  });

  /**
   * The scope, which is the whole reason the override lives in the template file rather than beside
   * the other six tokens.
   *
   * next/font applies its variable class to <body> (`app/layout.tsx`), so `--font-display` — and
   * therefore `--font-family-display`, which reads it — exists only from <body> down. Custom
   * properties are substituted where they are DECLARED: `--modal-title-font:
   * var(--font-family-display)` written into a `:root` block is substituted on <html>, one level
   * above the definition, where it is guaranteed-invalid. `font-family` is an inherited property, so
   * BaseModal's `.title` would fall back to the body sans — the change would read as shipped while
   * doing nothing. (Written with a literal fallback it would not have been silent; it would have
   * rendered Georgia, a visibly wrong serif. Neither is the fix.)
   *
   * So the invariant is not "the value is right" but "the two are declared in the same rule, and
   * that rule is `body`" — which is what fails if someone tidies the override up into the shared
   * token layer.
   */
  it('declares the title font where the display font actually exists', () => {
    const owning = parse(CLASSIC_TOKENS).filter((r) => decl(r.body, '--modal-title-font') !== undefined);
    expect(owning.map((r) => [r.atRule, r.selector])).toEqual([[null, 'body']]);
    expect(decl(owning[0].body, '--font-family-display')).toBeDefined();

    // …and the shared layer must not reach for a body-scoped property from :root. Comments stripped:
    // the block above this slice's declarations EXPLAINS the trap by naming `--font-family-display`,
    // so a raw read finds the prose and reports the trap as shipped.
    expect(decl(shellTokens, '--modal-title-font')).toBe('inherit');
    expect(SHARED_TOKENS.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('--font-family-display');
  });

  /**
   * The shared layer declares the shell in ONE rule, and it is the top-level `:root`.
   *
   * This is what makes the craft claim below true, not just tidiness. A `--modal-*` in the shared
   * `html[data-theme='dark']` block is specificity (0,2,1) and would outrank craft's (0,1,0)
   * `:root` — so classic's chrome would leak onto every craft page in dark mode only, a state no
   * craft baseline captures. It also closes the cheapest revert of this slice: a second `:root`, or
   * one tucked inside an `@media`, appended lower in the file.
   */
  it('is declared once in the shared layer, where craft can outrank it', () => {
    const owners = parse(SHARED_TOKENS).filter((r) => SHELL.some((t) => decl(r.body, t) !== undefined));
    expect(owners.map((r) => [r.atRule, r.selector])).toEqual([[null, ':root']]);
  });

  /**
   * Craft overrides all seven in its own top-level `:root`, which its own `@import` of the shared
   * layer guarantees comes second — equal specificity, later source order. So nothing above reaches
   * a craft page. Verified in a browser too: craft's dialog measures a 255px/15px organic radius, a
   * 2px kraft border, a 5px flat letterpress shadow and an Amatic SC title.
   *
   * Token-for-token rather than a spot check: a shell token added to the shared block without a
   * craft counterpart starts leaking immediately, and only an exhaustive check reports that.
   */
  it('is overridden token-for-token by craft', () => {
    const craftRoot = rule(CRAFT_TOKENS, ':root');
    for (const token of SHELL) {
      expect([token, decl(shellTokens, token) !== undefined]).toEqual([token, true]);
      expect([token, decl(craftRoot, token) !== undefined]).toEqual([token, true]);
    }
  });

  /**
   * And the other half of the blast radius: BaseModal is the sole consumer, so "every modal" is the
   * real reach and no non-modal surface moves with it. An exhaustive tree search rather than a spot
   * check — a second consumer would silently widen the reach of every future edit to the block.
   */
  it('is consumed only by BaseModal', () => {
    let found = '';
    try {
      // grep exits 1 on zero matches, which execFileSync raises. That case (no consumer at all —
      // BaseModal stopped reading the tokens, so the whole block is inert) must fail as a diff, not
      // as "Command failed: grep -rl …".
      found = execFileSync(
        'grep',
        ['-rlE', '--include=*.css', '--', 'var\\(--modal-(radius|border|shadow|rule|title-)', ROOT],
        { encoding: 'utf8' },
      );
    } catch (error) {
      if ((error as { status?: number }).status !== 1) throw error;
    }

    expect(
      found
        .split('\n')
        .filter(Boolean)
        .map((p) => p.replace(/^.*\/src\//, 'src/'))
        .sort(),
    ).toEqual(['src/components/design-system/BaseModal.module.css']);
  });
});
