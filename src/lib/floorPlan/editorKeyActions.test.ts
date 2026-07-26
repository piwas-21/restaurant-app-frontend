import { NUDGE_KEYS, deleteIntent, isFormField, nudgeSelection, rotationForKey } from './editorKeyActions';
import { tableMovable } from './movable';
import { planDocument, planItem, tableGeometry } from './__fixtures__/editorFixtures';

const doc = () =>
  planDocument([tableGeometry({ id: 't1', positionX: 1, positionY: 1 }), tableGeometry({ id: 't2' })], {
    items: [planItem({ id: 'i1' })],
  });

const table = (d: ReturnType<typeof doc>, id: string) => d.tables.find((t) => t.id === id)!;

describe('editorKeyActions — nudgeSelection', () => {
  it('moves every selected object by the step, and nothing else', () => {
    const before = doc();
    const after = nudgeSelection(before, ['t1'], NUDGE_KEYS.ArrowRight, 0.25);
    expect(table(after, 't1').positionX).toBeCloseTo(1.25, 5);
    expect(table(after, 't2').positionX).toBe(table(before, 't2').positionX);
  });

  it('clamps each object to the plan on its own, as the drag path does', () => {
    // The clamp mirrors the server's — the CENTRE stays in [0, width] — so a
    // nudge can never land somewhere Save would silently move it back from.
    const after = nudgeSelection(doc(), ['t1'], NUDGE_KEYS.ArrowLeft, 5);
    expect(table(after, 't1').positionX).toBe(0);
  });

  it('leaves unselected ids alone even when they exist', () => {
    const after = nudgeSelection(doc(), [], NUDGE_KEYS.ArrowUp, 0.25);
    expect(after).toEqual(doc());
  });
});

describe('editorKeyActions — deleteIntent', () => {
  it('deletes items outright when any is selected', () => {
    expect(deleteIntent(doc(), ['i1'])).toBe('items');
  });

  it('keeps the table and drops the items on a mixed selection', () => {
    expect(deleteIntent(doc(), ['t1', 'i1'])).toBe('items');
  });

  it('asks before deleting exactly one table', () => {
    expect(deleteIntent(doc(), ['t1'])).toBe('table');
  });

  it('does nothing for no selection, or for several tables at once', () => {
    expect(deleteIntent(doc(), [])).toBe('none');
    expect(deleteIntent(doc(), ['t1', 't2'])).toBe('none');
  });
});

describe('editorKeyActions — rotationForKey', () => {
  const at = (deg: number) => tableMovable(tableGeometry({ rotation: deg }));

  it('steps 15° each way', () => {
    expect(rotationForKey(']', false, at(0))).toBe(15);
    expect(rotationForKey('[', false, at(0))).toBe(345);
  });

  it('amplifies to 90° with Shift — the keyboard modifier means "bigger step"', () => {
    expect(rotationForKey(']', true, at(0))).toBe(90);
  });

  it('resets on 0', () => {
    expect(rotationForKey('0', false, at(123))).toBe(0);
  });

  it('claims no other key', () => {
    expect(rotationForKey('r', false, at(0))).toBeNull();
  });
});

describe('editorKeyActions — isFormField', () => {
  it.each(['INPUT', 'TEXTAREA', 'SELECT'])('yields %s its own keys', (tag) => {
    expect(isFormField(document.createElement(tag))).toBe(true);
  });

  it('does not yield the canvas', () => {
    expect(isFormField(document.createElement('div'))).toBe(false);
    expect(isFormField(null)).toBe(false);
  });
});
