import { act, renderHook } from '@testing-library/react';
import { useNotificationSoundRepeat } from './useNotificationSoundRepeat';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
it.each(['mousemove', 'pointerdown', 'keydown'])('stops an active repeat on %s', (event) => {
  const play = jest.fn();
  const view = renderHook(() => useNotificationSoundRepeat(true, true, 'chime', play));
  act(() => view.result.current.startRepeatingUntilMouseMoves());
  act(() => jest.advanceTimersByTime(5000));
  expect(play.mock.calls.length).toBeGreaterThan(1);
  act(() => document.dispatchEvent(new Event(event)));
  const stopped = play.mock.calls.length;
  act(() => jest.advanceTimersByTime(10000));
  expect(play).toHaveBeenCalledTimes(stopped);
  expect(jest.getTimerCount()).toBe(0);
});
it('stops when disabled and does not restart while disabled', () => {
  const play = jest.fn();
  const view = renderHook(({ enabled }) => useNotificationSoundRepeat(enabled, true, 'bell', play), {
    initialProps: { enabled: true },
  });
  act(() => view.result.current.startRepeatingUntilMouseMoves());
  view.rerender({ enabled: false });
  act(() => view.result.current.startRepeatingUntilMouseMoves());
  act(() => jest.advanceTimersByTime(10000));
  expect(play).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
it('clears repeating work on unmount', () => {
  const play = jest.fn();
  const view = renderHook(() => useNotificationSoundRepeat(true, true, 'alert', play));
  act(() => view.result.current.startRepeatingUntilMouseMoves());
  view.unmount();
  act(() => jest.advanceTimersByTime(10000));
  expect(play).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
