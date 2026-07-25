import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { TableDto } from '@/types/reservation';
import SelectedTableInfo from './SelectedTableInfo';
import styles from './SelectedTableInfo.module.css';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, f?: string) => f ?? _k }),
}));

const makeTable = (partial: Partial<TableDto> & Pick<TableDto, 'id' | 'tableNumber'>): TableDto => ({
  maxGuests: 4,
  isActive: true,
  isOutdoor: false,
  positionX: 0,
  positionY: 0,
  ...partial,
});

describe('SelectedTableInfo docket', () => {
  it('renders nothing when no tables are selected', () => {
    const { container } = render(
      <SelectedTableInfo
        selectedTables={[]}
        requestCombineTables={false}
        onToggleCombine={jest.fn()}
        styles={styles}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one line per selected table with number, seats and indoor/outdoor', () => {
    const selected = [
      makeTable({ id: 'a', tableNumber: '1', maxGuests: 2, isOutdoor: false }),
      makeTable({ id: 'b', tableNumber: '7', maxGuests: 6, isOutdoor: true, notes: 'Near the window' }),
    ];
    render(
      <SelectedTableInfo
        selectedTables={selected}
        requestCombineTables={false}
        onToggleCombine={jest.fn()}
        styles={styles}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText(/2 seats/)).toBeInTheDocument();
    expect(screen.getByText(/Indoor/)).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText(/6 seats/)).toBeInTheDocument();
    expect(screen.getByText(/Outdoor/)).toBeInTheDocument();
    // The table note is a docket line (this replaced the map popup).
    expect(screen.getByText('Near the window')).toBeInTheDocument();
    // Two tables selected -> the combine chip is offered.
    expect(screen.getByRole('button', { name: /combine these tables/i })).toBeInTheDocument();
  });

  it('omits the notes line when a table has no notes and the combine chip for a single table', () => {
    render(
      <SelectedTableInfo
        selectedTables={[makeTable({ id: 'a', tableNumber: '1' })]}
        requestCombineTables={false}
        onToggleCombine={jest.fn()}
        styles={styles}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.queryByText('Near the window')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
