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
