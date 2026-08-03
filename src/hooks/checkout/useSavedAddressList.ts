'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getCurrentUser } from '@/services/userService';
import { getMyAddresses, type AddressDto } from '@/services/addressService';
import { getErrorMessage } from '@/utils/apiClient';
import { useStableT } from '@/hooks/useStableT';

export interface SavedAddressList {
  readonly isLoggedIn: boolean;
  readonly savedAddresses: AddressDto[];
  readonly loadingAddresses: boolean;
  readonly showNewAddressForm: boolean;
  readonly setShowNewAddressForm: Dispatch<SetStateAction<boolean>>;
  /**
   * Why the saved list is missing, or `null`.
   *
   * Its OWN state, deliberately not `useDeliveryAddress`'s `addressError`. That field is a
   * validation slot: `DeliveryAddressSection.errorOn` hands it to whichever of street/postcode/city
   * is currently empty, so an outage sentence rendered as three simultaneous field errors with red
   * borders on inputs the customer had not touched — and every one of those inputs calls
   * `setAddressError('')` on change, so the first keystroke erased it permanently while the list
   * was still missing. A page-level fact needs a page-level slot.
   */
  readonly listError: string | null;
}

/**
 * Who is signed in, and which addresses they have saved — split out of `useDeliveryAddress`
 * (E9 slice 6b) so the form-field half of that hook stays under the §4 limit.
 *
 * **The two calls are caught SEPARATELY, and that split is the fix this slice is about.** One catch
 * around both was justified by "logged-out users still proceed via the manual form so we silently
 * fall through on auth failure" — true of `getCurrentUser`, which 401s for every guest at checkout,
 * and false of `getMyAddresses`, which only runs once that has already succeeded. A logged-in
 * customer whose address list failed to load was therefore marked `isLoggedIn: false`: their saved
 * addresses vanished with no explanation, and because `useDeliveryAddress.persistIfRequested` is
 * gated on `isLoggedIn`, the "save this address" checkbox silently stopped doing anything for the
 * rest of checkout. A deliberate ignore is justified per PATH, not per callsite — #406's finding
 * about `checkIsOpen`, one feature area over.
 *
 * `t` is read through `useStableT` rather than listed in the effect's deps — see that hook. Listing
 * it would refetch the address list on a language switch, mid-checkout.
 */
export function useSavedAddressList(enabled: boolean): SavedAddressList {
  const tRef = useStableT();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<AddressDto[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const asGuest = () => {
      if (cancelled) return;
      setIsLoggedIn(false);
      setSavedAddresses([]);
      setShowNewAddressForm(true);
      setListError(null);
    };

    (async () => {
      let user;
      try {
        user = await getCurrentUser();
      } catch {
        // IGNORED ON PURPOSE, and only on THIS call: a guest at checkout is the normal case and
        // `getCurrentUser` 401s for one — `userService` suppresses its own log for the same
        // reason. The manual form is the intended experience, so there is nothing to report.
        asGuest();
        return;
      }
      if (!user || cancelled) {
        asGuest();
        return;
      }

      setIsLoggedIn(true);
      setLoadingAddresses(true);
      try {
        const addresses = await getMyAddresses();
        if (cancelled) return;
        setSavedAddresses(addresses);
        setShowNewAddressForm(addresses.length === 0);
        setListError(null);
      } catch (error) {
        if (cancelled) return;
        // Stay logged IN — the profile call just succeeded, so this is the list failing, not the
        // session. "You have no saved addresses" and "we could not load them" are different
        // sentences, and the customer can act on only one of them.
        setSavedAddresses([]);
        setShowNewAddressForm(true);
        setListError(
          getErrorMessage(error) ??
            tRef.current('failed_to_load_saved_addresses', 'Could not load your saved addresses.'),
        );
      } finally {
        if (!cancelled) setLoadingAddresses(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, tRef]);

  return { isLoggedIn, savedAddresses, loadingAddresses, showNewAddressForm, setShowNewAddressForm, listError };
}
