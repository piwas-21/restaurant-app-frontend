import type { OrderItemDto } from '@/types/order';
import type { OrderAmendmentItemDto } from '@/types/orderAmendment';
import { sameAmendmentItemIdentity } from '@/lib/orderAmendmentItemIdentity';

export interface ProposedPreparationInstruction {
  readonly itemTitle: string;
  readonly text: string;
  readonly nested: boolean;
}

function sameItemIdentity(
  requested: OrderAmendmentItemDto,
  quoted: OrderItemDto,
  expectedQuantity = requested.quantity,
) {
  return (
    sameAmendmentItemIdentity(requested, quoted) &&
    expectedQuantity === quoted.quantity &&
    (!requested.kind || !quoted.kind || requested.kind === quoted.kind)
  );
}

function collect(
  requested: OrderAmendmentItemDto,
  quoted: OrderItemDto,
  nested: boolean,
  expectedQuantity = requested.quantity,
): ProposedPreparationInstruction[] {
  if (!sameItemIdentity(requested, quoted, expectedQuantity)) return [];

  const instructions: ProposedPreparationInstruction[] = [];
  if (typeof requested.specialInstructions === 'string' && requested.specialInstructions.length > 0) {
    instructions.push({
      itemTitle: quoted.productName || quoted.menuName || quoted.variationName || 'Item',
      text: requested.specialInstructions,
      nested,
    });
  }

  requested.childItems?.forEach((child, index) => {
    const quotedChild = quoted.sideItems?.[index];
    if (!quotedChild) return;
    const childQuantity = child.kind === 'SideItem' ? child.quantity * requested.quantity : child.quantity;
    if (Number.isSafeInteger(childQuantity)) instructions.push(...collect(child, quotedChild, true, childQuantity));
  });
  return instructions;
}

/** Only restore local free text when the sanitized quote echoes the same stable item identity. */
export function matchedPreparationInstructions(
  requested: OrderAmendmentItemDto,
  quoted: OrderItemDto | null | undefined,
): ProposedPreparationInstruction[] {
  return quoted ? collect(requested, quoted, false) : [];
}
