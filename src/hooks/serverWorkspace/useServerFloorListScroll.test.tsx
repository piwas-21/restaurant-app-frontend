import { act, fireEvent, render, screen } from '@testing-library/react';
import { useServerFloorListScroll } from './useServerFloorListScroll';

function ScrollHarness({ onPersist }: Readonly<{ onPersist: (scrollTop: number) => void }>) {
  const listRef = useServerFloorListScroll('list', 0, onPersist);
  return <div data-testid="list" ref={listRef} />;
}

describe('useServerFloorListScroll', () => {
  it('coalesces rapid scroll events and persists the latest position after the throttle window', () => {
    jest.useFakeTimers();
    const onPersist = jest.fn();
    render(<ScrollHarness onPersist={onPersist} />);
    const list = screen.getByTestId('list');

    Object.defineProperty(list, 'scrollTop', { configurable: true, value: 80, writable: true });
    fireEvent.scroll(list);
    Object.defineProperty(list, 'scrollTop', { configurable: true, value: 240, writable: true });
    fireEvent.scroll(list);

    expect(onPersist).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(119));
    expect(onPersist).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onPersist).toHaveBeenCalledTimes(1);
    expect(onPersist).toHaveBeenCalledWith(240);

    jest.useRealTimers();
  });
});
