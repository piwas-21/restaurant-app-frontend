import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import BaseModal from './BaseModal';

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

  it('sets accessibility attributes on the dialog (role, aria-modal, aria-labelledby)', () => {
    render(
      <BaseModal isOpen onClose={() => {}} title="A11y title">
        <p>body</p>
      </BaseModal>,
    );
    // getByRole with `name` resolves the accessible name via aria-labelledby,
    // so this implicitly verifies the title element is correctly linked.
    const dialog = screen.getByRole('dialog', { name: /a11y title/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
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

  it('does not allow a pending action to be dismissed', () => {
    const onClose = jest.fn();
    render(
      <BaseModal isOpen onClose={onClose} title="Recording payment" isPending>
        <p>Waiting for the till</p>
      </BaseModal>,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('dialog').parentElement!);
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
});
