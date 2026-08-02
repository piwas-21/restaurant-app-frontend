import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CheckboxField from './CheckboxField';

/**
 * The primitive that was missing (BUGS-IMPROVEMENTS-PLAN E2). `FormField` puts the label ABOVE the
 * input, which is wrong for a checkbox, so every checkbox in the app was a raw `<input>` — and the
 * two order-type surfaces therefore had nothing consistent to be.
 */
describe('CheckboxField', () => {
  it('associates label and input WITHOUT an id, so clicking the label toggles the box', () => {
    // The whole point of nesting the input inside the label: no id to generate, none to collide,
    // and the click target is the label rather than a 13px box.
    const onChange = jest.fn();
    render(<CheckboxField label="Delivery" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByText('Delivery'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reports the CHECKED state to the handler, not just that a click happened', () => {
    const onChange = jest.fn();
    render(<CheckboxField label="Delivery" checked onChange={onChange} />);

    fireEvent.click(screen.getByRole('checkbox'));

    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('keeps a visually-hidden label in the accessible name', () => {
    // The table-cell case: the column header carries the meaning on screen, but a screen reader
    // landing on the control still has to know what it toggles.
    render(<CheckboxField srOnlyLabel label="Starters available for Delivery" checked={false} onChange={jest.fn()} />);

    expect(screen.getByRole('checkbox', { name: 'Starters available for Delivery' })).toBeInTheDocument();
  });

  it('wires an error to the input via aria-describedby and marks it invalid', () => {
    render(<CheckboxField label="Delivery" checked={false} onChange={jest.fn()} error="Pick at least one" />);

    const box = screen.getByRole('checkbox');
    const message = screen.getByRole('alert');
    expect(box).toHaveAttribute('aria-invalid', 'true');
    expect(box.getAttribute('aria-describedby')).toContain(message.id);
  });

  it('marks the box invalid with NO message of its own when the failure belongs to the group', () => {
    // `invalid` exists because "pick at least one" is a property of the SET: every box has to
    // report itself invalid while the sentence is rendered once, beside the group.
    render(<CheckboxField label="Delivery" checked={false} onChange={jest.fn()} invalid />);

    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('describes the box with BOTH the description and the error, description first', () => {
    render(
      <CheckboxField
        label="Delivery"
        checked={false}
        onChange={jest.fn()}
        description="Inherited from the category"
        error="Pick at least one"
      />,
    );

    const describedBy = screen.getByRole('checkbox').getAttribute('aria-describedby') ?? '';
    const [first, second] = describedBy.split(' ');
    expect(document.getElementById(first)).toHaveTextContent('Inherited from the category');
    expect(document.getElementById(second)).toHaveTextContent('Pick at least one');
  });

  it('sets no aria-describedby at all when there is nothing to describe', () => {
    // An empty `aria-describedby` is not inert — it points at nothing and some readers announce it.
    render(<CheckboxField label="Delivery" checked={false} onChange={jest.fn()} />);

    expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-describedby');
  });

  it('disables the input and takes the host stylesheet when one is passed', () => {
    const styles = {
      field: 'host-field',
      control: 'host-control',
      disabled: 'host-disabled',
      input: 'host-input',
      label: 'host-label',
    };
    render(<CheckboxField label="Delivery" checked={false} onChange={jest.fn()} disabled styles={styles} />);

    const box = screen.getByRole('checkbox');
    expect(box).toBeDisabled();
    expect(box).toHaveClass('host-input');
    expect(box.closest('label')).toHaveClass('host-control');
    expect(box.closest('div')).toHaveClass('host-field', 'host-disabled');
  });

  /**
   * The boundary that makes the rest of this component safe. HTML-AAM's label-content rule folds
   * EVERY text node inside a wrapping `<label>` into the accessible name — so a description and an
   * error rendered in there gave the box the name
   * "Delivery Inherited from the category Pick at least one", announced once as the name and again
   * as the description. Measured with the same computation RTL uses.
   */
  it('keeps the description and the error OUT of the accessible name', () => {
    render(
      <CheckboxField
        label="Delivery"
        checked={false}
        onChange={jest.fn()}
        description="Inherited from the category"
        error="Pick at least one"
      />,
    );

    // `getByRole` matches on the computed accessible name, so an exact match IS the assertion.
    expect(screen.getByRole('checkbox', { name: 'Delivery' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Inherited from the category/ })).not.toBeInTheDocument();
  });

  it('merges a host-supplied describedBy ahead of its own ids', () => {
    // A group-level error lives outside this component; it still has to reach the INPUT, because a
    // wrapper div is role="generic" and is not exposed at all.
    render(
      <CheckboxField label="Delivery" checked={false} onChange={jest.fn()} describedBy="group-error" error="Bad" />,
    );

    const ids = (screen.getByRole('checkbox').getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids[0]).toBe('group-error');
    expect(ids).toHaveLength(2);
  });
});
