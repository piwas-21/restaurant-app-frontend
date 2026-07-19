import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import OrderTypeToggle from './OrderTypeToggle';

const mockShellSpy = jest.fn();
jest.mock('./OrderTypeToggleShell', () => ({
  __esModule: true,
  default: (props: { styles: Record<string, string>; onPick: unknown }) => {
    mockShellSpy(props);
    return <div data-testid="shell" />;
  },
}));

describe('OrderTypeToggle (classic)', () => {
  it('renders the shared shell with the classic module + forwards onPick', () => {
    const onPick = jest.fn();
    render(<OrderTypeToggle onPick={onPick} />);
    expect(screen.getByTestId('shell')).toBeInTheDocument();
    expect(mockShellSpy).toHaveBeenCalledWith(expect.objectContaining({ onPick, styles: expect.any(Object) }));
  });
});
