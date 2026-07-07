import { useRestaurantInfo } from '@/hooks/useRestaurantInfo';

/**
 * Display-ready address lines from the RestaurantInfo API — admin-edited live
 * values only, blank until the API loads (issue #125: no tenant-1 literals in
 * code). The legal pages considered pinning the address at print time for
 * stability (issue #3), but their "last updated" line already renders today's
 * date dynamically (no version-snapshot semantics exist), so the live value
 * is the consistent choice.
 */
export function useRestaurantAddress() {
  const { info } = useRestaurantInfo();
  const addressStreet = info?.addressLine1 ?? '';
  const addressCityCountry =
    info?.postalCode && info?.city && info?.country ? `${info.postalCode} ${info.city}, ${info.country}` : '';
  return { info, addressStreet, addressCityCountry };
}
