import { z } from 'zod';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * THE category form schema — one object, used by both the create and the edit modal (#642).
 *
 * The two modals carried byte-identical copies of this. The audit that produced it said why that
 * matters, and then left the copies in place: *"two schemas over one column that disagree about
 * null is how #638 survived review."* A shared object makes that disagreement impossible by
 * construction, which is strictly better than a test asserting the copies still match — the test
 * can only notice drift after someone writes it.
 *
 * ## `description` is `.nullish()`, not `.optional()`
 *
 * `CategoryDto.Description` is `string?` and the API sets no `DefaultIgnoreCondition`
 * (`ApiResponse.cs:26`), so a category with no description arrives as an explicit `null`.
 * `z.string().optional()` accepts `undefined` and REFUSES `null` — the #638 defect exactly.
 *
 * Neither modal is broken today: the create form is seeded from no response at all, and the edit
 * form coalesces (`category.description || ''`) before it seeds. But a form schema is a contract
 * with the SERVER'S JSON, not with the form's own defaults, and a coalesce in a caller is a rule
 * nobody can see from the schema. Removing that `|| ''` must not be able to silently reintroduce a
 * save-blocking refusal on a field the admin never touched.
 */
export const categoryFormSchema = z.object({
  name: z.string().min(1, { message: 'Category name is required' }),
  description: z.string().nullish(),
  imageFile: z
    .any()
    .refine((files) => !files || files.length === 0 || files[0].size <= MAX_FILE_SIZE, `Max file size is 5MB.`)
    .refine(
      (files) => !files || files.length === 0 || ACCEPTED_IMAGE_TYPES.includes(files[0].type),
      '.jpg, .jpeg, .png and .webp files are accepted.',
    )
    .optional(),
  isActive: z.boolean(),
  displayOrder: z.coerce.number().int().min(0, { message: 'Display order must be a non-negative integer' }),
});

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
