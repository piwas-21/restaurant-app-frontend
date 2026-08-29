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

  it('names the input with the LABEL ONLY — the error must not leak into the accessible name', () => {
    // Measured, not assumed: before #598 the error lived inside the <label>, and HTML-AAM's
    // label-content rule made this name "Email Required field". That is why the error moved out.
    render(
      <FormField label="Email" error="Required field">
        <input />
      </FormField>,
    );

    expect(screen.getByRole('textbox')).toHaveAccessibleName('Email');
  });

  it('points the input at the error as a DESCRIPTION when it is failing', () => {
    render(
      <FormField label="Email" error="Required field">
        <input />
      </FormField>,
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // The relationship, not merely the presence of the attribute: the id it names must be the
    // node that carries the message.
    expect(input).toHaveAccessibleDescription('Required field');
    expect(screen.getByRole('alert')).toHaveAttribute('id', input.getAttribute('aria-describedby'));
  });

  it('sets no aria-invalid at all while the field is valid — never an explicit false', () => {
    // An explicit `aria-invalid="false"` is announced by some screen readers as a state worth
    // mentioning on a field nobody has touched. Same rule as the editor's `fieldAria`.
    render(
      <FormField label="Email">
        <input />
      </FormField>,
    );

    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby');
  });

  it('MERGES the error into a describedby the child already had, rather than replacing it', () => {
    // The silent half of this bug: assigning over an existing `aria-describedby` drops the hint
    // and leaves an attribute that is present and points at something real, so nothing looks wrong.
    render(
      <>
        <span id="pw-hint">At least 8 characters</span>
        <FormField label="Password" error="Too short">
          <input aria-describedby="pw-hint" />
        </FormField>
      </>,
    );

    const input = screen.getByRole('textbox');
    expect(input.getAttribute('aria-describedby')).toMatch(/^pw-hint /);
    expect(input).toHaveAccessibleDescription('At least 8 characters Too short');
  });

  it('keeps a child id the caller supplied and points the label at it', () => {
    const { container } = render(
      <FormField label="Email" error="Required field">
        <input id="my-own-id" />
      </FormField>,
    );

    expect(screen.getByRole('textbox')).toHaveAttribute('id', 'my-own-id');
    expect(container.querySelector('label')).toHaveAttribute('for', 'my-own-id');
  });

  it('degrades honestly with two element children: still labelled, but no ARIA guessed', () => {
    // THE CONTROL for the cloning behaviour. With two controls the component cannot know which one
    // is the field, so it applies nothing rather than annotating the wrong node — and every
    // assertion above would still pass for a component that annotated blindly.
    render(
      <FormField label="Price" error="Required field">
        <input />
        <span>CHF</span>
      </FormField>,
    );

    const input = screen.getByRole('textbox');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    // The error still renders and is still announced as an alert.
    expect(screen.getByRole('alert')).toHaveTextContent('Required field');
    // And the SECOND half of the honest limit, measured rather than claimed: the sibling's text is
    // inside the <label>, so the label-content rule folds it into the NAME — this input is called
    // "Price CHF", not "Price". Moving the error out fixed the error's share of that pollution and
    // cannot fix a caller's own extra child. This is the assertion that tells a future reader to
    // give such a field its own id and set the ARIA at the callsite.
    expect(input).toHaveAccessibleName('Price CHF');
  });

  it('does NOT annotate a non-control child — the wrapper-span shape that ships today', () => {
    // THE REGRESSION CONTROL. An earlier draft cloned onto any single element child, so this
    // shape — an input inside a span holding a currency suffix, exactly `QuickAddItemModal`'s
    // price field — got the id and the ARIA on the SPAN and an `htmlFor` aimed at a node a label
    // cannot name. That destroyed the label association on a change made to improve accessibility.
    render(
      <FormField label="Price" error="Required field">
        <span>
          <input />
          <span id="ccy">CHF</span>
        </span>
      </FormField>,
    );

    const input = screen.getByRole('textbox');
    // The label still reaches the input by NESTING, which is what this shape relies on.
    expect(screen.getByLabelText(/Price/)).toBe(input);
    expect(input).not.toHaveAttribute('aria-invalid');
    // And nothing was written onto the wrapper either.
    expect(document.querySelector('span[aria-invalid]')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Required field');
  });
});
