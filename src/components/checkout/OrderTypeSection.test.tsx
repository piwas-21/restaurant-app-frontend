import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import OrderTypeSection from './OrderTypeSection';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

describe('OrderTypeSection', () => {
  it('renders the order type + calls onEdit when Edit is clicked (no navigation)', () => {
    const onEdit = jest.fn();
    render(<OrderTypeSection orderType="DineIn" tableNumber="5" onEdit={onEdit} />);

    expect(screen.getByText('Dine In')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});
