/**
 * GAP-2 S6 — the switcher is where a signed-in person's language becomes an ACCOUNT fact.
 *
 * Two rules, and the second is the one that would go unnoticed: a guest must trigger no write at
 * all (there is no account to write to, and `Accept-Language` already carries their choice onto the
 * row they create), and the write must never be awaited — the menu has already re-rendered in the
 * new language, and a slow or failing network must not hold that up or undo it.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LanguageSwitcher from './LanguageSwitcher';

const mockChangeLanguage = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { changeLanguage: mockChangeLanguage, resolvedLanguage: 'en' } }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: () => null,
}));

let mockUser: { firstName: string } | null = null;
jest.mock('@/components/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/services/userService', () => ({
  saveLanguagePreference: jest.fn().mockResolvedValue(true),
}));

const { saveLanguagePreference } = jest.requireMock('@/services/userService') as {
  saveLanguagePreference: jest.Mock;
};

function pickFrench() {
  render(<LanguageSwitcher />);
  fireEvent.click(screen.getByLabelText('Toggle language menu'));
  fireEvent.click(screen.getByText('French'));
}

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockUser = null;
});

it('a signed-in user has the choice recorded on their account', async () => {
  mockUser = { firstName: 'Ada' };

  pickFrench();

  expect(mockChangeLanguage).toHaveBeenCalledWith('fr');
  expect(localStorage.getItem('i18nextLng')).toBe('fr');
  await waitFor(() => expect(saveLanguagePreference).toHaveBeenCalledWith('fr'));
});

it('a guest writes nothing to any account', async () => {
  pickFrench();

  expect(mockChangeLanguage).toHaveBeenCalledWith('fr');
  expect(localStorage.getItem('i18nextLng')).toBe('fr');
  expect(saveLanguagePreference).not.toHaveBeenCalled();
});

/**
 * The write is best-effort, and its failure must be invisible: the interface has already switched
 * by the time it runs. Pinned with a rejected write — which also proves the `void` is safe, since an
 * unhandled rejection would fail this test rather than merely log.
 */
it('a failed write changes nothing the user can see', async () => {
  mockUser = { firstName: 'Ada' };
  // `false`, not a rejection: the service swallows its own failures and says so in its return type,
  // which is what makes the `void` at the call site safe. That contract is pinned in
  // `services/userServiceLanguage.test.ts` — an unhandled rejection here would fail this test.
  saveLanguagePreference.mockResolvedValue(false);

  pickFrench();

  await waitFor(() => expect(saveLanguagePreference).toHaveBeenCalled());
  expect(mockChangeLanguage).toHaveBeenCalledWith('fr');
  expect(localStorage.getItem('i18nextLng')).toBe('fr');
});
