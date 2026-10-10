import { fireEvent, render, screen } from '@testing-library/react';
import { ProductFlowBody } from './SheetSurfaces';
import type { SheetController } from '@/hooks/menu/useSheetFlow';
import { useSheetFlow } from '@/hooks/menu/useSheetFlow';
import type { BundleSheetController } from './BundleSheetBody';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('./SheetIntro', () => () => null);
jest.mock('./SpecialRequestSection', () => () => null);

const clearUnresolved = jest.fn();
const translate = ((key: string) => key) as unknown as Parameters<typeof ProductFlowBody>[0]['t'];

const recoveryController = () =>
  ({
    kind: 'bundle',
    sections: [],
    selectedOptions: [{ sectionId: 'removed-section', itemId: 'removed-product', quantity: 1 }],
    bundle: { id: 'menu', customerStepManifest: null },
    linePrice: { total: 18 },
    specialInstructions: '',
    setSpecialInstructions: jest.fn(),
    clearUnresolvedOptions: clearUnresolved,
  }) as unknown as BundleSheetController;

function RecoveryFlow() {
  const controller = recoveryController();
  const flow = useSheetFlow(controller);
  return (
    <ProductFlowBody
      controller={controller as unknown as SheetController}
      flow={flow}
      step={flow.step}
      isGuided={flow.steps.length > 1}
      drinks={undefined}
      description={undefined}
      t={translate}
      intro={{ allergens: undefined, preparationTimeMinutes: undefined }}
    />
  );
}

describe('ProductFlowBody missing-section recovery', () => {
  beforeEach(() => clearUnresolved.mockClear());

  it('shows a clear action when an unresolved selection has no section screen to return to', () => {
    render(<RecoveryFlow />);

    expect(screen.getByRole('alert')).toHaveTextContent('customer_selection_recover');
    fireEvent.click(screen.getByRole('button', { name: 'customer_selection_clear' }));
    expect(clearUnresolved).toHaveBeenCalledTimes(1);
  });
});
