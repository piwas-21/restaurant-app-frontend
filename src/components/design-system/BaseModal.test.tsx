import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import BaseModal from './BaseModal';
import modalStyles from './BaseModal.module.css';

// Stub react-i18next so the t() fallback ("Close") is returned without
// requiring the i18next provider in the test tree.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('BaseModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <BaseModal isOpen={false} onClose={() => {}} title="Hidden">
        <p>body</p>
      </BaseModal>,
    );
    expect(container.firstChild).toBeNull();
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders title, body, and footer when isOpen is true', () => {
    render(
      <BaseModal isOpen onClose={() => {}} title="My title" footer={<button>OK</button>}>
        <p>Body content</p>
      </BaseModal>,
    );
    expect(screen.getByText('My title')).toBeInTheDocument();
    expect(screen.getByText('Body content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('uses native dialog semantics with an accessible title', () => {
    render(
      <BaseModal isOpen onClose={() => {}} title="A11y title">
        <p>body</p>
      </BaseModal>,
    );
    // getByRole with `name` resolves the accessible name via aria-labelledby,
    // so this implicitly verifies the title element is correctly linked.
    const dialog = screen.getByRole('dialog', { name: /a11y title/i });
    expect(dialog.tagName).toBe('DIALOG');
    expect(dialog).toHaveAttribute('open');
    expect(dialog).toHaveAttribute('aria-labelledby');
  });

  it('invokes onClose when the X button is clicked', () => {
    const onClose = jest.fn();
    render(
      <BaseModal isOpen onClose={onClose} title="t">
        <p>body</p>
      </BaseModal>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose from the native backdrop button without nesting the dialog in it', () => {
    const onClose = jest.fn();
    render(
      <BaseModal isOpen onClose={onClose} title="t">
        <button>Body action</button>
      </BaseModal>,
    );

    const backdrop = screen.getByRole('button', { name: 'Dismiss' });
    const dialog = screen.getByRole('dialog');
    expect(backdrop).not.toContainElement(dialog);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('invokes onClose on Escape keydown by default', () => {
    const onClose = jest.fn();
    render(
      <BaseModal isOpen onClose={onClose} title="t">
        <p>body</p>
      </BaseModal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT invoke onClose on Escape when disableEscapeClose is set', () => {
    const onClose = jest.fn();
    render(
      <BaseModal isOpen onClose={onClose} title="t" disableEscapeClose>
        <p>body</p>
      </BaseModal>,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('moves focus into the dialog and returns it to the invoking control on close', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open payment';
    document.body.appendChild(trigger);
    trigger.focus();

    const { rerender } = render(
      <BaseModal isOpen onClose={() => {}} title="Payment">
        <button>Record payment</button>
      </BaseModal>,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();

    rerender(
      <BaseModal isOpen={false} onClose={() => {}} title="Payment">
        <button>Record payment</button>
      </BaseModal>,
    );
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('keeps Tab and Shift+Tab within the dialog controls', () => {
    render(
      <BaseModal isOpen onClose={() => {}} title="Payment" footer={<button>Confirm</button>}>
        <button>Amount</button>
      </BaseModal>,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });

    confirm.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    expect(confirm).toHaveFocus();

    const background = document.createElement('button');
    document.body.appendChild(background);
    background.focus();
    fireEvent.keyDown(window, { key: 'Tab' });
    expect(close).toHaveFocus();
    background.remove();
  });

  it('keeps Escape ownership with the top-most nested modal', () => {
    const parentClose = jest.fn();
    const childClose = jest.fn();
    render(
      <BaseModal isOpen onClose={parentClose} title="Parent">
        <BaseModal isOpen onClose={childClose} title="Child">
          <button>Child action</button>
        </BaseModal>
      </BaseModal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(childClose).toHaveBeenCalledTimes(1);
    expect(parentClose).not.toHaveBeenCalled();
  });

  it('consumes the mapped close and responsive-sheet classes in the DOM', () => {
    render(
      <BaseModal isOpen onClose={() => {}} title="Soup" presentation="responsive-sheet">
        <p>Modifiers</p>
      </BaseModal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Soup' });
    expect(dialog).toHaveClass(modalStyles.dialog, modalStyles.responsiveSheetDialog);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass(
      modalStyles.overlay,
      modalStyles.responsiveSheetOverlay,
    );
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass(modalStyles.closeButton);
  });

  it('does not allow a pending action to be dismissed', () => {
    const onClose = jest.fn();
    render(
      <BaseModal isOpen onClose={onClose} title="Recording payment" isPending>
        <p>Waiting for the till</p>
      </BaseModal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies the size class (e.g. size_lg)', () => {
    render(
      <BaseModal isOpen onClose={() => {}} title="t" size="lg">
        <p>body</p>
      </BaseModal>,
    );
    expect(screen.getByRole('dialog').className).toContain('size_lg');
  });

  it('defaults size to "md"', () => {
    render(
      <BaseModal isOpen onClose={() => {}} title="t">
        <p>body</p>
      </BaseModal>,
    );
    expect(screen.getByRole('dialog').className).toContain('size_md');
  });

  // Regression ratchet (2026-09-18, mcdoner/staging): the docked phone sheet is an auto-height
  // flex column with an `overflow-y: auto` body, and an overflow child contributes nothing to a
  // container's intrinsic size — so WebKit on real iOS Safari can settle the sheet at
  // header + footer + a ~90px scrolling strip. jsdom cannot see layout, so this pins the SOURCE
  // the fix lives in: the docked dialog carries a definite `block-size`, which removes the
  // auto-height resolution no engine can get wrong. Verified in WebKit against staging: a 260px
  // collapse sim showed a 90px body over 444px of content; with the definite height the sheet
  // renders at 760px with everything visible.
  it('sizes the docked phone sheet with a definite block-size, not only a max cap', () => {
    const css = readFileSync(join(__dirname, 'BaseModal.module.css'), 'utf8');
    const docked = css.slice(css.indexOf('.responsiveSheetDialog'), css.indexOf('@media (prefers-reduced-motion'));
    expect(docked).toMatch(/block-size:\s*90dvh/);
    expect(docked).toMatch(/max-block-size:\s*90dvh/);
  });

  // The other half of the 2026-09-18 collapse: `.body` used the `flex: 1` shorthand — basis 0% —
  // and an overflow child with a 0% basis contributes nothing to an auto-height flex column, so
  // WebKit settled CENTERED dialogs at header + footer + a strip too (basket, change-order-type).
  // Basis auto puts the body's content back into the container's intrinsic sizing. Layout is
  // invisible to jsdom; this pins the source like the docked-height ratchet above.
  it('sizes the scrollable body with flex-basis auto so auto-height dialogs grow to their content', () => {
    const css = readFileSync(join(__dirname, 'BaseModal.module.css'), 'utf8');
    const body = css.slice(css.indexOf('.body {'), css.indexOf('.footer {'));
    expect(body).toMatch(/flex:\s*1 1 auto/);
    expect(body).not.toMatch(/flex:\s*1;/);
  });
});
