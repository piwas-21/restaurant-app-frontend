import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { FieldErrors, FieldValues } from 'react-hook-form';
import type { Category } from '../types';
import ProductBasicsFields from './ProductBasicsFields';
import { fieldErrorId } from './fieldAria';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const categories: Category[] = [
  { id: 'cat-1', name: 'Pizza' },
  { id: 'cat-2', name: 'Drinks' },
];

const CONSEQUENCE = 'editor_no_primary_category_consequence';

interface HostOptions {
  readonly primaryCategoryId?: string;
  readonly selectedCategoryIds?: string[];
  readonly errors?: FieldErrors<FieldValues>;
}

const renderFields = ({ primaryCategoryId = '', selectedCategoryIds = [], errors = {} }: HostOptions = {}) => {
  function Wrapper() {
    const { register, control } = useForm<FieldValues>({
      defaultValues: { name: '', description: '', primaryCategoryId },
    });
    return (
      <ProductBasicsFields
        register={register}
        errors={errors}
        control={control}
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
      />
    );
  }
  return render(<Wrapper />);
};

const primarySelect = () => screen.getByLabelText('primary_category') as HTMLSelectElement;
const notice = () => screen.queryByText(CONSEQUENCE);

/*
 * D8 (slice S10) — the consequence notice under Primary category.
 *
 * The sentence is NOT new: `ProductOrderTypes.tsx` has rendered it in `Service & availability`
 * since the order-type work, and it still does. What S10 fixes is that the cause (an empty select
 * in section 1) and the effect (a sentence in section 6) were five sections apart, so an admin who
 * never scrolled there never learnt why their item was orderable on every channel. These tests
 * therefore pin WHEN it appears, not that it exists.
 */
describe('ProductBasicsFields — the no-primary-category consequence (D8)', () => {
  it('says nothing before a category has been ticked, because the select is not reachable yet', () => {
    renderFields({ selectedCategoryIds: [] });

    // The control is disabled and empty BY CONSTRUCTION here. A notice would be scolding the admin
    // for not having reached the field, which is exactly the noise D8 must not add.
    expect(primarySelect()).toBeDisabled();
    expect(notice()).not.toBeInTheDocument();
  });

  it('appears once a category is ticked and no primary is chosen', () => {
    renderFields({ selectedCategoryIds: ['cat-1'] });

    expect(primarySelect()).toBeEnabled();
    expect(notice()).toBeInTheDocument();
  });

  it('goes away as soon as a primary is chosen', () => {
    renderFields({ selectedCategoryIds: ['cat-1', 'cat-2'] });
    expect(notice()).toBeInTheDocument();

    fireEvent.change(primarySelect(), { target: { value: 'cat-2' } });

    expect(primarySelect().value).toBe('cat-2');
    expect(notice()).not.toBeInTheDocument();
  });

  it('is still absent with a primary already set on a saved item', () => {
    renderFields({ selectedCategoryIds: ['cat-1'], primaryCategoryId: 'cat-1' });

    expect(notice()).not.toBeInTheDocument();
  });
});

describe('ProductBasicsFields — the notice is wired to the control it explains', () => {
  it('points the select at the notice, and hides its glyph from the accessible name', () => {
    const { container } = renderFields({ selectedCategoryIds: ['cat-1'] });

    const noticeEl = screen.getByText(CONSEQUENCE);
    expect(noticeEl.id).toBeTruthy();
    expect(primarySelect().getAttribute('aria-describedby')).toBe(noticeEl.id);
    // The sentence is already read out; announcing the icon would say a warning twice.
    expect(noticeEl.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    // Explanatory copy, not a rejection: nothing has gone wrong, so it must not shout over a real
    // error the same field can raise.
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  /*
   * The trap this pins. `aria-describedby` written as a JSX attribute AFTER `{...fieldAria(...)}`
   * OVERRIDES the spread, so with an error present and the notice absent the error's describedby is
   * silently wiped — the message stays on screen and leaves the accessibility tree. The two ids are
   * merged instead, and this asserts BOTH survive together.
   */
  it('keeps the error describedby when the field has an error AND the notice', () => {
    renderFields({
      selectedCategoryIds: ['cat-1'],
      errors: { primaryCategoryId: { type: 'required', message: 'Pick one' } },
    });

    const described = (primarySelect().getAttribute('aria-describedby') ?? '').split(' ');
    expect(described).toContain(fieldErrorId('primaryCategoryId'));
    expect(described).toContain(screen.getByText(CONSEQUENCE).id);
    expect(primarySelect()).toHaveAttribute('aria-invalid', 'true');
  });

  it('leaves the error describedby alone when there is no notice', () => {
    renderFields({
      selectedCategoryIds: ['cat-1'],
      primaryCategoryId: 'cat-1',
      errors: { primaryCategoryId: { type: 'required', message: 'Pick one' } },
    });

    expect(notice()).not.toBeInTheDocument();
    expect(primarySelect()).toHaveAttribute('aria-describedby', fieldErrorId('primaryCategoryId'));
  });
});
