import { act, renderHook, waitFor } from '@testing-library/react';
import { useDeliveryChannelStep } from './useDeliveryChannelStep';

describe('useDeliveryChannelStep', () => {
  it('auto-advances after connection but preserves an intentional return to Connect', async () => {
    const { result, rerender } = renderHook(({ connected }) => useDeliveryChannelStep(connected), {
      initialProps: { connected: false },
    });

    expect(result.current.activeStep).toBe('connect');
    rerender({ connected: true });
    await waitFor(() => expect(result.current.activeStep).toBe('menu'));

    act(() => result.current.setActiveStep('connect'));
    rerender({ connected: true });
    expect(result.current.activeStep).toBe('connect');
  });

  it('returns to Connect when the confirmed connection is lost', () => {
    const { result, rerender } = renderHook(({ connected }) => useDeliveryChannelStep(connected), {
      initialProps: { connected: true },
    });
    expect(result.current.activeStep).toBe('menu');

    rerender({ connected: false });
    expect(result.current.activeStep).toBe('connect');
  });
});
