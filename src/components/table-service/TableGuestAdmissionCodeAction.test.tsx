import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createTableGuestAdmissionCode } from '@/services/tableGuestAdmissionCodeService';
import TableGuestAdmissionCodeAction from './TableGuestAdmissionCodeAction';

jest.mock('@/services/tableGuestAdmissionCodeService', () => ({ createTableGuestAdmissionCode: jest.fn() }));

jest.mock('@/contexts/TableGuestFeatureContext', () => ({
  TableGuestFeatureProvider: ({ children }: { children: ReactNode }) => children,
  useTableGuestFeature: () => ({
    tableGuestFeatureStatus: 'ready',
    retryTableGuestFeature: jest.fn(),
  }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

it('explains a guest visit code only after staff opens its compact help control', () => {
  render(<TableGuestAdmissionCodeAction enabled serviceSessionId="visit-1" />);

  const helpButton = screen.getByRole('button', { name: 'table_guest_staff_code_help_label' });
  expect(helpButton).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('table_guest_staff_code_help_text')).not.toBeInTheDocument();

  fireEvent.click(helpButton);

  expect(helpButton).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('table_guest_staff_code_help_text')).toBeInTheDocument();
  expect(screen.getByText('table_guest_staff_code_replacement_detail')).toBeInTheDocument();
});

it('opts into short codes when staff requests a new guest visit code', async () => {
  jest.mocked(createTableGuestAdmissionCode).mockResolvedValue({
    admissionCode: 'ABC123',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });
  render(<TableGuestAdmissionCodeAction enabled serviceSessionId="visit-1" />);

  fireEvent.click(screen.getByRole('button', { name: 'table_guest_staff_code_action' }));

  expect(await screen.findByText('ABC123')).toBeInTheDocument();
  expect(createTableGuestAdmissionCode).toHaveBeenCalledWith('visit-1', { preferShortCode: true });
});
