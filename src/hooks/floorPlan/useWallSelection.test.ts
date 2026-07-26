import { act, renderHook } from '@testing-library/react';
import { useWallSelection } from './useWallSelection';
import { planDocument, planWall } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import { DEFAULT_OPENING_WIDTH_M } from '@/lib/floorPlan/wallOpenings';
import type { FloorPlanDocument, FloorPlanWall } from '@/types/floorPlan';

const DOOR = {
  id: 'o1',
  segmentIndex: 0,
  offsetMeters: 1,
  widthMeters: 1,
  kind: 'door' as const,
  swingDirection: 'in',
};

/** Two rooms; `w1` carries a door so the opening ops have something to act on. */
const DOC = planDocument([], { walls: [planWall({ id: 'w1', openings: [DOOR] }), planWall({ id: 'w2' })] });

function setup(doc: FloorPlanDocument = DOC) {
  const apply = jest.fn();
  const clearMovables = jest.fn();
  const { result } = renderHook(() => useWallSelection({ document: doc, apply, clearMovables }));
  return { result, apply, clearMovables };
}

const applied = (apply: jest.Mock) => apply.mock.calls.at(-1)?.[0] as FloorPlanDocument;
const wall = (apply: jest.Mock, id = 'w1'): FloorPlanWall | undefined => applied(apply).walls.find((w) => w.id === id);

describe('useWallSelection — picking', () => {
  it('holds the id and drops the movable selection, so one subject is live', () => {
    const { result, clearMovables } = setup();
    act(() => result.current.selectWall('w1'));
    expect(result.current.selectedWallId).toBe('w1');
    expect(clearMovables).toHaveBeenCalled();
  });

  it('drops the picked corner when the wall changes — the numbering means nothing there', () => {
    const { result } = setup();
    act(() => result.current.selectWall('w1'));
    act(() => result.current.selectVertex(2));
    act(() => result.current.selectWall('w2'));
    expect(result.current.selectedVertex).toBeNull();
  });

  it('clears back to nothing', () => {
    const { result } = setup();
    act(() => result.current.selectWall('w1'));
    act(() => result.current.selectVertex(1));
    act(() => result.current.clearWall());
    expect(result.current.selectedWallId).toBeNull();
    expect(result.current.selectedVertex).toBeNull();
  });
});

describe('useWallSelection — the wall itself', () => {
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

describe('useWallSelection — corners', () => {
  it('moves one', () => {
    const { result, apply } = setup();
    act(() => result.current.moveVertex('w1', 1, 6, 2));
    expect(wall(apply)?.points[1]).toEqual({ x: 6, y: 2 });
  });

  it('removes one and steps the selection back, so a repeated keypress keeps working', () => {
    const { result, apply } = setup();
    act(() => result.current.selectVertex(2));
    act(() => result.current.deleteVertex('w1', 2));
    expect(wall(apply)?.points).toHaveLength(3);
    expect(result.current.selectedVertex).toBe(1);
  });

  it('clears the selection when the FIRST corner goes — there is none before it', () => {
    const { result } = setup();
    act(() => result.current.deleteVertex('w1', 0));
    expect(result.current.selectedVertex).toBeNull();
  });

  it('refuses a removal that would leave a room with two corners', () => {
    const triangle = planDocument([], {
      walls: [
        planWall({
          id: 'w1',
          points: [
            { x: 1, y: 1 },
            { x: 4, y: 1 },
            { x: 4, y: 4 },
          ],
        }),
      ],
    });
    const { result, apply } = setup(triangle);
    act(() => result.current.deleteVertex('w1', 0));
    expect(apply).not.toHaveBeenCalled();
  });

  it('ignores an unknown wall id rather than writing a document without it', () => {
    const { result, apply } = setup();
    act(() => result.current.moveVertex('gone', 0, 1, 1));
    act(() => result.current.deleteVertex('gone', 0));
    expect(apply).not.toHaveBeenCalled();
  });
});

describe('useWallSelection — openings', () => {
  it('adds one to the named side', () => {
    const { result, apply } = setup();
    act(() => result.current.addOpening('w1', 1, 'window'));
    expect(wall(apply)?.openings).toHaveLength(2);
    expect(wall(apply)?.openings[1]).toMatchObject({
      segmentIndex: 1,
      kind: 'window',
      widthMeters: DEFAULT_OPENING_WIDTH_M.window,
    });
  });

  it('patches one', () => {
    const { result, apply } = setup();
    act(() => result.current.patchOpening('w1', 'o1', { offsetMeters: 2 }));
    expect(wall(apply)?.openings[0].offsetMeters).toBe(2);
  });

  it('removes one', () => {
    const { result, apply } = setup();
    act(() => result.current.deleteOpening('w1', 'o1'));
    expect(wall(apply)?.openings).toEqual([]);
  });

  // The document is only written when something actually changed, so a no-op
  // never lands an empty entry in the undo stack.
  it('writes nothing when the edit changed nothing', () => {
    const { result, apply } = setup();
    act(() => result.current.deleteOpening('w1', 'not-there'));
    act(() => result.current.addOpening('w1', 9, 'door'));
    expect(apply).not.toHaveBeenCalled();
  });
});
