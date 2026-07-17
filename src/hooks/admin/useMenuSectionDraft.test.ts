import { renderHook, act } from '@testing-library/react';
import { useMenuSectionDraft } from './useMenuSectionDraft';
import { MenuSection } from '@/types/menu';
import { stripTemporaryMenuSectionIds } from '@/utils/menuSectionDraft';

const section = (over: Partial<MenuSection> = {}): MenuSection => ({
  id: 'sec-1',
  name: 'Choose a main',
  description: '',
  displayOrder: 0,
  isRequired: true,
  minSelection: 1,
  maxSelection: 1,
  items: [],
  ...over,
});

function setup(commitMode: 'explicit' | 'live' = 'explicit', sections: MenuSection[] = [section()]) {
  const onChange = jest.fn();
  const view = renderHook(({ s }) => useMenuSectionDraft({ sections: s, onChange, commitMode }), {
    initialProps: { s: sections },
  });
  return { ...view, onChange };
}

describe('useMenuSectionDraft — explicit mode (what the bundle modals do)', () => {
  it('holds edits locally until commit', () => {
    const { result, onChange } = setup('explicit');

    act(() => result.current.updateSection(0, { name: 'Renamed' }));

    // The whole point of explicit mode: the parent has not heard about it yet.
    expect(onChange).not.toHaveBeenCalled();
    expect(result.current.localSections[0].name).toBe('Renamed');
    expect(result.current.hasChanges).toBe(true);

    act(() => result.current.commit());
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'Renamed' })]);
    expect(result.current.hasChanges).toBe(false);
  });

  it('reset discards the draft without telling the parent', () => {
    const { result, onChange } = setup('explicit');

    act(() => result.current.updateSection(0, { name: 'Renamed' }));
    act(() => result.current.reset());

    expect(result.current.localSections[0].name).toBe('Choose a main');
    expect(result.current.hasChanges).toBe(false);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('useMenuSectionDraft — live mode (what the editor page needs)', () => {
  it('propagates every mutation immediately', () => {
    const { result, onChange } = setup('live');

    act(() => result.current.updateSection(0, { name: 'Renamed' }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ name: 'Renamed' })]);
  });

  it('never reports pending changes, so no second Save can appear', () => {
    // The page owns the only Save (owner call). A nested Save/Cancel pair renders on
    // `hasChanges`, so live mode must never raise it — two competing commit points on
    // one screen is exactly what this mode exists to prevent.
    const { result } = setup('live');

    act(() => result.current.updateSection(0, { name: 'Renamed' }));

    expect(result.current.hasChanges).toBe(false);
  });

  it('propagates adds and removes too, not just field edits', () => {
    const { result, onChange } = setup('live');

    act(() => result.current.addSection());
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ name: '' }), expect.anything()]);

    act(() => result.current.confirmRemoveSection(0));
    act(() => result.current.handleRemoveSection());
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'Choose a main' })]);
  });
});

describe('useMenuSectionDraft — behaviour preserved from MenuSectionEditor', () => {
  it('adds a new section at the top and pushes the others down', () => {
    const { result } = setup('explicit', [section({ id: 'a', displayOrder: 0 })]);

    act(() => result.current.addSection());

    expect(result.current.localSections).toHaveLength(2);
    expect(result.current.localSections[0].displayOrder).toBe(0);
    expect(result.current.localSections[1].displayOrder).toBe(1);
  });

  it('mints a temp- id that the submit transform later strips', () => {
    const { result } = setup('explicit', []);

    act(() => result.current.addSection());
    const draftId = result.current.localSections[0].id;

    expect(draftId).toMatch(/^temp-/);
    // Pins the seam with slice 7 PR1: a temp id must not reach the server as an id.
    expect(stripTemporaryMenuSectionIds(result.current.localSections)[0].id).toBeUndefined();
  });

  it('moveSection swaps neighbours and renumbers displayOrder', () => {
    const { result } = setup('explicit', [
      section({ id: 'a', name: 'A', displayOrder: 0 }),
      section({ id: 'b', name: 'B', displayOrder: 1 }),
    ]);

    act(() => result.current.moveSection(1, 'up'));

    expect(result.current.localSections.map((s) => s.name)).toEqual(['B', 'A']);
    expect(result.current.localSections.map((s) => s.displayOrder)).toEqual([0, 1]);
  });

  it('moveSection is a no-op at the edges', () => {
    const { result } = setup('explicit', [section({ id: 'a', name: 'A' }), section({ id: 'b', name: 'B' })]);

    act(() => result.current.moveSection(0, 'up'));
    act(() => result.current.moveSection(1, 'down'));

    expect(result.current.localSections.map((s) => s.name)).toEqual(['A', 'B']);
    expect(result.current.hasChanges).toBe(false);
  });

  it('resyncs when the sections prop changes', () => {
    const { result, rerender } = setup('explicit', [section({ name: 'First' })]);

    act(() => result.current.updateSection(0, { name: 'Dirty' }));
    rerender({ s: [section({ name: 'Second' })] });

    expect(result.current.localSections[0].name).toBe('Second');
    expect(result.current.hasChanges).toBe(false);
  });

  it('toggleSection opens and closes a row', () => {
    const { result } = setup('explicit');

    act(() => result.current.toggleSection('sec-1'));
    expect(result.current.expandedSections.has('sec-1')).toBe(true);

    act(() => result.current.toggleSection('sec-1'));
    expect(result.current.expandedSections.has('sec-1')).toBe(false);
  });

  it('a delete is staged behind a confirm, and cancelling keeps the section', () => {
    const { result } = setup('explicit');

    act(() => result.current.confirmRemoveSection(0));
    expect(result.current.sectionToDelete).toBe(0);

    act(() => result.current.cancelRemoveSection());
    expect(result.current.sectionToDelete).toBeNull();
    expect(result.current.localSections).toHaveLength(1);
  });
});
