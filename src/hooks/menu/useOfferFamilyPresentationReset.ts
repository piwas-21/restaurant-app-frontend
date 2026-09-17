import { useEffect } from 'react';
import { ALL_ITEMS_KEY, MENU_BUNDLES_KEY } from '@/hooks/usePublicMenu';

export function useOfferFamilyPresentationReset(
  isLoading: boolean,
  isCategoryOffers: boolean,
  selectedView: string | null,
  setSelectedView: (view: string) => void,
): void {
  useEffect(() => {
    if (!isLoading && isCategoryOffers && selectedView === MENU_BUNDLES_KEY) {
      setSelectedView(ALL_ITEMS_KEY);
    }
  }, [isLoading, isCategoryOffers, selectedView, setSelectedView]);
}
