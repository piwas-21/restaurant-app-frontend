import { render, screen, fireEvent, within } from '@testing-library/react';
import FloorPlanGuestMap from './FloorPlanGuestMap';
import { floorPlanFixture } from '../__fixtures__/floorPlanFixture';
import { getFloorPlan } from '@/services/floorPlanService';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, f?: string, o?: Record<string, unknown>) =>
      (f ?? _k).replace(/{{(\w+)}}/g, (_m, key: string) => String(o?.[key] ?? '')),
    i18n: { language: 'en' },
  }),
}));

jest.mock('@/services/floorPlanService', () => ({ getFloorPlan: jest.fn() }));
const mockGetFloorPlan = getFloorPlan as jest.Mock;

const baseProps = {
  skinClassName: 'skin',
  selectedTableIds: [],
  bookedTableIds: [],
  numberOfGuests: 2,
  onSelectTable: jest.fn(),
};

describe('FloorPlanGuestMap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFloorPlan.mockResolvedValue({ success: true, data: floorPlanFixture() });
  });

  it('shows a loading state, then renders the scene and zone chips', async () => {
    render(<FloorPlanGuestMap {...baseProps} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    expect(await screen.findByRole('button', { name: /Table 1/ })).toBeInTheDocument();
    // Map|List toggle + the derived room zone chip.
    expect(screen.getByRole('button', { name: 'Map' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Everywhere' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dining' })).toBeInTheDocument();
  });

  it('selects a table from the map', async () => {
    const onSelectTable = jest.fn();
    render(<FloorPlanGuestMap {...baseProps} onSelectTable={onSelectTable} />);
    fireEvent.click(await screen.findByRole('button', { name: /Table 1/ }));
    expect(onSelectTable).toHaveBeenCalledWith('t1');
  });

  it('switches to the List view and books from a card', async () => {
    const onSelectTable = jest.fn();
    render(<FloorPlanGuestMap {...baseProps} onSelectTable={onSelectTable} />);
    await screen.findByRole('button', { name: /Table 1/ });

    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    const selects = screen.getAllByRole('button', { name: 'Select' });
    expect(selects.length).toBeGreaterThan(0);
    fireEvent.click(selects[0]);
    expect(onSelectTable).toHaveBeenCalled();
  });

  it('reflects selected + booked state on the map', async () => {
    const { container } = render(
      <FloorPlanGuestMap {...baseProps} selectedTableIds={['t1']} bookedTableIds={['t2']} />,
    );
    await screen.findByRole('button', { name: /Table 1/ });
    expect(container.querySelector('[data-table-id="t1"]')).toHaveAttribute('data-state', 'selected');
    expect(container.querySelector('[data-table-id="t2"]')).toHaveAttribute('data-state', 'booked');
  });

  it('shows an error with a retry that refetches', async () => {
    mockGetFloorPlan.mockResolvedValueOnce({ success: false });
    render(<FloorPlanGuestMap {...baseProps} />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The floor plan could not load.');

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: /Table 1/ })).toBeInTheDocument();
    expect(mockGetFloorPlan).toHaveBeenCalledTimes(2);
  });

  it('zoom controls change the scene viewBox', async () => {
    const { container } = render(<FloorPlanGuestMap {...baseProps} />);
    await screen.findByRole('button', { name: /Table 1/ });
    const svg = container.querySelector('svg')!;
    const before = svg.getAttribute('viewBox');
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    expect(svg.getAttribute('viewBox')).not.toBe(before);
  });

  it('filters by a zone chip', async () => {
    render(<FloorPlanGuestMap {...baseProps} />);
    await screen.findByRole('button', { name: /Table 1/ });
    const dining = screen.getByRole('button', { name: 'Dining' });
    fireEvent.click(dining);
    expect(dining).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Everywhere' }));
    expect(dining).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a dismissible hover card on pointer (not touch)', async () => {
    const { container } = render(<FloorPlanGuestMap {...baseProps} />);
    await screen.findByRole('button', { name: /Table 1/ });
    const table = container.querySelector('[data-table-id="t1"]')!;

    fireEvent.pointerMove(table, { pointerType: 'mouse', clientX: 20, clientY: 20 });
    expect(screen.getByRole('heading', { name: 'Table 1' })).toBeInTheDocument();

    fireEvent.keyDown(table, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Table 1' })).not.toBeInTheDocument();
  });

  it('moves focus between tables with the arrow keys', async () => {
    const { container } = render(<FloorPlanGuestMap {...baseProps} />);
    const first = await screen.findByRole('button', { name: /Table 1/ });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(container.querySelector('[data-table-id="t2"]')).toHaveFocus();
    const second = container.querySelector('[data-table-id="t2"]') as SVGGElement;
    fireEvent.keyDown(second, { key: 'ArrowLeft' });
    expect(container.querySelector('[data-table-id="t1"]')).toHaveFocus();
  });
});
