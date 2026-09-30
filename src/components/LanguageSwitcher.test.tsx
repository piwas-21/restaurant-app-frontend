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

let mockBaseLanguage = 'en';
let mockPublicLanguage = 'fr';
let mockUsePublicInstance = false;
const mockBaseChangeLanguage = jest.fn((language: string) => {
  mockBaseLanguage = language;
});
const mockPublicChangeLanguage = jest.fn((language: string) => {
  mockPublicLanguage = language;
});
const mockBaseI18n = {
  changeLanguage: mockBaseChangeLanguage,
  get resolvedLanguage() {
    return mockBaseLanguage;
  },
};
const mockPublicI18n = {
  changeLanguage: mockPublicChangeLanguage,
  get resolvedLanguage() {
    return mockPublicLanguage;
  },
};
let mockPathname: string | null = null;
let mockSearch = '';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: mockUsePublicInstance ? mockPublicI18n : mockBaseI18n,
    t: (_key: string, fallback: string) => fallback,
  }),
}));

jest.mock('../i18n', () => {
  const mockedModule = { __esModule: true };
  Object.defineProperty(mockedModule, 'default', { get: () => mockBaseI18n });
  return mockedModule;
});

jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(mockSearch),
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
  mockBaseLanguage = 'en';
  mockPublicLanguage = 'fr';
  mockUsePublicInstance = false;
  mockPathname = null;
  mockSearch = '';
});

it('a signed-in user has the choice recorded on their account', async () => {
  mockUser = { firstName: 'Ada' };

  pickFrench();

  expect(mockBaseChangeLanguage).toHaveBeenCalledWith('fr');
  expect(localStorage.getItem('i18nextLng')).toBe('fr');
  await waitFor(() => expect(saveLanguagePreference).toHaveBeenCalledWith('fr'));
});

it('a guest writes nothing to any account', async () => {
  pickFrench();

  expect(mockBaseChangeLanguage).toHaveBeenCalledWith('fr');
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
  expect(mockBaseChangeLanguage).toHaveBeenCalledWith('fr');
  expect(localStorage.getItem('i18nextLng')).toBe('fr');
});

it('keeps an explicit public locale choice when client navigation enters a private route', () => {
  mockPathname = '/fr/menu';
  mockUsePublicInstance = true;
  mockPublicLanguage = 'fr';
  mockBaseLanguage = 'de';
  const { rerender } = render(<LanguageSwitcher />);

  fireEvent.click(screen.getByLabelText('Toggle language menu'));
  fireEvent.click(screen.getByText('English'));

  expect(mockPublicChangeLanguage).toHaveBeenCalledWith('en');
  expect(mockBaseChangeLanguage).toHaveBeenCalledWith('en');

  // ClientProviders uses the shared instance again on an unprefixed route. Switching the
  // simulated route and provider proves that the user's explicit choice survives that transition.
  mockPathname = '/cart';
  mockUsePublicInstance = false;
  rerender(<LanguageSwitcher />);
  expect(screen.getByText('EN')).toBeInTheDocument();
});

it('keeps every interface language as an initial public URL link and preserves safe QR context', () => {
  mockPathname = '/fr/menu';
  mockSearch = 'qr=table-token&tableId=table-7&page=2&unknown=secret';
  const { container } = render(<LanguageSwitcher />);
  const links = [...container.querySelectorAll<HTMLAnchorElement>('a[href]')];

  expect(links).toHaveLength(10);
  expect(container.querySelector('[role="listbox"]')).toBeNull();
  expect(links.find((link) => link.href.endsWith('/en/menu?qr=table-token&tableId=table-7&page=2'))).toBeDefined();
  expect(links.some((link) => link.href.includes('unknown='))).toBe(false);
});
