import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Switch from './Switch';

const CSS_SOURCE = readFileSync(join(__dirname, 'Switch.module.css'), 'utf8');
/* Comments out: they NAME the things these assertions forbid ("no raw hex", "never
   prefers-color-scheme"), so scanning them would make every rule pass on its own prose. */
const CSS = CSS_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');

function Controlled({ disabled }: { readonly disabled?: boolean }) {
  const [checked, setChecked] = useState(false);
  return (
    <Switch
      label="Active"
      checked={checked}
      disabled={disabled}
      onChange={(event) => setChecked(event.target.checked)}
    />
  );
}

describe('Switch — semantics (frontend #575)', () => {
  it('is a switch, not a checkbox, and carries its label as its accessible name', () => {
    render(<Switch label="Available today" checked={false} onChange={() => {}} />);

    expect(screen.queryByRole('checkbox')).toBeNull();
    const control = screen.getByRole('switch', { name: 'Available today' });
    expect(control).toHaveAttribute('type', 'checkbox');
    expect(control).not.toBeChecked();
  });

  it('reports checked and disabled through the input, not through a class', () => {
    const { rerender } = render(<Switch label="Active" checked onChange={() => {}} />);
    expect(screen.getByRole('switch')).toBeChecked();

    rerender(<Switch label="Active" checked disabled onChange={() => {}} />);
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('describes itself with the description line rather than swallowing it into the name', () => {
    render(
      <Switch
        label="Special of the day"
        description="Shown first on the guest menu"
        checked={false}
        onChange={() => {}}
      />,
    );

    // Name is the LABEL only. A description inside the <label> would be read twice — once as the
    // name, once as the description (the trap `CheckboxField` documents).
    const control = screen.getByRole('switch', { name: 'Special of the day' });
    expect(control).toHaveAccessibleDescription('Shown first on the guest menu');
  });

  /**
   * A switch in a table row is named by its COLUMN HEADER, so repeating the word on every row is
   * noise the approved screen does not draw. The label may leave the SCREEN; it may never leave the
   * accessibility tree — that is the whole difference between `srOnlyLabel` and no label at all.
   */
  it('keeps the accessible name when the label is visually hidden', () => {
    render(<Switch label="Optional" srOnlyLabel checked={false} onChange={() => {}} />);

    expect(screen.getByRole('switch', { name: 'Optional' })).toBeInTheDocument();
    expect(screen.getByText('Optional')).toHaveClass('text');
    expect(screen.getByText('Optional').parentElement).toHaveClass('sr-only');
  });

  it('forwards its ref to the input, which is what react-hook-form register() needs', () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Switch label="Active" ref={ref} checked={false} onChange={() => {}} />);

    expect(ref.current).toBe(screen.getByRole('switch'));
  });
});

describe('Switch — keyboard and pointer (frontend #575)', () => {
  /*
   * jsdom implements no keyboard ACTIVATION for form controls: Space on a focused checkbox toggles
   * it in every browser and in none of jsdom, and `@testing-library/user-event` (which emulates it)
   * is not a dependency of this repo. Adding one to assert a behaviour we did not write would be
   * the wrong trade, so the claim under test is the one that is actually true and actually
   * load-bearing: the switch IS a native checkbox, focusable and un-overridden, so the platform's
   * keyboard contract applies to it. A painted <div> would pass none of these.
   */
  it('is a focusable native control with no tabIndex override', () => {
    render(<Controlled />);
    const control = screen.getByRole('switch');

    expect(control.tagName).toBe('INPUT');
    expect(control).not.toHaveAttribute('tabindex');
    control.focus();
    expect(control).toHaveFocus();
  });

  it('toggles on activation — the same event Space fires on a focused checkbox', () => {
    render(<Controlled />);
    const control = screen.getByRole('switch');

    fireEvent.click(control);
    expect(control).toBeChecked();

    fireEvent.click(control);
    expect(control).not.toBeChecked();
  });

  it('toggles when the visible label is clicked', () => {
    render(<Controlled />);

    fireEvent.click(screen.getByText('Active'));
    expect(screen.getByRole('switch')).toBeChecked();
  });

  // No `fireEvent.click` here on purpose: jsdom dispatches the event straight at the element and
  // runs the activation behaviour anyway, so a disabled input toggles in jsdom and in no browser.
  // The assertion that is true in both is that the control reports itself disabled and refuses focus.
  it('refuses focus when disabled, and says so', () => {
    render(<Controlled disabled />);
    const control = screen.getByRole('switch');

    expect(control).toBeDisabled();
    control.focus();
    expect(control).not.toHaveFocus();
  });
});

/*
 * The skin is a CSS-contract assertion for the same reason `EditorShell`'s reflow is: jsdom
 * computes no layout and `identity-obj-proxy` leaves a render nothing but class names, so "the
 * target is big enough" and "dark mode is wired the house way" are not observable from the tree.
 * House pattern: `design-system/modalChrome.test.ts`.
 */
describe('Switch — the skin the design system requires', () => {
  it('gives the input itself a target of at least 24x24 CSS px', () => {
    // The control box is 44x24 and the input covers it (inset: 0; width/height: 100%), so the
    // INPUT is the target — not the label it used to borrow one from.
    expect(CSS).toMatch(/\.control\s*\{[^}]*width:\s*2\.75rem/);
    expect(CSS).toMatch(/\.control\s*\{[^}]*height:\s*1\.5rem/);
    expect(CSS).toMatch(/\.input\s*\{[^}]*inset:\s*0/);
    expect(CSS).toMatch(/\.input\s*\{[^}]*width:\s*100%/);
    // `display: none` or a zero-sized input would take the control out of the hit test entirely.
    expect(CSS).not.toMatch(/\.input\s*\{[^}]*display:\s*none/);
  });

  it('paints on/off and focus from tokens, with no raw hex anywhere', () => {
    expect(CSS).toMatch(/\.input:checked \+ \.track\s*\{[^}]*background:\s*var\(--brand-primary\)/);
    expect(CSS).toMatch(/\.input:focus-visible \+ \.track\s*\{[^}]*outline:/);
    expect(CSS).toMatch(/\.input:disabled \+ \.track\s*\{/);
    expect(CSS.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  it('does dark mode by the theme attribute, never by prefers-color-scheme', () => {
    expect(CSS).toContain("html[data-theme='dark'] .track");
    expect(CSS).not.toContain('prefers-color-scheme');
  });
});
