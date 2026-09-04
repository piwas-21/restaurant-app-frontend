import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { editCategorySchema } from '@/components/admin/EditCategoryModal';
import { createCategorySchema } from '@/components/admin/CreateCategoryModal';
import { userGroupSchema } from '@/components/admin/user-groups/UserGroupModal';
import DiscountModal, { discountSchema } from '@/components/admin/user-groups/DiscountModal';
import { DiscountType, type GroupDiscountDto } from '@/types/userGroupTypes';
import { toBundleDefaults, toItemDefaults } from '@/utils/productEditorDefaults';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/**
 * frontend #642 — the audit, as a test rather than as a table.
 *
 * ## The rule
 *
 * **A form schema is a contract with the SERVER'S JSON, not with the form's own defaults.** The API
 * sets no global `DefaultIgnoreCondition` (`ApiResponse.cs:26`), so every nullable column is
 * serialised as an explicit `null`. Wherever a form seeds a field from a fetched response verbatim,
 * an `.optional()` on a `string?` / `Guid?` / `decimal?` column is a defect on a field the admin
 * never touched.
 *
 * ## The rule has TWO faces, and #642's table only named one
 *
 * | schema | `null` in | result |
 * |---|---|---|
 * | `z.string().optional()` | a `string?` column | **REFUSED** — `Expected string, received null`, save blocked, often with nothing on screen (#638) |
 * | `z.coerce.number().optional()` | a `decimal?` column | **SILENTLY REWRITTEN TO 0** — `.optional()` short-circuits on `undefined` only, so `null` reaches the coercion and `Number(null)` is 0 |
 *
 * The second is the quieter and the worse of the two: there is no error, the save succeeds, and the
 * stored value has changed. It is why this file asserts VALUES, not just `success`.
 *
 * ## Every fixture below is built from the WIRE shape
 *
 * Copied from the C# DTO, never from the form's own defaults. Every test in the suite missed #638
 * because its fixture agreed with the schema and both disagreed with production.
 */
describe("#642 — Zod schemas against the API's null", () => {
  describe('CategoryDto.Description is `string?`', () => {
    // `EditCategoryModal` seeds from the fetched category and is safe today only through a
    // `category.description || ''` coalesce. The coalesce is a rule nobody can see from the schema,
    // and removing it is a one-character edit — this is what makes that edit safe.
    it('the edit schema accepts the null a description-less category really sends', () => {
      const wire = { name: 'Pizzas', description: null, isActive: true, displayOrder: 0 };

      expect(editCategorySchema.safeParse(wire).success).toBe(true);
    });

    // The create form is seeded from no response, so the refusal cannot reach it. It is pinned
    // anyway: two schemas over ONE column that disagree about null is how this class survives.
    it('the create schema agrees with its sibling', () => {
      const wire = { name: 'Pizzas', description: null, isActive: true, displayOrder: 0 };

      expect(createCategorySchema.safeParse(wire).success).toBe(true);
    });
  });

  describe('UserGroupDto.ValidFrom / .ValidUntil are `DateTime?`', () => {
    /**
     * #642's own table filed `description`, `validFrom` and `validUntil` together as
     * "non-nullable `= string.Empty` (UserGroupDtos.cs:9)". That line is `Description`. The two
     * dates beside it are `DateTime?` and DO arrive as null for an open-ended group — the audit
     * generalised from one field to three. Re-derived from the DTO here, and pinned.
     */
    it('accepts an open-ended group exactly as the API sends it', () => {
      const wire = { name: 'Staff', description: '', validFrom: null, validUntil: null, isActive: true };

      expect(userGroupSchema.safeParse(wire).success).toBe(true);
    });
  });

  describe('UserGroupModal writes the SAME GroupDiscount through its initial-discount block', () => {
    // The create half of the same field pair. It is seeded from no response, so the null route
    // cannot reach it — the EMPTY-INPUT route can, and it produced the same 0.
    it('reads a blank initial-discount cap as "not set"', () => {
      const parsed = userGroupSchema.parse({
        name: 'Staff',
        description: '',
        validFrom: null,
        validUntil: null,
        isActive: true,
        minOrderAmount: '',
        maxDiscountAmount: '',
      });

      expect(parsed.maxDiscountAmount).toBeNull();
      expect(parsed.minOrderAmount).toBeNull();
    });
  });

  describe('GroupDiscountDto.MinimumOrderAmount / .MaximumDiscountAmount are `decimal?`', () => {
    const uncappedFromTheWire = {
      name: 'Staff 10%',
      type: DiscountType.Percentage,
      value: 10,
      minimumOrderAmount: null,
      maximumDiscountAmount: null,
      isActive: true,
    };

    /**
     * THE test of this file. `z.coerce.number().min(0).optional().safeParse(null)` answers
     * `{ success: true, data: 0 }` — so a `success` assertion passes on the BROKEN schema and proves
     * nothing. Only the value discriminates.
     *
     * What 0 costs: `MembershipQrService:188` caps a group discount on `HasValue` alone, with no
     * `> 0` guard (unlike `CustomerDiscountService:128`, which has one). A maximum of 0 therefore
     * caps every discount to zero — the discount silently stops discounting.
     */
    it('keeps "no cap" as null instead of coercing it to a cap of 0', () => {
      const parsed = discountSchema.parse(uncappedFromTheWire);

      expect(parsed.maximumDiscountAmount).toBeNull();
      expect(parsed.minimumOrderAmount).toBeNull();
      expect(parsed.maximumDiscountAmount).not.toBe(0);
    });

    /**
     * THE THIRD GAP. `.optional()` skips `undefined`; `.nullish()` skips `undefined` and `null`;
     * NEITHER skips `''` — and `''` is what every cleared `<input type="number">` produces. So
     * `.nullish()` alone is not sufficient for a coerced number, only for a string.
     *
     * Asserted on the SCHEMA and not only through the modal, because the two are defended by
     * different code: the modal is safe through `emptyAsNull` on the registration, and the schema is
     * safe through its own preprocess. A caller that parses this schema WITHOUT the registration —
     * a test, a future page, an importer — would otherwise walk straight back into the 0.
     */
    it('reads a cleared box as "no cap", not as a cap of 0 — the gap `.nullish()` does not close', () => {
      const parsed = discountSchema.parse({
        ...uncappedFromTheWire,
        minimumOrderAmount: '',
        maximumDiscountAmount: '',
      });

      expect(parsed.maximumDiscountAmount).toBeNull();
      expect(parsed.minimumOrderAmount).toBeNull();
    });

    // The REQUIRED money field, reached from the other end of the same form. `z.coerce.number()`
    // reads `''` as 0 and `min(0)` accepts it, so clearing the value saved a discount OF ZERO — the
    // same "discounts nothing" outcome as a cap of 0, with nothing on screen. A blank required box
    // must be a refusal.
    it('refuses a blank discount value instead of saving a discount of 0', () => {
      const result = discountSchema.safeParse({ ...uncappedFromTheWire, value: '' });

      expect(result.success).toBe(false);
      expect(result.success === false && result.error.issues[0].message).toBe('Value must be positive');
    });

    // The over-reach control for both preprocesses: a real 0 typed on purpose is still a real 0.
    it('still accepts a deliberate 0', () => {
      const parsed = discountSchema.parse({ ...uncappedFromTheWire, value: 0, minimumOrderAmount: 0 });

      expect(parsed.value).toBe(0);
      expect(parsed.minimumOrderAmount).toBe(0);
    });

    it('still reads a real cap as a number', () => {
      const parsed = discountSchema.parse({ ...uncappedFromTheWire, maximumDiscountAmount: 25 });

      expect(parsed.maximumDiscountAmount).toBe(25);
    });
  });

  /**
   * The same defect through the whole modal, because the schema is only half of it: the seeding is
   * what puts the wire's null in front of the schema, and an emptied input is a second route to the
   * same 0 that the schema cannot see (`''` is not null).
   */
  describe('DiscountModal — the round trip an admin actually makes', () => {
    const stored: GroupDiscountDto = {
      id: 'disc-1',
      groupId: 'group-1',
      name: 'Staff 10%',
      type: DiscountType.Percentage,
      value: 10,
      minimumOrderAmount: null,
      maximumDiscountAmount: null,
      isActive: true,
    };

    const renderModal = async (initialData: GroupDiscountDto | null) => {
      const onSubmit = jest.fn(async () => {});
      const { container } = render(
        <DiscountModal isOpen onClose={jest.fn()} onSubmit={onSubmit} initialData={initialData} isSubmitting={false} />,
      );
      await act(async () => {});
      return { container, onSubmit };
    };

    const submit = async (container: HTMLElement, onSubmit: jest.Mock) => {
      fireEvent.submit(container.querySelector('form') as HTMLFormElement);
      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
      return onSubmit.mock.calls[0][0] as Record<string, unknown>;
    };

    it('a save that changes nothing does not invent a cap of 0', async () => {
      const { container, onSubmit } = await renderModal(stored);

      const payload = await submit(container, onSubmit);

      expect(payload.maximumDiscountAmount).toBeNull();
      expect(payload.minimumOrderAmount).toBeNull();
    });

    // The other route to 0, and the one the schema alone cannot stop: `Number('')` is 0, so without
    // `emptyAsNull` an admin who REMOVES a cap stores "cap of 0" — which discounts nothing.
    it('clearing a cap removes it, instead of setting it to zero', async () => {
      const { container, onSubmit } = await renderModal({ ...stored, maximumDiscountAmount: 25 });

      fireEvent.change(container.querySelector('#maximumDiscountAmount') as HTMLInputElement, {
        target: { value: '' },
      });
      const payload = await submit(container, onSubmit);

      expect(payload.maximumDiscountAmount).toBeNull();
    });

    // A NEW discount has no cap. The create defaults seeded 0 for both, so every discount created
    // through this modal shipped with a cap that zeroed it.
    it('creates a discount with no cap rather than a cap of zero', async () => {
      const { container, onSubmit } = await renderModal(null);

      fireEvent.change(container.querySelector('#name') as HTMLInputElement, { target: { value: 'Launch 10%' } });
      fireEvent.change(container.querySelector('#value') as HTMLInputElement, { target: { value: '10' } });
      const payload = await submit(container, onSubmit);

      expect(payload.maximumDiscountAmount).toBeNull();
      expect(payload.minimumOrderAmount).toBeNull();
    });
  });

  /**
   * The BOUNDARY of the rule — a field where `.nullish()` would be the wrong answer, recorded so
   * the rule is not applied mechanically to it later.
   *
   * `ProductDto.Allergens` is `List<string>?`, so the wire can send null. The schema keeps
   * `.optional()` DELIBERATELY: the product PUT assigns the column unconditionally, so a null that
   * the schema accepted and normalised to `[]` would silently WIPE a dish's allergen labelling —
   * and the menu filter reads an unlabelled dish as free of everything (frontend #702/#704). A
   * refusal is loud and recoverable; a silent wipe of a safety label is not.
   *
   * What keeps the form safe is therefore the SEEDING, not the schema, and that is what this pins.
   */
  describe('the boundary: allergens are coalesced at the seed, not accepted as null', () => {
    const wireProduct = { id: 'p1', name: 'Margherita', allergens: null } as unknown as ProductDetails;

    it('an item seeded from a null allergen list carries an empty array, never null', () => {
      expect(toItemDefaults(wireProduct).allergens).toEqual([]);
    });

    it('and so does a bundle', () => {
      expect(toBundleDefaults(wireProduct).allergens).toEqual([]);
    });
  });
});
