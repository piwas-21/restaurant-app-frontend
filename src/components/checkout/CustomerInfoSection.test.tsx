import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CustomerInfoSection from './CustomerInfoSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

describe('CustomerInfoSection', () => {
  it('renders the customer info + calls onEdit when Edit is clicked (no navigation)', () => {
    const onEdit = jest.fn();
    render(
      <CustomerInfoSection
        customerInfo={{ name: 'Guest E2E', email: 'g@test.local', phone: '+41791234567' }}
        onEdit={onEdit}
      />,
    );

    expect(screen.getByText('Guest E2E')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
