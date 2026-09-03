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
  // The three product-level sauce rules render inside `Recipe & dietary` too: #588 added the
  // Sauces group to that same section rather than a new one (SHARED-MODIFIERS-AND-SAUCES-PLAN D8),
  // and `sauceMax` carries a cross-field message, so it is a real blocker that needs a marker.
  sauceMin: SECTION_IDS.recipe,
  sauceMax: SECTION_IDS.recipe,
  sauceIncludedFree: SECTION_IDS.recipe,
  kitchenType: SECTION_IDS.service,
  preparationTimeMinutes: SECTION_IDS.service,
  availableOrderTypes: SECTION_IDS.service,
  // Both of these left Advanced: the item TYPE is in Basics (it decides how the guest sheet groups
  // the item in an upsell step, which is not a once-a-lifetime setting) and `hideBaseProduct` is the
  // ACTIVE switch on the variations table's own base row, inside Pricing. Neither can currently
  // fail — an enum with a default and a boolean — so the only thing a stale entry would have done
  // is mark the wrong section in the nav; kept in step anyway, because this table's own doc calls
  // itself the one mapping that has to be maintained by hand.
  type: SECTION_IDS.basics,
  hideBaseProduct: SECTION_IDS.pricing,
  isComponent: SECTION_IDS.advanced,
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
 * translation error, and the one field left inside `Advanced` cannot fail today (`isComponent`, a
 * boolean with a default). The type select and `hideBaseProduct` left that section; both still have
 * defaults and still cannot fail, but neither is behind a collapse any more either.
 *
 * Returns whether anything was found, so a caller can stay silent rather than pretend it jumped.
 */
export function focusField(name: string): boolean {
  if (typeof document === 'undefined') return false;

  const node = document.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`) ?? nearestAnchor(name);
  if (!node) return false;

  reveal(node);
  return true;
}

/** Scroll a node into view and put the caret in it. */
function reveal(node: HTMLElement): void {
  if (typeof node.scrollIntoView === 'function') node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  node.focus({ preventScroll: true });
}

/**
 * The nearest input BELONGING TO THE SAME ROW as a failing path that renders no input of its own.
 *
 * Measured defect (the owner's "clicking it goes nowhere"): a variation's stored translation is
 * addressed as `variations.0.content.fr.description`, and since S4 that path has NO input on the
 * Item tab and one on the Translations tab only while `fr` is the SELECTED locale. `focusField`
 * then found nothing, returned false, and the jump silently did nothing — on the one control whose
 * entire job is to say where the problem is.
 *
 * So the path is walked UP a segment at a time and the first input under the surviving prefix wins:
 * `variations.0.content.fr` → `variations.0.content` → `variations.0` → matches
 * `variations.0.name`, which is the right ROW even though it is not the right field. Landing on the
 * row is a truthful approximation; landing nowhere is a broken control.
 *
 * `variations.` is never used as a prefix on its own — the loop stops before the root, so a jump
 * can never mean "the first variation on the page" when the error is in the fourth.
 */
function nearestAnchor(name: string): HTMLElement | null {
  const segments = name.split('.');
  // Stop at 2 segments: a root alone (`variations`) names a whole array, not a row.
  while (segments.length > 2) {
    segments.pop();
    const prefix = `${segments.join('.')}.`;
    const node = document.querySelector<HTMLElement>(`[name^="${CSS.escape(prefix)}"]`);
    if (node) return node;
  }
  return null;
}

/**
 * Take the admin to a failing field, falling back to the SECTION that owns it.
 *
 * `focusField` answers "is there an input for this path"; this answers the question the save bar's
 * chip actually asks — *"show me the problem"* — which must always move the page somewhere. The
 * section card carries `tabIndex={-1}` for exactly this, and is what the sticky nav scrolls to.
 */
export function jumpToField(name: string): boolean {
  if (focusField(name)) return true;
  if (typeof document === 'undefined') return false;

  const sectionId = sectionForField(name);
  const section = sectionId ? document.getElementById(sectionId) : null;
  if (!section) return false;

  reveal(section);
  return true;
}
