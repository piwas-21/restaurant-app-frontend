import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Conformance gate for the kitchen-type control: it must be a SEGMENTED CONTROL, not a chip row
 * (#581f).
 *
 * It shipped as chips and the class names said `.segments`/`.segment` all along, which is why a
 * reader who greps for the name concludes the gap is already closed. The distinction is entirely
 * in three declarations — a gap BETWEEN items, a border ON each item, and a radius on all four
 * corners of each item — so this test reads those declarations rather than the names.
 *
 * Why a CSS-text test and not a render test: jsdom applies no stylesheet, so
 * `getComputedStyle(label).borderRadius` is empty for chips and for segments alike, and a snapshot
 * of the markup is identical in both — the markup never changed. `adminPriceEditorContrast.test.ts`
 * reads its component's CSS the same way and for the same reason.
 */

const CSS = readFileSync(join(__dirname, 'KitchenTypeSelector.module.css'), 'utf8');

/** One rule's declaration block, by exact selector. Two details are load-bearing:
 *
 *  - the match is ANCHORED at the start of a line. A plain `indexOf('.label {')` finds
 *    `.segment + .segment .label {` first, and the first draft of this file then asserted the
 *    divider rule's declarations against the `.label` expectations and failed for the wrong reason.
 *  - it THROWS on a miss rather than returning '', so a renamed selector fails loudly instead of
 *    vacuously satisfying every `not.toMatch` below. */
function rule(selector: string): string {
  const at = CSS.search(new RegExp(`^${selector.replaceAll(/[+*.:()]/g, '\\$&')} \\{`, 'm'));
  if (at === -1) throw new Error(`selector not found in KitchenTypeSelector.module.css: ${selector}`);
  return CSS.slice(at, CSS.indexOf('\n}', at));
}

describe('KitchenTypeSelector is drawn as a segmented control', () => {
  it('draws ONE outer border on the group, not one per option', () => {
    expect(rule('.segments')).toMatch(/border:\s*1px solid var\(--border-default\)/);
    // The chip row's tell: each label carried its own full border.
    expect(rule('.label')).toMatch(/border:\s*0/);
  });

  it('separates the options with a shared hairline instead of white space', () => {
    // The approved screen measures 1px at this junction and 5px between the tags below it.
    expect(rule('.segment + .segment .label')).toMatch(/border-inline-start:\s*1px solid var\(--border-default\)/);
    expect(rule('.segments')).not.toMatch(/\bgap\b/);
    // A shared border cannot survive a wrap, which is why the segments divide the row instead.
    expect(rule('.segments')).not.toMatch(/flex-wrap/);
    expect(rule('.segment')).toMatch(/flex:\s*1/);
  });

  it('rounds only the two outer ends, and rounds them logically so RTL mirrors', () => {
    expect(rule('.label')).toMatch(/border-radius:\s*0/);
    // The four logical corners read `border-<block>-<inline>-radius`, so the START segment rounds
    // its two INLINE-START corners and the END segment its two INLINE-END ones.
    expect(rule('.segment:first-of-type .label')).toMatch(/border-start-start-radius/);
    expect(rule('.segment:first-of-type .label')).toMatch(/border-end-start-radius/);
    expect(rule('.segment:last-of-type .label')).toMatch(/border-start-end-radius/);
    expect(rule('.segment:last-of-type .label')).toMatch(/border-end-end-radius/);
    // Rounding an inline-END corner on the FIRST segment would round the middle of the control.
    expect(rule('.segment:first-of-type .label')).not.toMatch(/-end-radius/);
  });

  it('draws the focus ring inside the segment, where a segmented control has room for it', () => {
    // At a positive offset the ring of a middle segment overlaps its neighbours and the ring of an
    // end segment is clipped by the group's own border.
    expect(rule('.input:focus-visible + .label')).toMatch(/outline-offset:\s*-2px/);
  });

  it('keeps the selected fill the code already ships, which the review endorsed over the screens', () => {
    const checked = rule('.input:checked + .label');
    expect(checked).toMatch(/background:\s*var\(--brand-primary\)/);
    expect(checked).toMatch(/color:\s*var\(--text-on-primary\)/);
  });
});
