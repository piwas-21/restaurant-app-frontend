import { act, renderHook } from '@testing-library/react';
import { useEditorNavigationGuard } from './useEditorNavigationGuard';

describe('useEditorNavigationGuard', () => {
  it('guards an in-app browser Back with the discard confirmation', () => {
    const forward = jest.spyOn(window.history, 'forward').mockImplementation(() => undefined);
    const back = jest.spyOn(window.history, 'back').mockImplementation(() => undefined);
    const { result } = renderHook(() => useEditorNavigationGuard({ isDirty: true, onBack: jest.fn() }));

    act(() => window.dispatchEvent(new PopStateEvent('popstate')));

    expect(forward).toHaveBeenCalledTimes(1);
    expect(result.current.isDiscardOpen).toBe(true);

    act(() => result.current.confirmDiscard());
    expect(back).toHaveBeenCalledTimes(1);
    expect(result.current.isDiscardOpen).toBe(false);

    forward.mockRestore();
    back.mockRestore();
  });

  it('keeps the full-page unload warning for a dirty editor', () => {
    const { unmount } = renderHook(() => useEditorNavigationGuard({ isDirty: true, onBack: jest.fn() }));
    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventDefault = jest.fn();
    Object.defineProperty(event, 'preventDefault', { value: preventDefault });

    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    unmount();
  });

  it('clears a cancelled navigation instead of replaying it later', () => {
    const onBack = jest.fn();
    const forward = jest.spyOn(window.history, 'forward').mockImplementation(() => undefined);
    const { result } = renderHook(() => useEditorNavigationGuard({ isDirty: true, onBack }));

    act(() => window.dispatchEvent(new PopStateEvent('popstate')));
    act(() => result.current.closeDiscard());
    act(() => result.current.confirmDiscard());

    expect(onBack).not.toHaveBeenCalled();
    forward.mockRestore();
  });
});
