import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TableDto } from '@/types/reservation';
import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';
import VisualTableLayout from './VisualTableLayout';
import styles from './VisualTableLayout.module.css';

// Interpolating t-stub so aria-label assertions read the real rendered string.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string, opts?: Record<string, unknown>) =>
      fallback.replace(/{{(\w+)}}/g, (_m, k: string) => String(opts?.[k] ?? '')),
  }),
}));

jest.mock('@/hooks/useRestaurantInfo', () => ({
  useRestaurantInfo: jest.fn(),
}));

const mockUseRestaurantInfo = useRestaurantInfo as jest.Mock;

const makeTable = (partial: Partial<TableDto> & Pick<TableDto, 'id' | 'tableNumber'>): TableDto => ({
  maxGuests: 4,
  isActive: true,
  isOutdoor: false,
  positionX: 300,
  positionY: 250,
  ...partial,
});

const tables = [
  makeTable({ id: 'a', tableNumber: '1' }),
  makeTable({ id: 'b', tableNumber: '2', maxGuests: 6 }),
  makeTable({ id: 'c', tableNumber: '3' }),
];

describe('VisualTableLayout markers', () => {
  beforeEach(() => {
    mockUseRestaurantInfo.mockReturnValue({ info: null, isLoading: false, error: null, refetch: jest.fn() });
  });

  it('renders booked tables as DISABLED buttons whose click never selects', () => {
    const onSelectTable = jest.fn();
    render(<VisualTableLayout tables={tables} onSelectTable={onSelectTable} bookedTableIds={['a']} styles={styles} />);

    const booked = screen.getByRole('button', { name: 'Table 1, 4 seats, Booked' });
    expect(booked).toBeDisabled();
    fireEvent.click(booked);
    expect(onSelectTable).not.toHaveBeenCalled();
  });

  it('marks selected tables with aria-pressed and available ones without', () => {
    render(<VisualTableLayout tables={tables} selectedTableIds={['b']} onSelectTable={jest.fn()} styles={styles} />);

    expect(screen.getByRole('button', { name: 'Table 2, 6 seats, Selected' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Table 3, 4 seats, Available' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('clicking an available table calls onSelectTable with the full table', () => {
    const onSelectTable = jest.fn();
    render(<VisualTableLayout tables={tables} onSelectTable={onSelectTable} styles={styles} />);

    fireEvent.click(screen.getByRole('button', { name: 'Table 3, 4 seats, Available' }));
    expect(onSelectTable).toHaveBeenCalledWith(tables[2]);
  });

  it('labels the floor plan as a named region for screen readers', () => {
    render(<VisualTableLayout tables={tables} onSelectTable={jest.fn()} styles={styles} />);
    expect(screen.getByRole('region', { name: 'Select your Table(s)' })).toBeInTheDocument();
  });
});

describe('VisualTableLayout entrance position', () => {
  it('falls back to {50,10} when restaurant info lacks the entrance fields', () => {
    mockUseRestaurantInfo.mockReturnValue({ info: null, isLoading: false, error: null, refetch: jest.fn() });
    render(<VisualTableLayout tables={[]} onSelectTable={jest.fn()} styles={styles} />);

    const entrance = screen.getByText('🚪');
    expect(entrance).toHaveStyle({ left: '50%', top: '10%' });
  });

  it('uses the admin-placed position from restaurant info when present', () => {
    mockUseRestaurantInfo.mockReturnValue({
      info: { entrancePositionX: 20, entrancePositionY: 80 },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    render(<VisualTableLayout tables={[]} onSelectTable={jest.fn()} styles={styles} />);

    expect(screen.getByText('🚪')).toHaveStyle({ left: '20%', top: '80%' });
  });
});
