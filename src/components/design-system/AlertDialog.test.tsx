import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import AlertDialog from './AlertDialog';

// Stub react-i18next so t() returns the English fallback without a provider.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('AlertDialog', () => {
  const base = {
    isOpen: true as boolean,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    title: 'Delete order',
  };

  afterEach(() => jest.clearAllMocks());

  it('renders nothing when closed', () => {
    const { container } = render(
      <AlertDialog {...base} isOpen={false}>
        Body
      </AlertDialog>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders title, message, and Cancel/Confirm buttons when open', () => {
    render(<AlertDialog {...base}>Are you sure?</AlertDialog>);
    expect(screen.getByRole('dialog', { name: /delete order/i })).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('calls onConfirm when Confirm is clicked', () => {
    const onConfirm = jest.fn();
    render(
      <AlertDialog {...base} onConfirm={onConfirm}>
        x
      </AlertDialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = jest.fn();
    render(
      <AlertDialog {...base} onClose={onClose}>
        x
      </AlertDialog>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses custom confirm/cancel labels', () => {
    render(
      <AlertDialog {...base} confirmLabel="Delete" cancelLabel="Keep">
        x
      </AlertDialog>,
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep' })).toBeInTheDocument();
  });

  it('applies the variant class to the confirm button', () => {
    render(
      <AlertDialog {...base} variant="danger">
        x
      </AlertDialog>,
    );
    expect(screen.getByRole('button', { name: 'Confirm' }).className).toContain('danger');
  });

  it('defaults variant to info', () => {
    render(<AlertDialog {...base}>x</AlertDialog>);
    expect(screen.getByRole('button', { name: 'Confirm' }).className).toContain('info');
  });

  it('shows the loading state and disables both buttons while confirming', () => {
    render(
      <AlertDialog {...base} isConfirming>
        x
      </AlertDialog>,
    );
    expect(screen.getByRole('button', { name: /loading/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  describe('type-to-confirm', () => {
    it('shows an input and keeps Confirm disabled until the text matches', () => {
      const onConfirm = jest.fn();
      render(
        <AlertDialog {...base} confirmationText="DELETE" onConfirm={onConfirm}>
          x
        </AlertDialog>,
      );
      const input = screen.getByRole('textbox');
      const confirm = screen.getByRole('button', { name: 'Confirm' });

      expect(confirm).toBeDisabled();
      fireEvent.change(input, { target: { value: 'DEL' } });
      expect(confirm).toBeDisabled();
      fireEvent.change(input, { target: { value: 'DELETE' } });
      expect(confirm).toBeEnabled();

      fireEvent.click(confirm);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('renders no input when confirmationText is not provided', () => {
      render(<AlertDialog {...base}>x</AlertDialog>);
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });
});
