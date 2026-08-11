import { formLevelMessage, routeApiError, serverMessage, type FieldMatchers } from '@/utils/apiFormErrors';

/**
 * Failure handling shared by `CreateCategoryModal` and `EditCategoryModal` (E9 step 3, slice 7).
 *
 * ## Why both shapes go through one call
 *
 * A refused category can arrive EITHER way, and that is the whole reason this exists.
 *
 * - **Resolved inside a 200.** No handler under `Features/Categories/Commands/` throws — each
 *   returns an `ApiResponse.Failure(...)`, and every `CategoriesController` action but
 *   `UpdateCategory` passes it out through a bare `return Ok(result)` (`UpdateCategory` guards
 *   with an early `BadRequest` first — see below — then does the same). "Category with this name
 *   already exists" reaches the browser as a 200 and never becomes an `ApiError`.
 * - **Thrown as a non-2xx.** The handler is not the only thing in the pipeline. `ValidationBehavior`
 *   wraps every dispatch (`Common/Extensions/ServiceRegistration.cs`) and throws
 *   `BadRequestException` with the failures joined by `"; "`; all five Categories commands have a
 *   validator. `[RequireAdmin]` on the write actions produces 401/403. And `CategoriesController`
 *   itself returns `BadRequest(...Failure("Category ID mismatch"))` — unreachable from these two
 *   modals, which send the same id in both places, but present.
 *
 *   A live example these forms can produce today: the zod schema is `name: z.string().min(1)` with
 *   no upper bound, while `CreateCategoryCommandValidator` sets `.MaximumLength(100)`. A 150-character
 *   name is a genuinely refused category that arrives on the THROWN path.
 *
 * An earlier revision of this note said the feature "never throws" and called the catch a pure
 * transport arm. That was wrong, and wrong in the direction that matters: it would have justified
 * treating the catch as the poor relation again. Both arms carry real refusals, which is why both
 * go through `applyCategoryFailure` rather than the pair of ad-hoc paths this replaced (the resolved
 * branch hand-rolled `errors[0]` plus a `toLowerCase().includes('name')` test; the catch was a bare
 * `} catch {` printing `'An unexpected error occurred.'`).
 *
 * ## Why `errors[]` and not `message`
 *
 * Every one of those handlers uses the **one-argument** `ApiResponse.Failure(reason)`. That overload
 * puts the reason in `Errors[0]` and leaves `Message` at its default — the literal string
 * `"Operation failed"` (`ApiResponse.cs:55-63`). Anything reading `message` therefore shows the
 * admin a wrapper where the diagnosis should be. `serverMessage` exists for exactly this and reads
 * `errors[]` first; `reasonOr` below is its one-line application to the partial-success sentences.
 */

/**
 * What every category endpoint resolves to.
 *
 * `categoryService` returns `apiClient`'s parsed body untyped, so both modals used to re-declare
 * this inline at each of their three call sites — six copies, one of which typed `data` as `any`
 * (a §5.8 violation) purely to reach `data.id` after a create. One named type instead: `data` is
 * narrowed to the only field either modal reads, and `errors` is the slot the reason actually
 * arrives in.
 */
export interface CategoryApiResponse {
  readonly success: boolean;
  readonly data?: { readonly id: string };
  readonly message?: string;
  readonly errors?: string[];
}

/**
 * The only field these two forms can route to.
 *
 * Both render `name`, `description`, `imageFile`, `isActive` and `displayOrder`, but only the name
 * has a server-side rule that can fail on its own ("Category with this name already exists",
 * "Another category with this name already exists"). Per the `FieldMatchers` note in
 * `apiFormErrors`, listing a field the form does not render would write a message to state nobody
 * displays *and* suppress the form-level one — so the table stops here rather than being generous.
 *
 * Checked against every HANDLER reason these endpoints can return, none of which contains "name":
 * "Category not found", "One or more categories not found", "Cannot delete category with associated
 * products…", "Duplicate display orders found: …", "Failed to upload image", "Category ID mismatch",
 * and the four `ImageUploadRules` rejections ("No image file provided", "Invalid image MIME type",
 * "File type not allowed. Allowed types: …", and the size one — whose limit is INTERPOLATED from
 * `FileStorageSettings.MaxFileSizeBytes`, bound to 10MB in `appsettings.json`, not the 5MB C#
 * default; both modals refuse at 5MB client-side first, so it is near-unreachable from here).
 * All fall through to the form level.
 *
 * VALIDATOR messages arrive through the same `errors[]` and hit the same matcher, and two of them
 * DO contain "name" — `"Name is required"`, and FluentValidation's default `MaximumLength` text,
 * which has no `.WithMessage()` override and renders "The length of 'Name' must be 100 characters
 * or fewer. You entered 150 characters." Both route to `name`, which is where they belong, so the
 * matcher is right; the survey above is about the handler strings only. Stated because an earlier
 * revision claimed no reachable message contained "name" at all, which was an absolute this file
 * had not checked.
 *
 * **One known imperfection, stated rather than smoothed over.** Validator messages also arrive here,
 * joined by `"; "` into a single string, and `"Display order must be non-negative"` therefore lands
 * at form level even though both forms render a `displayOrder` input. Adding a `displayOrder`
 * matcher would not fix it: `ValidationBehavior` joins ALL failures into one blob, so a save that
 * trips two rules would file the whole sentence under whichever field matched first. That is
 * backend #291's call, not this file's.
 */
export type CategoryFormField = 'name';

const CATEGORY_FIELD_MATCHERS = [['name', /name/i]] as const satisfies FieldMatchers<CategoryFormField>;

/** How a modal writes one message onto a field or onto the form. */
export type SetCategoryError = (field: CategoryFormField | 'root', message: string) => void;

/**
 * Route one failure — thrown or resolved — onto the form.
 *
 * `fallback` must already be translated; it is only reached when the server authored nothing at all,
 * which on this feature means the transport failed. `formLevelMessage` returns `null` when every
 * message found a field, so a successful route does not also print a generic line underneath.
 */
export function applyCategoryFailure(failure: unknown, fallback: string, setError: SetCategoryError): void {
  const routed = routeApiError<CategoryFormField>(failure, CATEGORY_FIELD_MATCHERS);
  for (const { field, message } of routed.fieldErrors) {
    setError(field, message);
  }
  const formLevel = formLevelMessage(routed, fallback);
  if (formLevel) {
    setError('root', formLevel);
  }
}

/**
 * The server's reason for a step that failed *after* the category was already written, for
 * interpolation into a partial-success sentence.
 *
 * These steps (image upload, reorder) are separate requests, so the category exists even when they
 * fail and the admin has to be told which half worked. Both call sites used to interpolate
 * `response.message` — the `"Operation failed"` default — producing "Category created, but image
 * upload failed: Operation failed" while the real sentence sat unread in `errors[0]`.
 */
export function reasonOr(response: unknown, fallback: string): string {
  return serverMessage(response) ?? fallback;
}

/**
 * ## Why a partial success is reported through the PAGE, not the modal's own error slot
 *
 * Referenced from both modals so the reasoning lives in one place.
 *
 * When a following step fails the category itself is already written, so the run has to finish
 * normally: refresh the list, close the modal. Create additionally must close, because leaving the
 * form open invites the admin to submit again and create a duplicate.
 *
 * That is exactly what makes `setError('root', …)` the wrong sink, and it was the wrong sink in the
 * code this replaced too. Both modals open with `if (!isOpen) return null`, and the parent's
 * `onClose` flips `isOpen` in the same batch — so the root error is set on a component that
 * unmounts before it can paint. Create also calls `reset()`, which clears form errors outright.
 * Measured, not reasoned: with `uploadCategoryImage` resolving a rejection, the sentence rendered
 * NOWHERE and the modal closed, i.e. the admin read a plain success for a category whose image was
 * never stored.
 *
 * So both modals take a REQUIRED `onPartialSuccess` and hand the sentence to the page, which owns a
 * `ResultModal` that outlives them. Required rather than optional on purpose: an optional callback
 * is one a future consumer can drop silently, which is the whole failure mode of this sweep.
 *
 * Edit accumulates rather than assigning, because reorder and image upload can both fail in one
 * save and reporting only the last would hide the other.
 */
