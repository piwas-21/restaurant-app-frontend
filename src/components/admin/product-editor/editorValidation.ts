import type { FieldErrors, FieldValues } from 'react-hook-form';
import { SECTION_IDS } from './editorSectionTypes';

/** One failing field, flattened out of react-hook-form's nested error tree. */
export interface EditorFieldError {
  /** The registered path — `name`, `basePrice`, `variations.0.name`. */
  readonly name: string;
  readonly message: string;
}

/**
 * Which §4 section owns which registered field (slice S7, decision D13).
 *
 * Keyed by the ROOT of a registered path, so `variations.0.name` and `variations.2.priceModifier`
 * both resolve through `variations`. It is the only mapping in the redesign that has to be kept in
 * step with `itemEditorSections.tsx` by hand — `ProductEditorSections.test.tsx` already pins which
 * control renders in which section, and `editorValidation.test.ts` pins that every field this map
 * names is a field the schema really has, so a rename cannot rot it silently in both directions.
 *
 * The three status flags live in the side RAIL, not in a section, so they map to nothing: a rail
 * error would have no nav entry to mark. They are booleans with defaults and cannot fail today.
 */
export const SECTION_FIELDS: Readonly<Record<string, string>> = {
  name: SECTION_IDS.basics,
  description: SECTION_IDS.basics,
  categoryIds: SECTION_IDS.basics,
  primaryCategoryId: SECTION_IDS.basics,
  basePrice: SECTION_IDS.pricing,
  variations: SECTION_IDS.pricing,
  suggestedSideItemIds: SECTION_IDS.options,
  allergens: SECTION_IDS.recipe,
  kitchenType: SECTION_IDS.service,
  preparationTimeMinutes: SECTION_IDS.service,
  availableOrderTypes: SECTION_IDS.service,
  type: SECTION_IDS.advanced,
  hideBaseProduct: SECTION_IDS.advanced,
};

/** `root` is react-hook-form's FORM-level error. It has no input, so nothing can jump to it. */
const FORM_LEVEL = 'root';

const isErrorLeaf = (value: unknown): value is { message?: unknown } =>
  typeof value === 'object' && value !== null && 'message' in value;

/**
 * Flatten react-hook-form's error tree into an ordered list of failing fields.
 *
 * Order is what makes "jump to first" mean anything, and it is the tree's own insertion order —
 * which for a Zod resolver is the order the schema declares its fields, i.e. roughly the order the
 * form reads. It is NOT the visual order of §4's sections; the two agree closely enough that
 * chasing an exact match would mean re-deriving the layout here, and the summary says how many
 * remain, so the second jump lands on the second field either way.
 *
 * Recursion is the point: `variations.0.name` is a real submit blocker that renders no message at
 * all today (`ProductVariations.tsx` displays none), so a form could refuse to save with nothing
 * on screen to explain it. A flat `Object.keys(errors)` would report that as one error called
 * "variations" and could not focus anything.
 */
export function collectErrorFields(errors: FieldErrors<FieldValues>): EditorFieldError[] {
  const found: EditorFieldError[] = [];

  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;

    // A leaf carries `message`; a branch (array item, nested object) carries named children. A node
    // can be both — an array error with its own message plus per-index errors — so both run.
    if (isErrorLeaf(node) && typeof node.message === 'string' && node.message.length > 0 && path) {
      found.push({ name: path, message: node.message });
    }

    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'message' || key === 'type' || key === 'ref' || key === 'types') continue;
      walk(child, path ? `${path}.${key}` : key);
    }
  };

  for (const [key, value] of Object.entries(errors)) {
    if (key === FORM_LEVEL) continue;
    walk(value, key);
  }

  return found;
}

/** The section that owns a registered path, or `undefined` for one no section renders. */
export function sectionForField(name: string): string | undefined {
  return SECTION_FIELDS[name.split('.')[0]];
}

/** The distinct sections holding at least one failing field, for the nav's error marker. */
export function sectionIdsWithErrors(fields: readonly EditorFieldError[]): string[] {
  const ids = new Set<string>();
  for (const field of fields) {
    const id = sectionForField(field.name);
    if (id) ids.add(id);
  }
  return [...ids];
}

/**
 * The one error root that does NOT live in a section: the per-locale translation rows, which sit
 * in the other tab. A caller must switch tabs before it can focus one — a `hidden` panel cannot
 * take focus, and the panel stays mounted precisely so the error survives the switch (§8.1).
 */
export const TRANSLATIONS_ROOT = 'content';

/** True when this failing field lives in the Translations tab rather than in a section. */
export function isTranslationsField(name: string): boolean {
  return name.split('.')[0] === TRANSLATIONS_ROOT;
}

/**
 * Scroll to a failing field and put the caret in it.
 *
 * By the `name` ATTRIBUTE, which react-hook-form writes on every registered input, rather than by
 * our own generated id: the ids exist only where a field renders a label through `fieldAria`, and
 * the fields that most need this — a variation's name, three levels down a field array — are
 * exactly the ones that do not have one.
 *
 * It does NOT force a hidden ancestor open, and that is deliberate: every `hidden` container in
 * this editor is React-controlled (the collapsed `Advanced` body, the inactive tab panel), so a
 * direct DOM write would be reverted on the next render and would desync the remembered collapse
 * state. The two real cases are handled where the state lives — the caller switches tab for a
 * translation error, and no field inside `Advanced` can fail today (an enum and a boolean, both
 * with defaults).
 *
 * Returns whether anything was found, so a caller can stay silent rather than pretend it jumped.
 */
export function focusField(name: string): boolean {
  if (typeof document === 'undefined') return false;

  const node = document.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
  if (!node) return false;

  if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  node.focus({ preventScroll: true });
  return true;
}
