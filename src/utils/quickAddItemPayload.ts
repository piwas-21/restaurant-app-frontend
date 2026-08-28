import { createProductSchema, type FormData, type QuickAddItemFormData } from '@/components/admin/product/schemas';
import { emptyProductDetails, toItemDefaults } from './productEditorDefaults';

/**
 * The quick-add modal's three answers → the SAME create payload the full editor would have sent
 * (MENU-ITEM-EDITOR-REDESIGN-PLAN, D3).
 *
 * This is the other half of the strict-subset rule. `quickAddItemSchema` guarantees the modal
 * cannot validate a field differently from the editor; this guarantees the modal cannot OMIT one.
 * The plan's §6 trap — "any field hidden from the form must still be SENT, or the write clears it"
 * — applies to a POST as much as to a PUT: `type`, `kitchenType`, `hideBaseProduct` and
 * `availableOrderTypes` are all columns the create command assigns unconditionally, and a payload
 * that dropped them would create a row the editor then has to repair.
 *
 * So the defaults are not restated here. They are read from `toItemDefaults(emptyProductDetails())`
 * — the exact object the create route seeded its form with — and the merge is parsed through
 * `createProductSchema`, which is what react-hook-form's resolver did on that route. Both steps
 * matter: the parse applies each field's `.default()`, strips the keys the create schema does not
 * carry (`displayOrder`), and REFUSES a payload the full form would have refused.
 */
export function buildQuickAddItemPayload(values: QuickAddItemFormData): FormData {
  return createProductSchema.parse({ ...toItemDefaults(emptyProductDetails(false)), ...values });
}
