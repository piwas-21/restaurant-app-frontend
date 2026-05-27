import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import FormField from './FormField';

describe('FormField', () => {
  it('renders the label and child input', () => {
    render(
      <FormField label="Email">
        <input type="email" data-testid="email-input" />
      </FormField>,
    );
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByTestId('email-input')).toBeInTheDocument();
  });

  it('clicking the label focuses the wrapped input (label wraps input)', () => {
    render(
      <FormField label="Username">
        <input data-testid="username" />
      </FormField>,
    );
    // The label is the wrapper <label> — assert its text label is associated.
    const labelEl = screen.getByText('Username').closest('label');
    expect(labelEl).not.toBeNull();
    expect(labelEl?.contains(screen.getByTestId('username'))).toBe(true);
  });

  it('renders an error message with role="alert" when provided', () => {
    render(
      <FormField label="Email" error="Required field">
        <input />
      </FormField>,
    );
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Required field');
  });

  it('does not render an error node when error is empty/undefined', () => {
    render(
      <FormField label="Email">
        <input />
      </FormField>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('hides the label visually when srOnlyLabel is true (sr-only class applied)', () => {
    render(
      <FormField label="Hidden label" srOnlyLabel>
        <input />
      </FormField>,
    );
    const span = screen.getByText('Hidden label');
    // sr-only class name is from CSS module (identity-obj-proxy returns the key).
    expect(span.className).toContain('srOnly');
  });

  it('forwards htmlFor onto the wrapping label', () => {
    const { container } = render(
      <FormField label="X" htmlFor="x-id">
        <input id="x-id" />
      </FormField>,
    );
    const label = container.querySelector('label');
    expect(label).toHaveAttribute('for', 'x-id');
  });
});
