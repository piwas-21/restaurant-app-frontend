/**
 * RFC 7807 `ValidationProblemDetails` — the SECOND shape a `400` arrives in.
 *
 * The app reads the `ApiResponse` envelope (`{ success, message, errors[] }`) everywhere, but that
 * envelope is only what FluentValidation and the handlers produce. Two layers refuse a body BEFORE
 * the handler runs and answer in `application/problem+json` instead
 * (`backend/docs/api/mobile-client-contracts.md` §0.2):
 *
 *  1. **MVC model validation** — every `DataAnnotation` on a DTO (`[Required]`, `[EmailAddress]`,
 *     `[MaxLength]`, `[Range]`). `errors` is an object keyed by the C# PROPERTY NAME:
 *     `{ "errors": { "NumberOfGuests": ["The field NumberOfGuests must be between 1 and 20."] } }`
 *  2. **JSON deserialization** — a `[JsonRequired]` member missing from the body. Same shape, but
 *     `errors` is keyed `"$"` and the field is named inside the sentence:
 *     `{ "errors": { "$": ["JSON deserialization for type '…' was missing required properties…"] } }`
 *
 * DataAnnotations run first, so wherever both layers state a rule this shape is what a client sees.
 * Parsing lives HERE and is wired into `apiClient` once, so every caller gets it — a per-form
 * parser would have to be written again for each of them and was written for none of them.
 *
 * Deliberately free of any import from `apiClient` (which imports this): pure body parsing, no
 * error type, no cycle.
 */

/** `errors` off a `ValidationProblemDetails`: field name (or `"$"`) → one message per broken rule. */
export type ProblemFieldErrors = Readonly<Record<string, readonly string[]>>;

/**
 * The key the JSON deserializer uses when the BODY as a whole could not bind. A client reading
 * `errors["endTime"]` finds nothing on that failure — the field is named in the message only.
 */
export const PROBLEM_BODY_KEY = '$';

/** Non-blank text, or null. `''` and `'   '` are absence wearing a costume. */
function presentable(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

/**
 * The field-keyed errors of a `ValidationProblemDetails` body, or `null` when this is not one.
 *
 * `Array.isArray` is the discriminator that matters: the `ApiResponse` envelope also has an
 * `errors` member, but it is an ARRAY of strings. Only the object form is problem+json.
 * Entries whose value is neither a string nor an array of strings are dropped rather than
 * stringified — `[object Object]` in front of a guest is worse than saying nothing.
 */
export function parseProblemFieldErrors(body: unknown): ProblemFieldErrors | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = (body as { errors?: unknown }).errors;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;

  const parsed: Record<string, string[]> = {};
  for (const [field, value] of Object.entries(raw as Record<string, unknown>)) {
    const messages = (Array.isArray(value) ? value : [value]).map(presentable).filter((m): m is string => m !== null);
    if (messages.length > 0) parsed[field] = messages;
  }

  return Object.keys(parsed).length > 0 ? parsed : null;
}

/** Every message of a problem+json, flattened — what `ApiError.errors` carries for these bodies. */
export function problemFieldMessages(fields: ProblemFieldErrors): string[] {
  return Object.values(fields).flat();
}

/**
 * The DTO member a problem key points at, lower-cased for matching.
 *
 * `"NumberOfGuests"` → `"numberofguests"`. A JSON-path key (`"$.numberOfGuests"`, which is what a
 * TYPE mismatch produces) reduces to its last segment, so one matcher table covers both. `"$"`
 * alone stays `"$"`: it names no field at all and its message is a developer string that must
 * never reach a guest.
 */
export function problemFieldName(key: string): string {
  if (key === PROBLEM_BODY_KEY) return PROBLEM_BODY_KEY;
  // Indexed, not `.pop() ?? key`: `split` always yields at least one element, so the fallback
  // would be a branch nothing can take (the same reasoning as `reservationForm.toWireTime`).
  const segments = key.split('.');
  return segments[segments.length - 1].toLowerCase();
}
