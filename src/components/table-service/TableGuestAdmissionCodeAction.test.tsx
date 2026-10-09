import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import TableGuestAdmissionCodeAction from './TableGuestAdmissionCodeAction';

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
