import { kitchenBoardLabelKey } from './kitchenBoardLabelKeys';

describe('kitchenBoardLabelKey', () => {
  it('maps each supported backend enum to a literal locale key', () => {
    expect(kitchenBoardLabelKey('orderType', 'DineIn')).toBe('nativeKitchenBoard.orderType.DineIn');
    expect(kitchenBoardLabelKey('itemKind', 'CustomizationOption')).toBe(
      'nativeKitchenBoard.itemKind.CustomizationOption',
    );
    expect(kitchenBoardLabelKey('change', 'InstructionChange')).toBe('nativeKitchenBoard.change.InstructionChange');
    expect(kitchenBoardLabelKey('target', 'Cashier')).toBe('nativeKitchenBoard.target.Cashier');
    expect(kitchenBoardLabelKey('route', 'NotConfigured')).toBe('nativeKitchenBoard.route.NotConfigured');
  });

  it('leaves an unknown server enum available for the component raw-value fallback', () => {
    expect(kitchenBoardLabelKey('route', 'FutureRouteState')).toBeUndefined();
  });
});
