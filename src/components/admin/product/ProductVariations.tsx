'use client';

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Languages, Plus, Trash2 } from 'lucide-react';
import { ProductVariationsProps } from './types';
import Switch from '@/components/design-system/Switch';
import { TENANT_CURRENCY } from '@/utils/currency';
import { LANGUAGE_CODES } from '@/config/languageConfig';
import groupStyles from './IngredientGroup.module.css';
import rowStyles from './ProductIngredientRow.module.css';
import detailStyles from './ProductIngredientDetails.module.css';

/**
 * Variations as the compact table the approved screen draws
 * (`docs/stitch-screens/admin-menu/pricing_variations_detail_margherita_pizza`; frontend #576 / gap
 * G9): NAME · DESCRIPTION · PRICE MODIFIER · ACTIVE, one row each, with the currency affixed and a
 * per-row translation count. It used to be full-width stacked blocks with four vertical fields.
 *
 * It shares the ingredient table's stylesheets on purpose — the two tables sit in adjacent sections
 * of one page and the screens draw them identically, so a second copy of the same rules is a second
 * thing to keep in step.
 *
 * **Not one registration changed.** The same `variations.${index}.*` names are registered as
 * before, so the payload is byte-identical and `ProductEditorRoundTrip` is the proof. The one field
 * that lost its input is `displayOrder`, which the screen does not draw: it survives because
 * react-hook-form submits its own store, and the default seeded from the fetched product is in it
 * whether or not an input is mounted — exactly how `variations[].id` has always round-tripped,
 * having never had an input at all. The round-trip test asserts both.
 *
 * DEVIATION: the screen draws a drag handle on every row. Reordering is not wired (it never was —
 * the old handle was decorative), and a control that does nothing is worse than none, so the handle
 * is not drawn. `displayOrder` still decides the order; a real drag is its own slice.
 */
export const ProductVariations: React.FC<ProductVariationsProps> = ({
  register,
  variationFields,
  appendVariation,
  removeVariation,
}) => {
  const { t } = useTranslation();
  const [openRow, setOpenRow] = useState<number | null>(null);

  const translatedCount = (field: Record<string, unknown>) => {
    const content = (field.content ?? {}) as Record<string, { name?: string } | undefined>;
    return LANGUAGE_CODES.filter((language) => (content[language]?.name ?? '').trim().length > 0).length;
  };

  return (
    <section className={groupStyles.group}>
      <h3 className={groupStyles.title}>
        {t('variations')} {t('optional')}
      </h3>

      {variationFields.length === 0 ? (
        <p className={groupStyles.emptyState}>{t('no_variations_added')}</p>
      ) : (
        <table className={groupStyles.table}>
          <thead>
            <tr>
              <th scope="col">{t('variation_name')}</th>
              <th scope="col">{t('variation_description')}</th>
              <th scope="col">{t('price_modifier')}</th>
              <th scope="col">{t('active')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {variationFields.map((field, index) => (
              <React.Fragment key={field.id}>
                <tr className={rowStyles.row}>
                  <td className={rowStyles.nameCell}>
                    <div className={rowStyles.nameField}>
                      <input
                        className={rowStyles.nameInput}
                        aria-label={t('variation_name')}
                        placeholder={t('variation_name')}
                        {...register(`variations.${index}.name`)}
                      />
                      <button
                        type="button"
                        className={rowStyles.detailToggle}
                        aria-expanded={openRow === index}
                        aria-controls={`variation-detail-${field.id}`}
                        aria-label={t('multilingual_names')}
                        onClick={() => setOpenRow((open) => (open === index ? null : index))}
                      >
                        <Languages size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                  <td className={rowStyles.nameCell}>
                    <input
                      className={rowStyles.nameInput}
                      aria-label={t('variation_description')}
                      placeholder={t('variation_description')}
                      {...register(`variations.${index}.description`)}
                    />
                    <span className={rowStyles.pricePreview}>
                      {t('translated_in_languages', {
                        // `done`, not `count`: a variable literally named `count` switches i18next
                        // into plural resolution and looks for `*_one` / `*_other` keys the
                        // locale-parity gate cannot carry (#590). Nothing here is a counted noun —
                        // "languages" is bound to `total`, which is always 10.
                        done: translatedCount(field as Record<string, unknown>),
                        total: LANGUAGE_CODES.length,
                      })}
                    </span>
                  </td>
                  <td className={rowStyles.centerCell}>
                    <span className={rowStyles.priceField}>
                      <input
                        type="number"
                        step="0.01"
                        aria-label={t('price_modifier')}
                        {...register(`variations.${index}.priceModifier`)}
                      />
                      <span className={rowStyles.currency}>{TENANT_CURRENCY}</span>
                    </span>
                  </td>
                  <td className={rowStyles.centerCell}>
                    <Switch
                      className={rowStyles.rowSwitch}
                      label={t('active')}
                      srOnlyLabel
                      id={`variation-active-${index}`}
                      {...register(`variations.${index}.isActive`)}
                    />
                  </td>
                  <td className={rowStyles.centerCell}>
                    <button
                      type="button"
                      className={rowStyles.removeButton}
                      aria-label={t('remove')}
                      onClick={() => removeVariation(index)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
                {openRow === index && (
                  <tr>
                    <td colSpan={5} className={detailStyles.detailCell} id={`variation-detail-${field.id}`}>
                      <div className={detailStyles.translationsGrid}>
                        {LANGUAGE_CODES.map((language) => {
                          const languageName = t(`language_${language}`);
                          return (
                            <div key={language} className={detailStyles.translationField}>
                              <span>{languageName}</span>
                              <input
                                type="text"
                                placeholder={t('variation_name')}
                                aria-label={`${t('variation_name')} — ${languageName}`}
                                {...register(`variations.${index}.content.${language}.name`)}
                              />
                              <input
                                type="text"
                                placeholder={t('variation_description')}
                                aria-label={`${t('variation_description')} — ${languageName}`}
                                {...register(`variations.${index}.content.${language}.description`)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      )}

      <div className={groupStyles.actions}>
        <button
          type="button"
          className={groupStyles.addButton}
          onClick={() =>
            appendVariation({
              name: '',
              description: '',
              priceModifier: 0,
              displayOrder: variationFields.length,
              isActive: true,
              content: {},
            })
          }
        >
          <Plus size={16} aria-hidden="true" />
          {t('add_variation')}
        </button>
      </div>
    </section>
  );
};
