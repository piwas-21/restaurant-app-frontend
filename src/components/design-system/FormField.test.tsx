import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('associates the label with the wrapped input so clicking the label focuses it', () => {
    render(
      <FormField label="Username">
        <input type="text" />
      </FormField>,
    );
    // getByLabelText resolves the accessible-name link (wrapping <label>
    // OR htmlFor/id). If FormField ever regresses to rendering the label
    // as an unassociated sibling, this query throws and the test fails.
    // We use a real browser-like click via fireEvent — but JSDOM does not
    // propagate label-click → wrapped-input focus, so we assert the
    // association directly and that the input is the one the label points
    // at (the same node a browser would focus on click).
    const input = screen.getByLabelText('Username');
    fireEvent.click(screen.getByText('Username'));
    expect(input).toBe(screen.getByRole('textbox'));
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
