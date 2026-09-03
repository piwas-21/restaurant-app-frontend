import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import type { Category } from '../types';
import ProductBasicsFields from './ProductBasicsFields';
import { fieldErrorId } from './fieldAria';
import { createProductSchema } from '../schemas';
import { itemProductTypes, productTypes } from '../types';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${Object.values(options).join('|')}` : key,
    i18n: { language: 'en' },
  }),
}));

const categories: Category[] = [
  { id: 'cat-1', name: 'Pizza' },
  { id: 'cat-2', name: 'Drinks' },
];

interface HostOptions {
  readonly primaryCategoryId?: string;
  readonly selectedCategoryIds?: string[];
  readonly errors?: FieldErrors<FieldValues>;
  readonly type?: string;
}

/**
 * The host tracks `categoryIds` for real, because the primary is now DERIVED from it — a fixture
 * that froze the selection would make every rule below untestable.
 */
const renderFields = ({
  primaryCategoryId = '',
  selectedCategoryIds = [],
  errors = {},
  type = 'mainItem',
}: HostOptions = {}) => {
  const seen: { primaryCategoryId?: string } = {};
  function Wrapper() {
    const { register, control, setValue, watch } = useForm<FieldValues>({
      defaultValues: { name: '', description: '', primaryCategoryId, categoryIds: selectedCategoryIds, type },
    });
    const ids = (watch('categoryIds') as string[]) ?? [];
    seen.primaryCategoryId = watch('primaryCategoryId') as string;
    return (
      <ProductBasicsFields
        register={register}
        errors={errors}
        control={control}
        setValue={setValue}
        categories={categories}
        selectedCategoryIds={ids}
      />
    );
  }
  render(<Wrapper />);
  return seen;
};

const chip = (name: string) => screen.getByLabelText(name);
const star = (name: string) => screen.getByRole('radio', { name: `primary_category_of:${name}` });

/**
 * The editor used to ask twice — tick the categories, then pick a primary one again from a select
 * that was disabled until you had, with a notice explaining what happens if you skip it. That
 * notice existed because skipping was easy, and skipping was easy because it was a separate act.
 */
describe('ProductBasicsFields — the primary category is part of the chips', () => {
  it('draws no separate primary-category control at all', () => {
    renderFields({ selectedCategoryIds: ['cat-1'] });

    expect(screen.queryByLabelText('primary_category')).not.toBeInTheDocument();
    expect(screen.queryByText('editor_no_primary_category_consequence')).not.toBeInTheDocument();
  });

  it('offers a star only on a TICKED chip — an item cannot be primarily in a category it is not in', () => {
    renderFields({ selectedCategoryIds: ['cat-1'] });

    expect(star('Pizza')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'primary_category_of:Drinks' })).not.toBeInTheDocument();
  });

  it('makes the first ticked category primary, with nothing to skip', () => {
    const seen = renderFields();
    expect(seen.primaryCategoryId).toBe('');

    fireEvent.click(chip('Drinks'));

    expect(seen.primaryCategoryId).toBe('cat-2');
    expect(star('Drinks')).toBeChecked();
  });

  it('moves the primary when another ticked chip is starred', () => {
    const seen = renderFields({ selectedCategoryIds: ['cat-1', 'cat-2'], primaryCategoryId: 'cat-1' });

    fireEvent.click(star('Drinks'));

    expect(seen.primaryCategoryId).toBe('cat-2');
    expect(star('Pizza')).not.toBeChecked();
  });

  /**
   * The failure the old pair could produce and nothing on screen explained: unticking the primary
   * left a stale id, and the server refused the save with "Primary category must be one of the
   * selected categories".
   */
  it('re-homes the primary when its category is unticked', () => {
    const seen = renderFields({ selectedCategoryIds: ['cat-1', 'cat-2'], primaryCategoryId: 'cat-1' });

    fireEvent.click(chip('Pizza'));

    expect(seen.primaryCategoryId).toBe('cat-2');
  });

  it('clears the primary when the last category is unticked', () => {
    const seen = renderFields({ selectedCategoryIds: ['cat-1'], primaryCategoryId: 'cat-1' });

    fireEvent.click(chip('Pizza'));

    expect(seen.primaryCategoryId).toBe('');
  });
});

/**
 * The type select, moved here from the collapsed Advanced section. These two cases came with it —
 * they are S8/D7's, and the reasoning is unchanged by the move.
 */
describe('ProductBasicsFields — the item type', () => {
  it('does not offer `menu`, because picking it produced a bundle with no bundle', () => {
    renderFields();

    const options = Array.from(screen.getByLabelText('product_type').querySelectorAll('option')).map((o) => o.value);
    expect(options).not.toContain('menu');
    expect(options).toEqual([...itemProductTypes]);
  });

  it('but the SCHEMA still accepts `menu` — the vocabulary and the offer are different lists', () => {
    // A zod enum narrowed alongside the select would turn an existing `menu`-typed row into a save
    // the admin cannot complete and cannot explain, since no control could move it back into range.
    expect(productTypes).toContain('menu');
    expect(createProductSchema.shape.type.safeParse('menu').success).toBe(true);
  });

  /** What the select changes is invisible from its label, and it never said so under Advanced. */
  it('says what the type decides, as the select’s own description', () => {
    renderFields();

    expect(screen.getByLabelText('product_type')).toHaveAccessibleDescription('product_type_help');
  });
});

/**
 * The half that went missing when the select did. The schema declares `primaryCategoryId` twice —
 * a `min(1)` and a `.refine` that pins its path here — and with the `FieldError` deleted alongside
 * the control, unticking every category refused the save, marked Basics in the nav, and explained
 * itself NOWHERE. "No field fails silently" is the property this editor is built around.
 */
describe('ProductBasicsFields — the primary category can still say why it refused', () => {
  it('renders the message, and points the group at it', () => {
    renderFields({
      selectedCategoryIds: ['cat-1'],
      errors: { primaryCategoryId: { type: 'required', message: 'Primary category is required' } },
    });

    expect(screen.getByText('Primary category is required')).toBeInTheDocument();
    const group = screen.getByRole('group');
    expect(group.getAttribute('aria-describedby')?.split(' ')).toContain(fieldErrorId('primaryCategoryId'));
    expect(group).toHaveAttribute('aria-invalid', 'true');
  });

  /**
   * The trap the deleted code documented: a later JSX `aria-describedby` OVERRIDES a spread one, so
   * two ids written separately silently drop one. They are joined, and both must survive together.
   */
  it('keeps the hint AND both errors describable at once', () => {
    renderFields({
      selectedCategoryIds: ['cat-1'],
      errors: {
        categoryIds: { type: 'required', message: 'Select at least one category' },
        primaryCategoryId: { type: 'required', message: 'Primary category is required' },
      },
    });

    const described = (screen.getByRole('group').getAttribute('aria-describedby') ?? '').split(' ');
    expect(described).toContain('primary-category-hint');
    expect(described).toContain(fieldErrorId('categoryIds'));
    expect(described).toContain(fieldErrorId('primaryCategoryId'));
  });

  /** The star's own sentence is read WITH the group, not merely printed near it. */
  it('describes the group with the hint even when nothing has failed', () => {
    renderFields({ selectedCategoryIds: ['cat-1'] });

    const group = screen.getByRole('group');
    expect(group.getAttribute('aria-describedby')).toBe('primary-category-hint');
    expect(group).not.toHaveAttribute('aria-invalid');
    expect(document.getElementById('primary-category-hint')).toHaveTextContent('primary_category_hint');
  });
});
