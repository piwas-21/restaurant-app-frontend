import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import OrderLineSummary from './OrderLineSummary';
import type { LineSummary } from './lineSummary';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

const empty: LineSummary = { diff: { added: [], removed: [] }, sideItems: [], children: [] };

describe('OrderLineSummary', () => {
  it('renders nothing when there is nothing to show', () => {
    const { container } = render(<OrderLineSummary line={empty} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders ingredient diffs, add-on sides, instructions, and bundle children with their own diffs', () => {
    const line: LineSummary = {
      diff: { added: [{ name: 'Cheese', quantity: 2 }], removed: ['Onion'] },
      sideItems: [{ name: 'Fries', quantity: 1, price: 3 }],
      specialInstructions: 'Well done',
      children: [{ name: 'Coke', quantity: 1, diff: { added: [], removed: ['Ice'] }, children: [] }],
    };
    render(<OrderLineSummary line={line} />);

    expect(screen.getByText(/Cheese/)).toBeInTheDocument();
    expect(screen.getByText(/Onion/)).toBeInTheDocument();
    expect(screen.getByText(/Fries/)).toBeInTheDocument();
    expect(screen.getByText('Well done')).toBeInTheDocument();
    expect(screen.getByText(/Coke/)).toBeInTheDocument();
    expect(screen.getByText(/Ice/)).toBeInTheDocument();
  });

  it('hides the line special-instructions row when hideInstructions is set (child instructions still show)', () => {
    const line: LineSummary = {
      diff: { added: [], removed: [] },
      sideItems: [],
      specialInstructions: 'Line note',
      children: [
        {
          name: 'Coke',
          quantity: 1,
          diff: { added: [], removed: [] },
          specialInstructions: 'Child note',
          children: [],
        },
      ],
    };
    render(<OrderLineSummary line={line} hideInstructions />);

    expect(screen.queryByText('Line note')).not.toBeInTheDocument();
    expect(screen.getByText('Child note')).toBeInTheDocument();
  });

  it('renders a component of a component (the tree nests deeper than one level)', () => {
    const line: LineSummary = {
      diff: { added: [], removed: [] },
      sideItems: [],
      children: [
        {
          name: 'Burger Combo',
          quantity: 1,
          diff: { added: [], removed: [] },
          children: [
            {
              name: 'Beef Burger',
              quantity: 2,
              diff: { added: [], removed: ['Pickles'] },
              children: [{ name: 'Extra Patty', quantity: 1, diff: { added: [], removed: [] }, children: [] }],
            },
          ],
        },
      ],
    };
    render(<OrderLineSummary line={line} />);

    expect(screen.getByText(/Beef Burger/)).toBeInTheDocument();
    expect(screen.getByText(/Pickles/)).toBeInTheDocument();
    expect(screen.getByText(/Extra Patty/)).toBeInTheDocument();
  });
});
