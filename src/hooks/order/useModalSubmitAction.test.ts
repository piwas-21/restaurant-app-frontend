import { act, renderHook } from '@testing-library/react';
import { useModalSubmitAction } from './useModalSubmitAction';

it('submits once for rapid taps and marks the modal pending until completion', async () => {
  let finish!: (value: string) => void;
  const collect = jest.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const confirm = jest.fn();
  const { result } = renderHook(() => useModalSubmitAction(true, collect, confirm));
  let submission!: Promise<void>;
  act(() => {
    submission = result.current.submit();
    void result.current.submit();
  });
  expect(result.current.isSubmitting).toBe(true);
  expect(collect).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish('saved');
    await submission;
  });
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(confirm).toHaveBeenCalledWith('saved');
  expect(result.current.isSubmitting).toBe(false);
});

it('a forced close and reopened modal cannot accept the old opening’s response', async () => {
  let finish!: (value: string) => void;
  const collect = jest.fn(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const confirm = jest.fn();
  const { result, rerender } = renderHook(({ isOpen }) => useModalSubmitAction(isOpen, collect, confirm), {
    initialProps: { isOpen: true },
  });
  let submission!: Promise<void>;
  act(() => {
    submission = result.current.submit();
  });
  rerender({ isOpen: false });
  rerender({ isOpen: true });
  await act(async () => {
    finish('old values');
    await submission;
  });
  expect(confirm).not.toHaveBeenCalled();
  expect(result.current.isSubmitting).toBe(false);
});

it('validation failure leaves the form available for a successful retry', async () => {
  const collect = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce('valid');
  const confirm = jest.fn();
  const { result } = renderHook(() => useModalSubmitAction(true, collect, confirm));
  await act(async () => result.current.submit());
  expect(confirm).not.toHaveBeenCalled();
  expect(result.current.isSubmitting).toBe(false);
  await act(async () => result.current.submit());
  expect(confirm).toHaveBeenCalledWith('valid');
});

it('an unmounted form cannot confirm its save', async () => {
  let finish!: (value: string) => void;
  const collect = () =>
    new Promise<string>((resolve) => {
      finish = resolve;
    });
  const confirm = jest.fn();
  const { result, unmount } = renderHook(() => useModalSubmitAction(true, collect, confirm));
  let submission!: Promise<void>;
  act(() => {
    submission = result.current.submit();
  });
  unmount();
  await act(async () => {
    finish('saved');
    await submission;
  });
  expect(confirm).not.toHaveBeenCalled();
});

it('surfaces a failed save and clears the message when retried', async () => {
  const collect = jest.fn().mockRejectedValueOnce(new Error('Could not save details')).mockResolvedValueOnce('saved');
  const confirm = jest.fn();
  const { result } = renderHook(() => useModalSubmitAction(true, collect, confirm));
  await act(async () => result.current.submit());
  expect(result.current.errorMessage).toBeTruthy();
  expect(confirm).not.toHaveBeenCalled();
  expect(result.current.isSubmitting).toBe(false);
  await act(async () => result.current.submit());
  expect(result.current.errorMessage).toBeNull();
  expect(confirm).toHaveBeenCalledWith('saved');
});
