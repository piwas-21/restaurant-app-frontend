const KITCHEN_BOARD_LABEL_KEYS = {
  orderType: {
    DineIn: 'nativeKitchenBoard.orderType.DineIn',
    Takeaway: 'nativeKitchenBoard.orderType.Takeaway',
    Delivery: 'nativeKitchenBoard.orderType.Delivery',
  },
  itemKind: {
    BundleChild: 'nativeKitchenBoard.itemKind.BundleChild',
    SideItem: 'nativeKitchenBoard.itemKind.SideItem',
    CustomizationOption: 'nativeKitchenBoard.itemKind.CustomizationOption',
  },
  change: {
    Add: 'nativeKitchenBoard.change.Add',
    Void: 'nativeKitchenBoard.change.Void',
    Replace: 'nativeKitchenBoard.change.Replace',
    InstructionChange: 'nativeKitchenBoard.change.InstructionChange',
  },
  target: {
    Cashier: 'nativeKitchenBoard.target.Cashier',
    FrontKitchen: 'nativeKitchenBoard.target.FrontKitchen',
    BackKitchen: 'nativeKitchenBoard.target.BackKitchen',
    General: 'nativeKitchenBoard.target.General',
    Default: 'nativeKitchenBoard.target.Default',
  },
  route: {
    NotConfigured: 'nativeKitchenBoard.route.NotConfigured',
    Queued: 'nativeKitchenBoard.route.Queued',
    Received: 'nativeKitchenBoard.route.Received',
    Printed: 'nativeKitchenBoard.route.Printed',
    Sent: 'nativeKitchenBoard.route.Sent',
    Failed: 'nativeKitchenBoard.route.Failed',
    Unknown: 'nativeKitchenBoard.route.Unknown',
    Skipped: 'nativeKitchenBoard.route.Skipped',
  },
} as const;

export type KitchenBoardLabelFamily = keyof typeof KITCHEN_BOARD_LABEL_KEYS;

/** Return a translation key only for the finite backend enums with localized labels. */
export function kitchenBoardLabelKey(family: KitchenBoardLabelFamily, value: string): string | undefined {
  const labels: Readonly<Record<string, string>> = KITCHEN_BOARD_LABEL_KEYS[family];
  return labels[value];
}
