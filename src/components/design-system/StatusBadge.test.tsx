import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import StatusBadge from './StatusBadge';

describe('StatusBadge', () => {
  it('renders children text', () => {
    render(<StatusBadge>Active</StatusBadge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies the neutral tone class by default', () => {
    render(<StatusBadge>Default</StatusBadge>);
    const el = screen.getByText('Default');
    expect(el.className).toContain('neutral');
    expect(el.className).toContain('badge');
  });

  it.each(['success', 'warning', 'danger', 'info', 'neutral'] as const)('applies tone="%s" class', (tone) => {
    render(<StatusBadge tone={tone}>X</StatusBadge>);
    const el = screen.getByText('X');
    expect(el.className).toContain(tone);
  });

  it('appends an extra className when provided', () => {
    render(
      <StatusBadge tone="success" className="extra">
        OK
      </StatusBadge>,
    );
    const el = screen.getByText('OK');
    expect(el.className).toContain('extra');
    expect(el.className).toContain('success');
  });

  it('uses native output semantics when an explicit accessible name is supplied', () => {
    render(
      <StatusBadge tone="success" ariaLabel="Occupied">
        O
      </StatusBadge>,
    );

    const badge = screen.getByLabelText('Occupied');
    expect(badge.tagName).toBe('OUTPUT');
    expect(badge).toHaveClass('badge', 'success');
    expect(badge).toHaveTextContent('O');
  });

  it('preserves generic span semantics for existing visible-label consumers', () => {
    const { container } = render(<StatusBadge>Active</StatusBadge>);
    expect(container.querySelector('span')).not.toHaveAttribute('role');
  });
});
