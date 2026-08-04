'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getCurrentUser } from '@/services/userService';
import { getMyAddresses, type AddressDto } from '@/services/addressService';
import { getErrorMessage, isAuthError } from '@/utils/apiClient';
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

    /**
     * Fall back to the manual form.
     *
     * `message` is what separates the two reasons for being here (#416). A guest is the NORMAL case
     * and gets silence; a failure that merely LOOKS like one has to say so, or the customer reads an
     * empty address list as "I have none saved".
     */
    const asGuest = (message: string | null = null) => {
      if (cancelled) return;
      setIsLoggedIn(false);
      setSavedAddresses([]);
      setShowNewAddressForm(true);
      setListError(message);
    };

    (async () => {
      let user;
      try {
        user = await getCurrentUser();
      } catch (err) {
        if (cancelled) return;
        // Split per PATH, which is what this file's header asks for and what #416 fixed.
        //
        // A 401 is the NORMAL case — every guest at checkout produces one, `userService` suppresses
        // its own log for the same reason, and the manual form is the intended experience. Silence
        // is right for it.
        //
        // Every other throw used to land here too and run the same silent `asGuest()`, because
        // `getCurrentUser` rethrows every `ApiError`: a 500, a network blip, or a 429 from the
        // per-IP `auth-refresh` limiter (one NAT = a whole venue's wifi). A signed-in customer's
        // saved addresses vanished with no message — and since `useDeliveryAddress` gates the
        // "save this address" checkbox on `isLoggedIn`, it then did nothing for the rest of
        // checkout.
        //
        // Still falls back to the manual form, because checkout must go through and no user object
        // means nothing to list. What changes is that it SAYS so. `isLoggedIn` stays false on this
        // path deliberately: the profile call is the only thing that could have established
        // otherwise, and it just failed — guessing `true` would render a saved-address UI with no
        // addresses behind it.
        if (isAuthError(err)) {
          asGuest();
          return;
        }
        asGuest(
          getErrorMessage(err) ??
            tRef.current('failed_to_load_saved_addresses', 'Could not load your saved addresses.'),
        );
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
