import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import CraftOrderTypeToggle from './CraftOrderTypeToggle';

const mockShellSpy = jest.fn();
jest.mock('@/components/order/OrderTypeToggleShell', () => ({
  __esModule: true,
  default: (props: { styles: Record<string, string>; onPick: unknown }) => {
    mockShellSpy(props);
    return <div data-testid="shell" />;
  },
}));

describe('CraftOrderTypeToggle', () => {
  it('wraps the shared shell with the craft chip module + forwards onPick', () => {
    const onPick = jest.fn();
    render(<CraftOrderTypeToggle onPick={onPick} />);
    expect(screen.getByTestId('shell')).toBeInTheDocument();
    expect(mockShellSpy).toHaveBeenCalledWith(expect.objectContaining({ onPick, styles: expect.any(Object) }));
  });
});
