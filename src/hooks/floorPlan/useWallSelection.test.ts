import { act, renderHook } from '@testing-library/react';
import { useWallSelection } from './useWallSelection';
import { planDocument, planWall } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { FloorPlanDocument } from '@/types/floorPlan';

const DOC = planDocument([], { walls: [planWall({ id: 'w1' }), planWall({ id: 'w2' })] });

function setup() {
  const apply = jest.fn();
  const clearMovables = jest.fn();
  const { result } = renderHook(() => useWallSelection({ document: DOC, apply, clearMovables }));
  return { result, apply, clearMovables };
}

const applied = (apply: jest.Mock) => apply.mock.calls.at(-1)?.[0] as FloorPlanDocument;

describe('useWallSelection — picking', () => {
  it('holds the id and drops the movable selection, so one subject is live', () => {
    const { result, clearMovables } = setup();
    act(() => result.current.selectWall('w1'));
    expect(result.current.selectedWallId).toBe('w1');
    expect(clearMovables).toHaveBeenCalled();
  });

  it('clears back to nothing', () => {
    const { result } = setup();
    act(() => result.current.selectWall('w1'));
    act(() => result.current.clearWall());
    expect(result.current.selectedWallId).toBeNull();
  });
});

describe('useWallSelection — editing', () => {
  it('patches the named wall and leaves the others untouched', () => {
    const { result, apply } = setup();
    act(() => result.current.patchWall('w2', { roomName: 'Terrace' }));
    expect(applied(apply).walls).toEqual([DOC.walls[0], { ...DOC.walls[1], roomName: 'Terrace' }]);
  });

  it('deletes the wall and drops the selection with it', () => {
    const { result, apply } = setup();
    act(() => result.current.selectWall('w1'));
    act(() => result.current.deleteWall('w1'));
    expect(applied(apply).walls.map((w) => w.id)).toEqual(['w2']);
    expect(result.current.selectedWallId).toBeNull();
  });
});
