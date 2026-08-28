import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EditorErrorSummary from './EditorErrorSummary';

/**
 * The save bar's error chip (D13 / S7; conformance gap G4).
 *
 * The count and the copy are the caller's — the chip is deliberately dumb, because the sentence
 * needs an interpolated count and this component has no business knowing which of the ten locale
 * bundles it is in.
 */
describe('EditorErrorSummary — how many, and where the first one is', () => {
  it('draws nothing while the form is valid', () => {
    render(<EditorErrorSummary count={0} label="unused" onJump={jest.fn()} />);

    expect(screen.queryByTestId('editor-error-summary')).not.toBeInTheDocument();
  });

  // The region has to EXIST before the first error does. A live region inserted at the same moment
  // as its content is not reliably announced — the assistive tech has nothing to observe.
  it('keeps its live region mounted at zero', () => {
    render(<EditorErrorSummary count={0} label="unused" onJump={jest.fn()} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders the caller’s sentence and jumps when pressed', () => {
    const onJump = jest.fn();
    render(<EditorErrorSummary count={2} label="Fields to fix: 2 — jump to first" onJump={onJump} />);

    const chip = screen.getByTestId('editor-error-summary');
    expect(chip).toHaveTextContent('Fields to fix: 2 — jump to first');

    fireEvent.click(chip);

    expect(onJump).toHaveBeenCalledTimes(1);
  });

  // It lives in the save bar, which is a sibling of the form and submits it through the `form`
  // attribute — an untyped button there would default to `type="submit"` and save the very form
  // it is reporting errors for.
  it('is a button that does not submit', () => {
    render(<EditorErrorSummary count={1} label="x" onJump={jest.fn()} />);

    expect(screen.getByTestId('editor-error-summary')).toHaveAttribute('type', 'button');
  });
});
