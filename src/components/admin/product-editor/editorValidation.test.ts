import { createProductSchema } from '@/components/admin/product/schemas';
import {
  SECTION_FIELDS,
  collectErrorFields,
  focusField,
  isTranslationsField,
  sectionForField,
  sectionIdsWithErrors,
} from './editorValidation';
import { SECTION_IDS } from './editorSectionTypes';

/**
 * The derivation behind D13's error summary and the nav's error marker (slice S7).
 *
 * It is pure, so it is tested as arithmetic rather than through a rendered form: given
 * react-hook-form's error tree, how many fields are failing, where is the first one, and which
 * sections should carry a marker.
 */
describe('editorValidation — flattening react-hook-form errors (D13)', () => {
  it('counts every failing LEAF, including one inside a field array', () => {
    const fields = collectErrorFields({
      name: { type: 'too_small', message: 'Name is required' },
      variations: [undefined, { name: { type: 'too_small', message: 'Variation name is required' } }] as never,
    });

    // A flat `Object.keys` would have said 2 and been unable to focus either one; the second entry
    // is the case that renders no message at all on the page today.
    expect(fields).toEqual([
      { name: 'name', message: 'Name is required' },
      { name: 'variations.1.name', message: 'Variation name is required' },
    ]);
  });

  // `root` is the FORM-level message. It renders above the sections and has no input, so a summary
  // that counted it would offer a jump to nowhere.
  it('ignores the form-level root error', () => {
    expect(collectErrorFields({ root: { type: 'server', message: 'Operation failed' } } as never)).toEqual([]);
  });

  it('ignores react-hook-form’s own metadata keys', () => {
    const fields = collectErrorFields({
      basePrice: { type: 'invalid_type', message: 'Expected number', ref: { name: 'basePrice' } as never },
    });

    expect(fields).toEqual([{ name: 'basePrice', message: 'Expected number' }]);
  });

  it('reports the sections holding an error, once each', () => {
    const fields = collectErrorFields({
      name: { message: 'a' },
      primaryCategoryId: { message: 'b' },
      basePrice: { message: 'c' },
    } as never);

    expect(sectionIdsWithErrors(fields).sort()).toEqual([SECTION_IDS.basics, SECTION_IDS.pricing].sort());
  });

  it('resolves a nested path through its root', () => {
    expect(sectionForField('variations.3.priceModifier')).toBe(SECTION_IDS.pricing);
    expect(sectionForField('content.0.name')).toBeUndefined();
    expect(isTranslationsField('content.0.name')).toBe(true);
    expect(isTranslationsField('name')).toBe(false);
  });
});

/**
 * The two-way pin that keeps the map honest. A field→section table maintained by hand rots in two
 * directions: a renamed schema field leaves a dead entry, and a NEW schema field silently gets no
 * marker and no jump. Both are asserted against the schema itself.
 */
describe('editorValidation — the field→section map matches the schema', () => {
  const schemaFields = Object.keys(createProductSchema.shape);

  it('names only fields the create schema really has', () => {
    for (const field of Object.keys(SECTION_FIELDS)) {
      expect(schemaFields).toContain(field);
    }
  });

  it('leaves nothing unmapped except the five that no section renders', () => {
    // `isActive`/`isAvailable`/`isSpecial` live in the side RAIL (S2) — an error there would have
    // no nav entry to mark, and all three are booleans with defaults that cannot fail.
    // `content` is the Translations TAB (`isTranslationsField` handles it), `menuDefinition` is a
    // bundle's, and a bundle keeps one panel rather than §4's seven sections (§9.5).
    const exempt = ['isActive', 'isAvailable', 'isSpecial', 'content', 'menuDefinition'];
    const unmapped = schemaFields.filter((field) => !(field in SECTION_FIELDS));

    expect(unmapped.sort()).toEqual(exempt.sort());
  });
});

describe('editorValidation — focusField', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // By the `name` ATTRIBUTE: a variation's input has no generated id, and it is the field that
  // most needs the jump.
  it('focuses a registered input by its name attribute', () => {
    document.body.innerHTML = '<input name="variations.0.name" />';

    expect(focusField('variations.0.name')).toBe(true);
    expect(document.activeElement).toBe(document.querySelector('input'));
  });

  it('says so rather than pretending when nothing matches', () => {
    expect(focusField('name')).toBe(false);
  });

  // A name is interpolated into a selector, so a path containing a dot or a bracket must not be
  // able to change what that selector means.
  it('escapes the name before querying', () => {
    document.body.innerHTML = '<input name="content.0.name" />';

    expect(focusField('content.0.name')).toBe(true);
  });
});
