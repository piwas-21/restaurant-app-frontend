'use client';

import { useCallback, useMemo, useState } from 'react';
import { getAllergenInfo, type AllergenKind } from '@/lib/allergens';

/** Everything the filter needs from an item — satisfied by `MenuItem` and `MenuBundleItem` alike. */
export interface FilterableItem {
  allergens?: string[];
  isSpecial?: boolean;
}

export type MenuFilterKind = 'claim' | 'without' | 'special';

export interface MenuFilterOption {
  /** Stable id used as the chip key and as the entry in the active set — e.g. `without:gluten`. */
  id: string;
  kind: MenuFilterKind;
  /** The canonical allergen token (`vegan`, `gluten`), or `''` for the specials filter. */
  token: string;
  /**
   * How many of the loaded items this chip would leave GIVEN the chips already active — not on its
   * own. `0` means pressing it empties the menu, which is what a guest needs to see before pressing
   * rather than after.
   */
  count: number;
}

export const SPECIAL_FILTER_ID = 'special';

type Buckets = { claims: Map<string, number>; substances: Map<string, number> };

/** Which tally a token belongs in, or `null` when it belongs in neither. */
function bucketFor(kind: AllergenKind, buckets: Buckets): Map<string, number> | null {
  if (kind === 'substance') return buckets.substances;
  if (kind === 'claim') return buckets.claims;
  return null;
}

/** How many loaded items carry each claim, each substance, and the specials count. */
function tally(items: FilterableItem[]) {
  const claims = new Map<string, number>();
  const substances = new Map<string, number>();
  let specials = 0;

  for (const item of items) {
    if (item.isSpecial) specials += 1;
    for (const token of canonicalTokens(item)) {
      // A token in NEITHER vocabulary is counted in neither bucket: it has no include/exclude
      // meaning, so offering a chip for it would be a guess about what a guest wanted.
      const bucket = bucketFor(getAllergenInfo(token).kind, { claims, substances });
      bucket?.set(token, (bucket.get(token) ?? 0) + 1);
    }
  }

  return { claims, substances, specials };
}

/** The canonical token set for one item, resolved once so aliases (`dairy` → `milk`) collapse. */
function canonicalTokens(item: FilterableItem): Set<string> {
  return new Set((item.allergens ?? []).map((a) => getAllergenInfo(a).canonical));
}

/**
 * Does one item survive a set of active chips?
 *
 * Exported because the Chef's Special is filtered by the SAME rule as the grid it sits in, and it
 * is not part of the list this hook is given — it is a separate fetch rendered as a slot. It used
 * to be withheld outright whenever any chip was on, which is wrong in both directions: a special
 * that matches disappears for no reason, and the guest loses the promoted dish they came for.
 */
export function matchesFilters(item: FilterableItem, activeIds: ReadonlySet<string>): boolean {
  if (activeIds.size === 0) return true;
  const tokens = canonicalTokens(item);
  for (const id of activeIds) {
    if (id === SPECIAL_FILTER_ID) {
      if (!item.isSpecial) return false;
      continue;
    }
    const [kind, token] = id.split(':');
    // AND across chips, deliberately. A guest ticking "Vegan" and "No gluten" wants dishes that are
    // both, not the union — and for the exclusion chips OR would be actively dangerous: "No nuts"
    // OR "No milk" still shows a dish with nuts in it.
    if (kind === 'claim' && !tokens.has(token)) return false;
    if (kind === 'without' && tokens.has(token)) return false;
  }
  return true;
}

/**
 * The menu's filter chips: dietary claims to include, allergen substances to exclude, and the
 * chef's specials.
 *
 * **The options are derived from the dishes on screen, never from a hardcoded list.** A tenant that
 * tags nothing vegan gets no "Vegan" chip rather than a chip that always returns an empty menu, and
 * a tenant using a spelling the vocabulary aliases (`dairy`, `lactose`) gets ONE "Milk" chip
 * because the tokens are canonicalised first.
 *
 * ⚠️ It filters the items it is GIVEN, which is one server page. That is only honest because the
 * page size is large enough to hold a whole category (`usePublicMenuData`, 200); a tenant whose
 * category exceeds that would be filtering page 1 of N. `MenuFilters` prints the match count
 * against the loaded set so the number on screen never claims more than it counted.
 */
export function useMenuFilters<T extends FilterableItem>(items: T[]) {
  const [activeIds, setActiveIds] = useState<ReadonlySet<string>>(() => new Set<string>());

  // Ids first, counts second, and the ACTIVE set pruned in between — the three are computed
  // together because each needs the one before it. Splitting them into separate memos meant the
  // counts were derived from a raw active set that could still contain a chip the current category
  // does not offer.
  const { options, visibleActiveIds } = useMemo(() => {
    const { claims, substances, specials } = tally(items);

    // Ordered by how common the tag is — stable DATA, deliberately not by the live count below, or
    // the chips would reshuffle under the guest's finger every time one was pressed.
    const byCountThenName = (a: [string, number], b: [string, number]) => b[1] - a[1] || a[0].localeCompare(b[0]);
    const ids = [
      ...(specials > 0 ? [{ id: SPECIAL_FILTER_ID, kind: 'special' as const, token: '' }] : []),
      ...[...claims.entries()]
        .sort(byCountThenName)
        .map(([token]) => ({ id: `claim:${token}`, kind: 'claim' as const, token })),
      ...[...substances.entries()]
        .sort(byCountThenName)
        .map(([token]) => ({ id: `without:${token}`, kind: 'without' as const, token })),
    ];

    // Chips are pruned against the CURRENT options rather than cleared on every category change: a
    // guest who filtered to "Vegan" and then switched category keeps that intent where the new
    // category can honour it, and loses it only where it cannot.
    const known = new Set(ids.map((o) => o.id));
    const pruned: ReadonlySet<string> = new Set([...activeIds].filter((id) => known.has(id)));

    // LIVE counts: how many dishes this chip would leave GIVEN the chips already on, not on its
    // own. The static version was the reported "filters don't work" — on a menu where the one Halal
    // dish also contains gluten, "Halal 1" beside "No gluten 2" reads as though the pair should
    // yield something, and it yields nothing with no way to see that before pressing. A chip that
    // would empty the menu now says 0.
    const withChip = (id: string) => {
      const next = new Set(pruned);
      next.add(id);
      return items.filter((item) => matchesFilters(item, next)).length;
    };

    return {
      options: ids.map((o) => ({ ...o, count: withChip(o.id) })) as MenuFilterOption[],
      visibleActiveIds: pruned,
    };
  }, [items, activeIds]);

  const toggle = useCallback((id: string) => {
    setActiveIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setActiveIds(new Set<string>()), []);

  // Filtering uses the PRUNED set, not the raw one. Against the raw set, a chip carried over from a
  // category that offered it would go on hiding dishes in a category that does not — an empty menu
  // with no lit chip anywhere on screen to explain it.
  const filtered = useMemo(
    () => items.filter((item) => matchesFilters(item, visibleActiveIds)),
    [items, visibleActiveIds],
  );

  return { options, activeIds: visibleActiveIds, toggle, clear, filtered, totalLoaded: items.length };
}
