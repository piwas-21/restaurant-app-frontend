import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import KitchenTypeSelector from './KitchenTypeSelector';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

/**
 * Slice **S8** (D7). This component was a row of `<button>`s carrying a 12-property inline `style`
 * object each, six raw hex values between them, and a `<label>` that pointed at nothing.
 *
 * The tests below pin the two things that fix, in the two ways it can silently come back: the
 * SEMANTICS (a single choice is a radio group, not three buttons) and the STYLING CHANNEL (classes,
 * not a `style` attribute — which is what makes dark mode and the token gates apply at all).
 */
const renderSelector = (props: Partial<React.ComponentProps<typeof KitchenTypeSelector>> = {}) => {
  const onChange = jest.fn();
  render(<KitchenTypeSelector value="FrontKitchen" onChange={onChange} {...props} />);
  return { onChange };
};

describe('KitchenTypeSelector', () => {
  it('is one named radio group of three, not three unrelated buttons', () => {
    renderSelector();

    // The group has a NAME. Three buttons had none, so a screen reader announced three controls
    // with no idea they were alternatives to each other.
    expect(screen.getByRole('group', { name: 'Kitchen Type' })).toBeInTheDocument();

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(3);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('announces which one is selected — the state a button row could not express', () => {
    renderSelector({ value: 'BackKitchen' });

    expect(screen.getByRole('radio', { name: 'Back Kitchen' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Front Kitchen' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Not Assigned' })).not.toBeChecked();
  });

  it('reports the picked value, unchanged', () => {
    const { onChange } = renderSelector();

    fireEvent.click(screen.getByRole('radio', { name: 'Back Kitchen' }));

    expect(onChange).toHaveBeenCalledWith('BackKitchen');
  });

  it('every option is reachable and named — #592’s `label` rule for this control', () => {
    renderSelector();

    for (const name of ['Not Assigned', 'Front Kitchen', 'Back Kitchen']) {
      const radio = screen.getByRole('radio', { name });
      // A label the browser resolves through htmlFor/id, which is what axe checks. The visually
      // hidden input must stay in the tree: `display: none` would take the whole group with it.
      expect(radio).toHaveAttribute('id');
      expect(radio).not.toHaveAttribute('hidden');
    }
  });

  it('carries no inline style at all — the rule the old version broke six times', () => {
    const { container } = render(<KitchenTypeSelector value="None" onChange={jest.fn()} error="Pick one" />);

    // CLAUDE.md §5.5/§5.6: colours come from tokens in a CSS Module, never from a `style`
    // attribute. Asserting the ABSENCE of the attribute is what keeps a "quick fix" from
    // reintroducing a hex, and it is why this test survives a restyle.
    expect(container.querySelectorAll('[style]')).toHaveLength(0);
  });

  it('puts the group-level error on the group, once', () => {
    render(<KitchenTypeSelector value={undefined} onChange={jest.fn()} error="Pick one" />);

    const message = screen.getByRole('alert');
    expect(message).toHaveTextContent('Pick one');
    // Described by the fieldset, not by three radios — otherwise the sentence is read three times.
    expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', message.id);
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).not.toHaveAttribute('aria-describedby');
    }
  });

  it('disables every option together', () => {
    renderSelector({ disabled: true });

    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  });
});
