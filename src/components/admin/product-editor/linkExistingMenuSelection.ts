import { z } from 'zod';

const linkSelectionSchema = (
  linkableMenuIds: ReadonlySet<string>,
  activeVariationIds: ReadonlySet<string>,
  variationRequired: boolean,
) =>
  z
    .object({
      menuId: z.string().trim().min(1),
      variationId: z.string().trim(),
    })
    .superRefine((selection, ctx) => {
      if (!linkableMenuIds.has(selection.menuId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['menuId'], message: 'Unknown menu selection' });
      }
      if (variationRequired && !activeVariationIds.has(selection.variationId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variationId'], message: 'Unknown variation selection' });
      }
      if (!variationRequired && selection.variationId && !activeVariationIds.has(selection.variationId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['variationId'], message: 'Unknown variation selection' });
      }
    });

export function parseLinkExistingMenuSelection(
  selectedMenuId: string,
  selectedVariationId: string,
  linkableMenuIds: ReadonlySet<string>,
  activeVariationIds: ReadonlySet<string>,
  variationRequired: boolean,
) {
  return linkSelectionSchema(linkableMenuIds, activeVariationIds, variationRequired).safeParse({
    menuId: selectedMenuId,
    variationId: selectedVariationId,
  });
}
