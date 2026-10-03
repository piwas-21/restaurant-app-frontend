import type { useTranslation } from 'react-i18next';

type Translate = ReturnType<typeof useTranslation>['t'];
type SelectionError =
  'load' | 'selectionLimit' | 'categoryLimit' | 'overrideLimit' | 'stale' | 'uncertain' | 'rejected' | null;

export function selectionErrorText(
  t: Translate,
  error: SelectionError,
  selectedCount: number,
  limits: { readonly selectedItems: number; readonly categories: number },
): string | null {
  switch (error) {
    case 'selectionLimit':
      return t('deliveryChannels.menuSelection.selectionLimit', {
        selected: selectedCount,
        maximum: limits.selectedItems,
      });
    case 'categoryLimit':
      return t('deliveryChannels.menuSelection.categoryLimit', { maximum: limits.categories });
    case 'overrideLimit':
      return t('deliveryChannels.menuSelection.overrideLimit');
    case 'stale':
      return t('deliveryChannels.menuSelection.sourceChanged');
    case 'uncertain':
      return t('deliveryChannels.menu.saveUncertain');
    case 'load':
      return t('deliveryChannels.errors.load');
    case 'rejected':
      return t('deliveryChannels.errors.rejected');
    default:
      return null;
  }
}
