import { render, screen } from '@testing-library/react';
import type { OrderAmendmentQuote } from '@/types/orderAmendment';
import OrderAmendmentReviewStage from './OrderAmendmentReviewStage';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, options?: { item?: string }) => {
      const labels: Record<string, string> = {
        order_status_in_transit: 'In Transit',
        payment_status_partially_paid: 'Partially Paid',
      };
      const translated = labels[key] ?? fallback ?? key;
      return translated.replace('{{item}}', options?.item ?? '{{item}}');
    },
    i18n: { language: 'en' },
  }),
}));
jest.mock('@/components/order/OrderLineSummary', () => ({
  __esModule: true,
  default: () => null,
}));

const quote = {
  amendmentId: 'amendment-1',
  sourceOrderId: 'order-1',
  expiresAt: '2099-01-01T00:00:00Z',
  sourceOrder: {
    id: 'order-1',
    orderNumber: 'A-001',
    status: 'OutForDelivery',
    paymentStatus: 'PartiallyPaid',
    total: 10,
    items: [],
  },
  changes: [
    {
      orderItemId: 'line-1',
      kind: 'InstructionChange',
      startOrdinal: 1,
      quantity: 1,
      wholeLine: true,
      previous: {
        id: 'line-1',
        productId: 'product-1',
        productName: 'Soup',
        quantity: 1,
        unitPrice: 10,
        itemTotal: 10,
      },
      // The backend intentionally redacts this field from replayable quote snapshots.
      current: { productId: 'product-1', quantity: 1, unitPrice: 10 },
    },
  ],
  supplementOrder: null,
  financialPreview: {
    currency: 'CHF',
    addedAmountMinor: 0,
    removedUnitValueMinor: 0,
    netAccountDeltaMinor: 0,
    potentialCreditMinor: 0,
    resolutionStatus: 'NotRequired',
    creditState: 'None',
    loyaltyState: 'None',
    refundState: 'None',
  },
} as unknown as OrderAmendmentQuote;

describe('OrderAmendmentReviewStage', () => {
  it('renders localized status badges during review instead of raw enum values', () => {
    render(
      <OrderAmendmentReviewStage
        quote={quote}
        language="en"
        proposedAdditionItems={[]}
        proposedInstructionChanges={[]}
      />,
    );

    expect(screen.getByText('In Transit')).toBeInTheDocument();
    expect(screen.getByText('Partially Paid')).toBeInTheDocument();
    expect(screen.getByText('No new supplement')).toBeInTheDocument();
    expect(screen.queryByText('OutForDelivery')).not.toBeInTheDocument();
    expect(screen.queryByText('PartiallyPaid')).not.toBeInTheDocument();
  });

  it('shows the exact local proposed instruction when the quote response redacts free text', () => {
    const instruction = '  Hold the sauce.\n  Keep this spacing.  ';
    const { container } = render(
      <OrderAmendmentReviewStage
        quote={quote}
        language="en"
        proposedAdditionItems={[]}
        proposedInstructionChanges={[
          {
            orderItemId: 'line-1',
            kind: 'InstructionChange',
            startOrdinal: 1,
            quantity: 1,
            current: { productId: 'product-1', quantity: 1, unitPrice: 10, specialInstructions: instruction },
          },
        ]}
      />,
    );

    expect(screen.getByText('Proposed preparation instruction')).toBeInTheDocument();
    expect(container.querySelector('pre')?.textContent).toBe(instruction);
  });

  it('shows local instructions for quote additions and nested children after response redaction', () => {
    const addition = {
      productId: 'sandwich',
      quantity: 2,
      unitPrice: 12,
      specialInstructions: '  Toast lightly.\nServe warm. ',
      childItems: [
        {
          productId: 'salad',
          quantity: 1,
          unitPrice: 0,
          kind: 'SideItem' as const,
          specialInstructions: '  Dressing on the side.  ',
        },
      ],
    };
    const quoteWithRedactedSupplement = {
      ...quote,
      supplementOrder: {
        id: 'supplement-1',
        orderNumber: 'A-002',
        total: 24,
        currency: 'CHF',
        items: [
          {
            id: 'supplement-item-1',
            productId: 'sandwich',
            productName: 'Sandwich',
            quantity: 2,
            unitPrice: 12,
            itemTotal: 24,
            specialInstructions: null,
            sideItems: [
              {
                id: 'supplement-side-1',
                productId: 'salad',
                productName: 'Side salad',
                quantity: 2,
                unitPrice: 0,
                itemTotal: 0,
                specialInstructions: null,
                kind: 'SideItem',
              },
            ],
          },
        ],
      },
    } as unknown as OrderAmendmentQuote;
    const { container } = render(
      <OrderAmendmentReviewStage
        quote={quoteWithRedactedSupplement}
        language="en"
        proposedAdditionItems={[addition]}
        proposedInstructionChanges={[]}
      />,
    );

    expect(Array.from(container.querySelectorAll('pre')).map((node) => node.textContent)).toEqual([
      addition.specialInstructions,
      addition.childItems[0].specialInstructions,
    ]);
    expect(screen.getByText('Preparation instruction for Side salad')).toBeInTheDocument();
  });

  it('matches a menu-backed quote with nullable productId and backend menuID casing', () => {
    const instruction = '  Keep the menu sauce separate.  ';
    const menuQuote = {
      ...quote,
      supplementOrder: {
        id: 'supplement-menu',
        orderNumber: '',
        total: 18,
        currency: 'CHF',
        items: [
          {
            id: 'menu-line-1',
            productId: null,
            menuID: 'menu-1',
            productName: 'Lunch menu',
            quantity: 1,
            unitPrice: 18,
            itemTotal: 18,
            specialInstructions: null,
            sideItems: [],
          },
        ],
      },
    } as unknown as OrderAmendmentQuote;
    const { container } = render(
      <OrderAmendmentReviewStage
        quote={menuQuote}
        language="en"
        proposedAdditionItems={[{ menuId: 'MENU-1', quantity: 1, unitPrice: 18, specialInstructions: instruction }]}
        proposedInstructionChanges={[]}
      />,
    );

    expect(container.querySelector('pre')?.textContent).toBe(instruction);
    expect(screen.getByText(/Lunch menu/)).toBeInTheDocument();
    expect(screen.getByText('Assigned when saved')).toBeInTheDocument();
    expect(screen.queryByText('No new supplement')).not.toBeInTheDocument();
  });

  it('does not match a different menu identity when restoring local preparation instructions', () => {
    const menuQuote = {
      ...quote,
      supplementOrder: {
        id: 'supplement-menu',
        orderNumber: 'A-003',
        total: 18,
        currency: 'CHF',
        items: [
          {
            id: 'menu-line-1',
            productId: null,
            menuID: 'menu-1',
            productName: 'Lunch menu',
            quantity: 1,
            unitPrice: 18,
            itemTotal: 18,
            sideItems: [],
          },
        ],
      },
    } as unknown as OrderAmendmentQuote;
    const { container } = render(
      <OrderAmendmentReviewStage
        quote={menuQuote}
        language="en"
        proposedAdditionItems={[{ menuId: 'menu-2', quantity: 1, unitPrice: 18, specialInstructions: 'Do not show' }]}
        proposedInstructionChanges={[]}
      />,
    );

    expect(container.querySelector('pre')).toBeNull();
  });

  it('does not attach draft instructions to a different quoted line', () => {
    const mismatchedQuote = {
      ...quote,
      supplementOrder: {
        id: 'supplement-1',
        orderNumber: 'A-002',
        total: 12,
        currency: 'CHF',
        items: [
          {
            id: 'different-item',
            productId: 'different-product',
            productName: 'Different item',
            quantity: 1,
            unitPrice: 12,
            itemTotal: 12,
            specialInstructions: null,
          },
        ],
      },
    } as unknown as OrderAmendmentQuote;
    const { container } = render(
      <OrderAmendmentReviewStage
        quote={mismatchedQuote}
        language="en"
        proposedAdditionItems={[
          { productId: 'sandwich', quantity: 1, unitPrice: 12, specialInstructions: 'Do not show' },
        ]}
        proposedInstructionChanges={[]}
      />,
    );

    expect(container.querySelector('pre')).toBeNull();
    expect(screen.queryByText('Do not show')).not.toBeInTheDocument();
  });

  it('shows replacement instructions from the local draft when the quoted change is redacted', () => {
    const replacement = {
      productId: 'replacement-product',
      quantity: 1,
      unitPrice: 15,
      specialInstructions: '  No olives.\nExtra crispy.  ',
      childItems: [
        {
          productId: 'side-sauce',
          quantity: 1,
          unitPrice: 0,
          kind: 'SideItem' as const,
          specialInstructions: '  Pack separately.  ',
        },
      ],
    };
    const quoteWithReplacement = {
      ...quote,
      changes: [
        {
          ...quote.changes[0],
          kind: 'Replace',
          current: {
            id: 'replacement-root',
            productId: 'replacement-product',
            productName: 'Replacement pizza',
            quantity: 1,
            unitPrice: 15,
            itemTotal: 15,
            specialInstructions: null,
            sideItems: [
              {
                id: 'replacement-side',
                productId: 'side-sauce',
                productName: 'Sauce',
                quantity: 1,
                unitPrice: 0,
                itemTotal: 0,
                kind: 'SideItem',
                specialInstructions: null,
              },
            ],
          },
        },
      ],
    } as unknown as OrderAmendmentQuote;
    const { container } = render(
      <OrderAmendmentReviewStage
        quote={quoteWithReplacement}
        language="en"
        proposedAdditionItems={[]}
        proposedInstructionChanges={[
          {
            orderItemId: 'line-1',
            kind: 'Replace',
            startOrdinal: 1,
            quantity: 1,
            current: replacement,
          },
        ]}
      />,
    );

    expect(Array.from(container.querySelectorAll('pre')).map((node) => node.textContent)).toEqual([
      replacement.specialInstructions,
      replacement.childItems[0].specialInstructions,
    ]);
  });
});
