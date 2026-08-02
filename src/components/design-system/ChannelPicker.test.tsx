import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ChannelPicker from './ChannelPicker';
import { OrderType } from '@/types/order';
import { ALL_ORDER_TYPES } from '@/utils/orderChannels';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

/**
 * "Which channels is this available on?", asked once. The same question used to be written twice
 * with nothing shared between the two surfaces (E2), so they could drift on channel order, on where
 * the labels came from, and on what a disabled box means.
 */
describe('ChannelPicker', () => {
  it('renders one box per channel, in the shared declaration order', () => {
    // Order is asserted against ALL_ORDER_TYPES rather than a literal list, so a new channel cannot
    // be added to one surface and not the other — which is the drift this component exists to stop.
    render(<ChannelPicker selected={[]} onToggle={jest.fn()} />);

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(ALL_ORDER_TYPES.length);
    expect(boxes.map((b) => b.getAttribute('data-testid'))).toEqual(ALL_ORDER_TYPES.map((t) => `channel-${t}`));
  });

  it('checks exactly the selected channels', () => {
    render(<ChannelPicker selected={[OrderType.Takeaway]} onToggle={jest.fn()} />);

    expect(screen.getByTestId(`channel-${OrderType.Takeaway}`)).toBeChecked();
    expect(screen.getByTestId(`channel-${OrderType.DineIn}`)).not.toBeChecked();
  });

  it('hands the host the channel that was clicked and nothing else', () => {
    // It deliberately does not own the selection: a product round-trips a nullable mask with an
    // inherit mode, a category row round-trips a dirty-tracked list. Folding either rule in here
    // would make the other a special case.
    const onToggle = jest.fn();
    render(<ChannelPicker selected={[]} onToggle={onToggle} />);

    fireEvent.click(screen.getByTestId(`channel-${OrderType.Delivery}`));

    expect(onToggle).toHaveBeenCalledWith(OrderType.Delivery);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('disables every box together', () => {
    render(<ChannelPicker selected={[]} onToggle={jest.fn()} disabled />);

    for (const box of screen.getAllByRole('checkbox')) expect(box).toBeDisabled();
  });

  it('renders the group error ONCE while marking every box invalid', () => {
    render(<ChannelPicker selected={[]} onToggle={jest.fn()} error="Pick at least one" errorId="e1" />);

    expect(screen.getAllByRole('alert')).toHaveLength(1);
    for (const box of screen.getAllByRole('checkbox')) expect(box).toHaveAttribute('aria-invalid', 'true');
  });

  it('points every BOX at the group error, not a wrapper div', () => {
    // The wrapper is role="generic" and is not exposed in the accessibility tree, so describing it
    // describes nothing: a box announced itself "invalid" with no way to hear why. Asserting on the
    // INPUTS is the difference between this test and the vacuous one it replaced.
    render(<ChannelPicker selected={[]} onToggle={jest.fn()} error="Pick at least one" errorId="e1" />);

    for (const box of screen.getAllByRole('checkbox')) {
      expect(box.getAttribute('aria-describedby')).toContain('e1');
    }
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'e1');
  });

  it('names each box with its channel ALONE, not with the group error too', () => {
    render(<ChannelPicker selected={[]} onToggle={jest.fn()} error="Pick at least one" errorId="e1" />);

    expect(screen.getByRole('checkbox', { name: 'Delivery' })).toBeInTheDocument();
  });

  it('omits aria-describedby when the host gave an error but no id to point at', () => {
    render(<ChannelPicker selected={[]} onToggle={jest.fn()} error="Pick at least one" />);

    for (const box of screen.getAllByRole('checkbox')) expect(box).not.toHaveAttribute('aria-describedby');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('renders no error element when there is no error', () => {
    render(<ChannelPicker selected={[]} onToggle={jest.fn()} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
