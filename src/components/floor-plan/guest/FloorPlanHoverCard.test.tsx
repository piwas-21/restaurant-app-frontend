import { render, screen, fireEvent } from '@testing-library/react';
import FloorPlanHoverCard from './FloorPlanHoverCard';
import type { GuestTableInfo } from './guestMapState';
import type { FloorPlanTableGeometry } from '@/types/floorPlan';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, f?: string, o?: Record<string, unknown>) =>
      (f ?? _k).replace(/{{(\w+)}}/g, (_m, key: string) => String(o?.[key] ?? '')),
    i18n: { language: 'en' },
  }),
}));

const table: FloorPlanTableGeometry = {
  id: 't1',
  tableNumber: '7',
  maxGuests: 4,
  isActive: true,
  isOutdoor: true,
  notes: 'By the window',
  positionX: 2,
  positionY: 2,
  width: 1,
  height: 1,
  shape: 'round',
  rotation: 0,
};

const info = (state: GuestTableInfo['state']): GuestTableInfo => ({ table, zone: 'Terrace', state, bookable: true });

describe('FloorPlanHoverCard', () => {
  it('shows the table detail and is dismissible', () => {
    const onClose = jest.fn();
    render(
      <FloorPlanHoverCard
        info={info('available')}
        party={2}
        position={{ left: 10, top: 10 }}
        onClose={onClose}
        onPointerEnter={jest.fn()}
        onPointerLeave={jest.fn()}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Table 7' })).toBeInTheDocument();
    expect(screen.getByText('Terrace · outdoor')).toBeInTheDocument();
    expect(screen.getByText('By the window')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('reports the seats-vs-party status when the table is too small', () => {
    render(
      <FloorPlanHoverCard
        info={info('small')}
        party={6}
        position={{}}
        onClose={jest.fn()}
        onPointerEnter={jest.fn()}
        onPointerLeave={jest.fn()}
      />,
    );
    expect(screen.getByText('Seats 4, you are 6')).toBeInTheDocument();
  });

  it('stays open while the pointer is over it (hoverable)', () => {
    const onPointerEnter = jest.fn();
    render(
      <FloorPlanHoverCard
        info={info('booked')}
        party={2}
        position={{}}
        onClose={jest.fn()}
        onPointerEnter={onPointerEnter}
        onPointerLeave={jest.fn()}
      />,
    );
    const card = screen.getByRole('heading', { name: 'Table 7' }).parentElement as HTMLElement;
    fireEvent.pointerEnter(card);
    expect(onPointerEnter).toHaveBeenCalled();
    expect(screen.getByText('Booked')).toBeInTheDocument();
  });
});
