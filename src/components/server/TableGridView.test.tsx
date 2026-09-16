import '@testing-library/jest-dom';
import { render, screen, within } from '@testing-library/react';
import TableGridView from './TableGridView';
import type { ServerTableDto } from '@/services/serverService';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

function table(tableNumber: string): ServerTableDto {
  return {
    id: `table-${tableNumber}`,
    tableNumber,
    maxGuests: 4,
    isActive: true,
    isOutdoor: false,
    positionX: 0,
    positionY: 0,
    currentOrders: [],
    orderCount: 0,
    hasActiveOrders: false,
    status: 'available',
  };
}

describe('TableGridView', () => {
  it('keeps numeric labels in numeric order while retaining arbitrary labels', () => {
    render(
      <TableGridView
        tables={[table('10'), table('T-QA'), table('2'), table('1')]}
        selectedTableNumber={null}
        onSelectTable={jest.fn()}
      />,
    );

    const cards = screen.getAllByRole('button');
    const labelAt = (label: string) => cards.findIndex((card) => within(card).queryByText(label) !== null);

    expect(['1', '2', '10', 'T-QA'].map(labelAt)).toEqual([0, 1, 2, 3]);
  });
});
