import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { useForm, FormProvider, useFormContext } from 'react-hook-form';
import type { FieldValues } from 'react-hook-form';
import { AVAILABLE_ALLERGENS } from '@/lib/allergens';
import ProductAllergenFields from './ProductAllergenFields';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

function Host() {
  const { control } = useFormContext<FieldValues>();
  return <ProductAllergenFields control={control} />;
}

const renderFields = (allergens: string[] = []) => {
  function Wrapper() {
    const form = useForm<FieldValues>({ defaultValues: { allergens } });
    return (
      <FormProvider {...form}>
        <Host />
      </FormProvider>
    );
  }
  return render(<Wrapper />);
};

const chips = () => screen.getAllByRole('checkbox');
const noneChip = () => screen.getByTestId('allergen-chip-none');
const clearAll = () => screen.getByRole('button', { name: 'allergens_clear_all' });

describe('ProductAllergenFields — the sixteen chips (review gap G13)', () => {
  it('still renders one checkbox per allergen, and nothing extra', () => {
    renderFields();

    expect(chips()).toHaveLength(AVAILABLE_ALLERGENS.length);
    expect(chips()).toHaveLength(16);
  });

  it('gives every chip a glyph, and hides it from the accessible name', () => {
    const { container } = renderFields();

    // One icon per chip label — the point of G13 is that sixteen chips can be scanned without
    // reading sixteen words.
    for (const allergen of AVAILABLE_ALLERGENS) {
      const label = container.querySelector(`label[for="allergen-chip-${allergen}"]`) as HTMLElement;
      expect(label.querySelector('svg')).not.toBeNull();
      expect(label.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    // The label beside it already names the allergen; announcing the glyph would say it twice.
    expect(screen.getByRole('checkbox', { name: 'allergen_vegan' })).toBeInTheDocument();
  });

  it('selects and deselects through the form value, not through a class', () => {
    renderFields(['contains_gluten']);

    expect(screen.getByRole('checkbox', { name: 'allergen_contains_gluten' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'allergen_vegan' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('checkbox', { name: 'allergen_vegan' }));
    expect(screen.getByRole('checkbox', { name: 'allergen_vegan' })).toBeChecked();
    // The one already set is untouched — the click adds, it does not replace.
    expect(screen.getByRole('checkbox', { name: 'allergen_contains_gluten' })).toBeChecked();
  });
});

describe('ProductAllergenFields — Clear all', () => {
  it('is disabled when there is nothing to clear, so it never promises a change it cannot make', () => {
    renderFields();

    expect(clearAll()).toBeDisabled();
  });

  it('empties the whole selection in one action', () => {
    renderFields(['contains_gluten', 'vegan']);

    expect(clearAll()).toBeEnabled();
    fireEvent.click(clearAll());

    expect(chips().filter((chip) => (chip as HTMLInputElement).checked)).toHaveLength(0);
    expect(clearAll()).toBeDisabled();
  });
});

/*
 * `None` is a VIEW of the empty list, not a 17th value. `allergens` is a string[] and the schema
 * cannot tell "declared allergen-free" from "not filled in yet", so the component does not pretend
 * it can — which is exactly why these assertions check `aria-pressed` and NOT a checkbox.
 */
describe('ProductAllergenFields — the None chip', () => {
  it('is a toggle button, not a seventeenth checkbox', () => {
    renderFields();

    expect(chips()).toHaveLength(16);
    expect(noneChip().tagName).toBe('BUTTON');
    expect(noneChip()).toHaveAttribute('aria-pressed', 'true');
  });

  it('is pressed exactly when the list is empty', () => {
    renderFields(['vegan']);

    expect(noneChip()).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(noneChip());
    expect(noneChip()).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('checkbox', { name: 'allergen_vegan' })).not.toBeChecked();
  });

  it('goes unpressed the moment a real allergen is picked', () => {
    renderFields();

    fireEvent.click(screen.getByRole('checkbox', { name: 'allergen_halal' }));
    expect(noneChip()).toHaveAttribute('aria-pressed', 'false');
  });
});

/*
 * CSS contract, for the reason the reflow and Switch tests give: jsdom computes no layout and
 * identity-obj-proxy leaves a render nothing but class names.
 */
describe('ProductAllergenFields — the skin', () => {
  const CSS = readFileSync(join(__dirname, 'ProductAllergenFields.module.css'), 'utf8').replace(
    /\/\*[\s\S]*?\*\//g,
    '',
  );

  it('paints the selected chip on brand tokens, with no raw hex', () => {
    expect(CSS).toMatch(/\.chipOn\s*\{[^}]*border-color:\s*var\(--brand-primary\)/);
    expect(CSS).toMatch(/\.chipOn\s*\{[^}]*color:\s*var\(--brand-primary\)/);
    expect(CSS.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  it('keeps the glyph monochrome so it follows the chip state instead of carrying its own colour', () => {
    expect(CSS).toMatch(/\.chipOn \.chipIcon\s*\{[^}]*color:\s*var\(--brand-primary\)/);
  });
});
