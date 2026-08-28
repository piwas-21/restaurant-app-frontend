import type { FieldErrors, FieldValues } from 'react-hook-form';

/**
 * The DOM id a labelled editor field carries. Derived from the registered path, so a `label`'s
 * `htmlFor`, the input's `id` and its error's `aria-describedby` cannot drift apart.
 */
export const fieldDomId = (name: string) => `product-field-${name}`;

/** The id of the `<p>` holding this field's message — the target of `aria-describedby`. */
export const fieldErrorId = (name: string) => `${fieldDomId(name)}-error`;

/** The message react-hook-form has for a field, flat path or not. */
export function fieldMessage(errors: FieldErrors<FieldValues>, name: string): string | undefined {
  const node = name
    .split('.')
    .reduce<unknown>((current, key) => (current as Record<string, unknown> | undefined)?.[key], errors);
  const message = (node as { message?: unknown } | undefined)?.message;
  return typeof message === 'string' && message.length > 0 ? message : undefined;
}

/**
 * The accessibility props an editor input needs (slice S7, decision D13).
 *
 * Three things a sighted user gets for free and a screen-reader user did not get at all: the
 * control has an id its label points at, it announces itself as invalid, and it points at the
 * sentence that says why. Before S7 the editor rendered the message as a bare `<p>` beside the
 * input, with no programmatic relationship to it — so the message existed on screen and nowhere
 * in the accessibility tree.
 *
 * `aria-invalid` is only ever set to `'true'`, never to `'false'`: an explicit false is announced
 * by some screen readers as a state worth mentioning on a field nobody has touched.
 *
 * Spread AFTER `register(name)`, which supplies `name`, `ref` and the handlers but no id.
 */
export function fieldAria(errors: FieldErrors<FieldValues>, name: string) {
  const message = fieldMessage(errors, name);
  return {
    id: fieldDomId(name),
    'aria-invalid': message ? ('true' as const) : undefined,
    'aria-describedby': message ? fieldErrorId(name) : undefined,
  };
}
