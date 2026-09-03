'use client';

import React from 'react';
import ProductBasicsFields from '@/components/admin/product/fields/ProductBasicsFields';
import ProductPricingFields from '@/components/admin/product/fields/ProductPricingFields';
import ProductAllergenFields from '@/components/admin/product/fields/ProductAllergenFields';
import ProductServiceFields from '@/components/admin/product/fields/ProductServiceFields';
import ProductAdvancedFields from '@/components/admin/product/fields/ProductAdvancedFields';
import { ProductVariations } from '@/components/admin/product/ProductVariations';
import { SuggestedSideItemsPicker } from '@/components/admin/product/SuggestedSideItemsPicker';
import ProductRecipeGroups from '@/components/admin/product/ProductRecipeGroups';
import ImageGallery from './ImageGallery';
import EditorOrderTypesField from './EditorOrderTypesField';
import { SECTION_IDS, type EditorSectionsContext } from './editorSectionTypes';
import type { EditorSection } from './EditorShell';

/**
 * The seven sections of an ITEM (MENU-ITEM-EDITOR-REDESIGN-PLAN §4, slice S2).
 *
 * S1 shipped the shell with today's NINE flat groups dropped in unchanged. S2 is the re-group, and
 * it is a move and nothing else: not one field is added, renamed, removed or re-registered, so the
 * payload is byte-identical and `ProductEditorRoundTrip.test.tsx` is the proof.
 *
 * What actually moved, and why (§4):
 * - kitchen type left `Basic info` and prep time left `Details` — both answer "how does the kitchen
 *   serve this?", so they join the order-type mask in **Service & availability**;
 * - base price left `Details` to sit with the variations whose `priceModifier` is relative to it;
 * - the 16 allergen chips left `Details` to sit under the ingredients they describe;
 * - the three status flags left `Details` for the side rail, which is visible from every section;
 * - the product type and `hideBaseProduct` are the once-a-lifetime controls, so they are the whole
 *   of **Advanced** — the ONLY collapsed section (D1).
 *
 * `Advanced` collapses by HIDING its body, never by unmounting it: a registered field that leaves
 * the DOM is a value the PUT clears (plan §6). The same rule governs the rail.
 *
 * Every section carries the one-line `description` the approved screens draw under its title
 * (#573) — that line is what makes a card a card rather than a heading with a border.
 */
export function buildItemSections(context: EditorSectionsContext): EditorSection[] {
  const { editor, t, product } = context;
  const { form } = editor;
  const { errors } = form.formState;

  const sections: EditorSection[] = [
    {
      id: SECTION_IDS.basics,
      label: t('editor_section_basics'),
      showHeading: true,
      description: t('editor_section_basics_description'),
      node: (
        <ProductBasicsFields
          register={form.register}
          errors={errors}
          control={form.control}
          setValue={form.setValue}
          categories={editor.categories}
          categoriesError={editor.categoriesError}
          selectedCategoryIds={editor.selectedCategoryIds}
        />
      ),
    },
    {
      id: SECTION_IDS.media,
      label: t('editor_section_media'),
      showHeading: true,
      description: t('editor_section_media_description'),
      /*
       * The real gallery, and only the real gallery, since S3. Images are sub-resources of a SAVED
       * product, which is why this section used to fork: a create route could merely stage files
       * for the POST to upload. An item has no create route any more — D3 replaced it with a
       * three-field quick-add modal that lands on THIS page — so the staged-file input is gone
       * from the item path and the fork with it. That is the create/edit divergence being deleted
       * rather than designed around. (The gallery writes immediately; D5's notice saying so is S6.)
       *
       * Since S2 it lives INSIDE the form like every other section: what used to keep it out was
       * `ConfirmationModal`'s untyped buttons, and those are now `type="button"`.
       */
      node: <ImageGallery productId={product.id} images={product.images || []} productName={product.name} />,
    },
    {
      id: SECTION_IDS.pricing,
      label: t('editor_section_pricing'),
      showHeading: true,
      description: t('editor_section_pricing_description'),
      node: (
        <>
          <ProductPricingFields register={form.register} errors={errors} />
          <ProductVariations
            register={form.register}
            errors={errors}
            variationFields={editor.variations.fields}
            appendVariation={editor.variations.append}
            removeVariation={editor.variations.remove}
            moveVariation={editor.moveVariation}
            getValues={form.getValues}
            control={form.control}
          />
        </>
      ),
    },
    {
      id: SECTION_IDS.options,
      label: t('editor_section_options'),
      showHeading: true,
      description: t('editor_section_options_description'),
      node: (
        // An item may not suggest ITSELF (S9 / D12), and nothing on the server refuses it, so the
        // picker needs to know which product it is editing. `product.id` is empty on the create
        // route, where there is nothing to exclude yet.
        <SuggestedSideItemsPicker
          control={form.control}
          errors={errors}
          selectedSideItemIds={editor.selectedSideItemIds}
          onChange={editor.changeSideItemIds}
          productId={product.id}
        />
      ),
    },
    {
      id: SECTION_IDS.recipe,
      label: t('editor_section_recipe'),
      showHeading: true,
      description: t('editor_section_recipe_description'),
      node: (
        <>
          {/*
           * Two labelled groups over ONE ingredient array (SHARED-MODIFIERS-AND-SAUCES-PLAN D8):
           * `Recipe & dietary` keeps its name and its place in §4's order, and gains the Sauces
           * group plus the three product-level sauce rules.
           */}
          <ProductRecipeGroups
            ingredients={editor.detailedIngredients}
            onChange={editor.changeIngredients}
            productBasePrice={editor.basePrice}
            register={form.register}
            control={form.control}
            errors={errors}
          />
          <ProductAllergenFields control={form.control} />
        </>
      ),
    },
    {
      id: SECTION_IDS.service,
      label: t('editor_section_service'),
      showHeading: true,
      description: t('editor_section_service_description'),
      node: (
        <>
          <ProductServiceFields register={form.register} errors={errors} control={form.control} />
          <EditorOrderTypesField context={context} />
        </>
      ),
    },
    {
      id: SECTION_IDS.advanced,
      label: t('editor_section_advanced'),
      collapsible: true,
      description: t('editor_section_advanced_description'),
      defaultCollapsed: true,
      // `hasVariations` reads the LIVE field array, not `product.variations`: adding the first
      // variation must reveal `hideBaseProduct` in the same session, before any save.
      node: <ProductAdvancedFields register={form.register} />,
    },
  ];

  /*
   * An UNSAVED item has no Media section at all. Images are sub-resources of a saved product, so
   * there is nothing here to manage and nothing to stage since S3 removed the staged input — an
   * empty card named "Media" would be a promise the API cannot keep. In practice an item is always
   * saved by the time it reaches this page (D3's quick-add POSTs first), so this is the guard for
   * a state the routes no longer produce, not a second layout.
   *
   * ⚠️ This filter is legitimate ONLY because the state is unreachable. **Do not reach for it on a
   * path a user can actually take** — D11 says a section that has nothing to show is rendered
   * EMPTY WITH A REASON, not removed: a section that vanishes takes its entry out of the sticky
   * nav too, so the admin reads a shorter page and cannot tell "no photos yet" from "photos are
   * not a thing here". S6 owns Media's real empty state (the bundle case is exactly it) and must
   * render the card and say why, not extend this line.
   */
  return product.id ? sections : sections.filter((section) => section.id !== SECTION_IDS.media);
}
