'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCart } from '@/components/cart/CartContext';
import { useCartFeedback } from '@/hooks/cart/useCartFeedback';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { getProducts } from '@/services/menuService';
import { localizedName } from '@/utils/localizedContent';
import type { OrderType } from '@/types/order';

/** What the drinks step needs off a product row. */
export interface DrinkOption {
  id: string;
  name: string;
  price: number;
  content?: Record<string, { name: string; description?: string }>;
}

interface DrinkRow {
  id: string;
  name: string;
  basePrice: number;
  isActive?: boolean;
  isAvailable?: boolean;
  content?: Record<string, { name: string; description?: string }>;
  availability?: { canOrder?: boolean };
}

/** Enough for any drinks list a restaurant offers; bounds what one request can pull. */
const PAGE_SIZE = 60;

/**
 * How long a fetched list stays fresh. The rows carry a §9.10 availability verdict resolved at
 * fetch time, and a table-service session can sit open for hours — without this, a beverage the
 * kitchen marked unavailable keeps being offered here long after the browse grid stopped offering
 * it, and the guest's add is refused by the server.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * One fetch per channel per session: the list is the same for every item, and re-fetching it on
 * each sheet open would put a request between the tap and the first step. Exported only so a test
 * can start from empty — nothing in the browser ever clears it.
 */
export const drinkListCache = new Map<string, { at: number; drinks: DrinkOption[] }>();

/**
 * The always-available drinks a guest can add from inside the customization sheet
 * (MENU-CUSTOMIZATION-FLOW-PLAN §3.4), whether or not the admin attached any as suggested sides.
 *
 * **A chosen drink becomes its OWN basket line, not a suggested side.** A suggested side is
 * attached to the line and lands on the kitchen ticket as a child of the dish; an arbitrary drink
 * is not a component of that dish. Keeping it separate also keeps `useLinePrice` the single price
 * authority for the line — the guest/waiter price-parity suites pin exactly that.
 */
export function useDrinkUpsell() {
  const { addItem } = useCart();
  const { notifyAddFailed } = useCartFeedback();
  const { state, hydrated } = useOrderType();
  const orderType = state.orderType;
  const cacheKey = orderType ?? 'none';

  const [drinks, setDrinks] = useState<DrinkOption[]>(() => fresh(drinkListCache.get(cacheKey)));
  const [selected, setSelected] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!hydrated) return;
    const cached = drinkListCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setDrinks(cached.drinks);
      return;
    }

    let cancelled = false;
    void loadDrinks(orderType).then((loaded) => {
      drinkListCache.set(cacheKey, { at: Date.now(), drinks: loaded });
      if (!cancelled) setDrinks(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated, cacheKey, orderType]);

  const subtotal = useMemo(
    () => drinks.reduce((sum, drink) => sum + drink.price * (selected[drink.id] ?? 0), 0),
    [drinks, selected],
  );

  const add = useCallback((id: string) => setSelected((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 })), []);

  const remove = useCallback(
    (id: string) =>
      setSelected((prev) => {
        const next = (prev[id] ?? 0) - 1;
        if (next > 0) return { ...prev, [id]: next };
        const { [id]: _dropped, ...rest } = prev;
        return rest;
      }),
    [],
  );

  const reset = useCallback(() => setSelected({}), []);

  /**
   * Commit the chosen drinks. Called only AFTER the line itself was accepted, so a rejected line
   * never leaves a lone drink behind in the basket.
   *
   * **It never throws.** The dish is already in the basket by the time this runs, so letting a
   * refused drink escape would report the whole add as failed — and the guest, seeing an error and
   * a sheet that never closed, would press Add again and buy the dish twice. A drink the server
   * refuses gets its own snackbar and is dropped from the selection along with the ones that did
   * land, so a retry cannot re-add what is already in the basket.
   */
  const addSelected = useCallback(async () => {
    const entries = Object.entries(selected).filter(([, quantity]) => quantity > 0);
    let firstFailure: unknown = null;

    for (const [productId, quantity] of entries) {
      try {
        await addItem({ productId, quantity });
      } catch (error) {
        firstFailure ??= error;
      }
    }

    setSelected({});
    if (firstFailure !== null) notifyAddFailed(firstFailure);
  }, [addItem, notifyAddFailed, selected]);

  /** What the review step reports — resolved names, so the summary reads like the step did. */
  const summary = useCallback(
    (language: string) =>
      drinks
        .filter((drink) => (selected[drink.id] ?? 0) > 0)
        .map((drink) => {
          const quantity = selected[drink.id];
          const name = localizedName(drink, language);
          return quantity > 1 ? `${quantity} × ${name}` : name;
        }),
    [drinks, selected],
  );

  return { drinks, selected, subtotal, add, remove, reset, addSelected, summary };
}

export type DrinkUpsell = ReturnType<typeof useDrinkUpsell>;

/**
 * `Type=Beverage` binds by enum NAME on `GET /api/Products` and the endpoint is public, so this
 * needs no backend change. The channel is passed for the same reason the browse grid passes it: the
 * server resolves each row's verdict, and a drink blocked on this channel must not be offered.
 */
/** A cache entry the TTL has not expired, or an empty list. */
function fresh(entry: { at: number; drinks: DrinkOption[] } | undefined): DrinkOption[] {
  return entry && Date.now() - entry.at < CACHE_TTL_MS ? entry.drinks : [];
}

async function loadDrinks(orderType: OrderType | null): Promise<DrinkOption[]> {
  try {
    const response = await getProducts(1, PAGE_SIZE, null, { type: 'Beverage' }, orderType);
    const rows = (response?.data?.items ?? []) as unknown as DrinkRow[];
    return rows
      .filter((row) => row.isActive !== false && row.isAvailable !== false && row.availability?.canOrder !== false)
      .map((row) => ({ id: row.id, name: row.name, price: row.basePrice, content: row.content }));
  } catch (error) {
    // A failed upsell is not a failed order. The step simply does not appear — see `useSheetFlow`,
    // which derives the step from a NON-EMPTY list rather than from "we tried".
    console.error('Failed to load the drinks list:', error);
    return [];
  }
}
