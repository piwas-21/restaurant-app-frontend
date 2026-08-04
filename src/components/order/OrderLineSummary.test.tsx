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

  // `showChildPrices` is opt-in so #189 could move the /cart card onto this component without
  // adding a price to the eight render sites that never showed one. Both directions are pinned:
  // default OFF is the guarantee those sites rest on, and the `> 0` guard stops a free component
  // printing "+CHF 0.00".
  it.each([
    ['default (off)', undefined, false],
    ['showChildPrices', true, true],
  ])('component upcharge — %s', (_label, showChildPrices, expected) => {
    const line: LineSummary = {
      diff: { added: [], removed: [] },
      sideItems: [],
      children: [
        { name: 'Pizza', quantity: 1, diff: { added: [], removed: [] }, children: [], price: 2.99 },
        { name: 'Coke', quantity: 1, diff: { added: [], removed: [] }, children: [], price: 0 },
      ],
    };
    render(<OrderLineSummary line={line} showChildPrices={showChildPrices} />);

    expect(screen.queryByText('+CHF 2.99') !== null).toBe(expected);
    // The free component never shows a price, whichever way the flag is set.
    expect(screen.queryByText('+CHF 0.00')).not.toBeInTheDocument();
  });

  // Asking for the price suppresses the count, because the two stop reconciling once a stepper is
  // used — `BasketService.UpdateBasketItemAsync` rescales the root row only, so a child keeps its
  // add-time `Quantity` (see `ChildList`). Both directions from ONE fixture. Mutation results are
  // RUN, not reasoned: dropping the `showQuantity &&` conjunct fails the second case only;
  // `showQuantity = showPrices` fails BOTH; `showQuantity = false` fails the first only. So no
  // single case carries the pair — deleting either one leaves a real mutant alive.
  it.each([
    ['prices off — the count shows', undefined, false, true],
    ['prices on — the count is suppressed', true, true, false],
  ])('component count vs upcharge — %s', (_label, showChildPrices, wantPrice, wantCount) => {
    const line: LineSummary = {
      diff: { added: [], removed: [] },
      sideItems: [],
      children: [{ name: 'Coke', quantity: 2, diff: { added: [], removed: [] }, children: [], price: 1.5 }],
    };
    render(<OrderLineSummary line={line} showChildPrices={showChildPrices} />);

    expect(screen.queryByText('+CHF 1.50') !== null).toBe(wantPrice);
    // Against the whole document, not the name node: scoping it to `.childName` would pass a
    // restructure that merely moved "× 2" into a sibling span, i.e. the count back on screen.
    expect(screen.queryByText(/×\s*2/) !== null).toBe(wantCount);
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
