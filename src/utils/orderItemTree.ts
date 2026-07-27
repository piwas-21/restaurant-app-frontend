/**
 * Helpers for walking the order-item tree.
 *
 * Backend #237 (issue #234) made `OrderDto.items` ROOT-ONLY: bundle components and add-on sides are
 * no longer top-level entries, they hang off their parent's `sideItems`, and the backend builds the
 * tree to arbitrary depth. Anything that has to reason about EVERY item in an order — kitchen
 * routing above all — must therefore recurse instead of reading the top level, or it silently
 * misses children.
 */
import { OrderItemDto } from '@/types/order';

const childrenOf = (item: OrderItemDto): OrderItemDto[] => item.sideItems ?? [];

/** True when any item anywhere in the tree is routed to `kitchenType`. */
export const hasItemsForKitchen = (items: OrderItemDto[] | undefined, kitchenType: string): boolean =>
  (items ?? []).some((item) => item.kitchenType === kitchenType || hasItemsForKitchen(childrenOf(item), kitchenType));

/**
 * Prune the tree to the items routed to `kitchenType`.
 *
 * A matching item keeps only its matching descendants nested underneath, so it prints once with the
 * components that kitchen is actually responsible for. A non-matching item is dropped and its
 * matching descendants take its place — that is how BackKitchen fries inside a FrontKitchen combo
 * still reach the back kitchen's ticket instead of vanishing with their parent.
 */
export const selectItemsForKitchen = (items: OrderItemDto[] | undefined, kitchenType: string): OrderItemDto[] =>
  (items ?? []).flatMap((item) => {
    const matchingChildren = selectItemsForKitchen(childrenOf(item), kitchenType);
    return item.kitchenType === kitchenType ? [{ ...item, sideItems: matchingChildren }] : matchingChildren;
  });
