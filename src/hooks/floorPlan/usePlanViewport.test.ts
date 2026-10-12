import { act, renderHook } from '@testing-library/react';
import type { PointerEvent, MouseEvent } from 'react';
import { usePlanViewport } from './usePlanViewport';

function stage() {
  const element = document.createElement('div');
  element.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 500,
    width: 1000,
    height: 500,
    toJSON: () => ({}),
  });
  element.setPointerCapture = jest.fn();
  return element;
}
const pointer = (target: HTMLElement, id: number, x: number, y = 250) =>
  ({ target, pointerId: id, clientX: x, clientY: y }) as unknown as PointerEvent<HTMLDivElement>;

it('pans with the uniform SVG scale on a wide, letterboxed tablet stage', () => {
  const { result } = renderHook(() => usePlanViewport(12, 8));
  const element = stage();
  act(() => {
    result.current.stageRef.current = element;
    result.current.zoomIn();
  });
  // 8m + 40cm padding, zoomed by 1.4 => 600cm visible at 500px: 50px means 60cm.
  const before = result.current.viewBox.x;
  act(() => result.current.stageHandlers.onPointerDown(pointer(element, 1, 300)));
  act(() => result.current.stageHandlers.onPointerMove(pointer(element, 1, 350)));
  expect(result.current.viewBox.x).toBeCloseTo(before - 60);
});

it('pinches on the first movement and suppresses accidental table selection after the gesture', () => {
  const { result } = renderHook(() => usePlanViewport(12, 8));
  const element = stage();
  act(() => {
    result.current.stageRef.current = element;
  });
  act(() => result.current.stageHandlers.onPointerDown(pointer(element, 1, 100)));
  act(() => result.current.stageHandlers.onPointerDown(pointer(element, 2, 200)));
  act(() => result.current.stageHandlers.onPointerMove(pointer(element, 2, 300)));
  expect(result.current.viewBox.w).toBeCloseTo(620);
  const click = { preventDefault: jest.fn(), stopPropagation: jest.fn() };
  act(() => result.current.stageHandlers.onClickCapture(click as unknown as MouseEvent<HTMLDivElement>));
  expect(click.preventDefault).toHaveBeenCalledTimes(1);
  act(() => result.current.stageHandlers.onPointerCancel(pointer(element, 1, 100)));
  act(() => result.current.stageHandlers.onPointerCancel(pointer(element, 2, 300)));
  const before = result.current.viewBox;
  act(() => result.current.stageHandlers.onPointerMove(pointer(element, 2, 500)));
  expect(result.current.viewBox).toEqual(before);
});
