import { fireEvent, render, screen } from '@testing-library/react';
import ApiTokenRevealModal from './ApiTokenRevealModal';
import type { CreatedApiToken } from '@/types/apiToken';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const created: CreatedApiToken = {
  id: 'a',
  name: 'menu seeder',
  token: 'sk_live_abcdef',
  prefix: 'sk_live_abcd',
  scopes: ['menu:read'],
  expiresAt: '2026-09-22T10:15:00Z',
  createdAt: '2026-08-23T10:15:00Z',
};

describe('ApiTokenRevealModal', () => {
  it('will not let the value leave the screen until the admin confirms they stored it', () => {
    const onConfirm = jest.fn();
    render(<ApiTokenRevealModal createdToken={created} onConfirm={onConfirm} />);

    expect(screen.getByText('sk_live_abcdef')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'api_tokens_reveal_confirm' });
    expect(confirm).toBeDisabled();

    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('api-token-stored'));
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('copies the plaintext, not the prefix', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ApiTokenRevealModal createdToken={created} onConfirm={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'api_tokens_copy' }));

    expect(writeText).toHaveBeenCalledWith('sk_live_abcdef');
    // `findBy` also flushes the state update the awaited clipboard promise schedules — without
    // it React reports an un-acted update AFTER the test has already passed.
    expect(await screen.findByText('api_tokens_copied')).toBeInTheDocument();
  });

  it('points at the manual path when the browser refuses the clipboard', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.assign(navigator, { clipboard: { writeText } });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<ApiTokenRevealModal createdToken={created} onConfirm={jest.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'api_tokens_copy' }));

    // The value is on screen and selectable — a silent no-op would look like a successful copy.
    expect(await screen.findByText('api_tokens_copy_failed')).toBeInTheDocument();
    expect(screen.queryByText('api_tokens_copied')).not.toBeInTheDocument();
    warn.mockRestore();
  });

  it('renders nothing when there is no token to reveal', () => {
    render(<ApiTokenRevealModal createdToken={null} onConfirm={jest.fn()} />);

    expect(screen.queryByText('api_tokens_reveal_title')).not.toBeInTheDocument();
  });
});
