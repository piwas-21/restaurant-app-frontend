import type { TranslatableMenuSection, TranslationSlot } from './translationSlots';

type SectionContent = NonNullable<TranslatableMenuSection['translations']>;

const text = (value: string | null | undefined): string => value ?? '';

function sectionSlot(
  section: TranslatableMenuSection,
  index: number,
  field: 'name' | 'description',
): TranslationSlot[] {
  const source = text(section[field]);
  const translations = Object.fromEntries(
    Object.entries((section.translations ?? {}) as SectionContent)
      .filter(([, entry]) => Boolean(entry?.[field]?.trim()))
      .map(([locale, entry]) => [locale, text(entry?.[field])]),
  );
  if (!source.trim() && Object.keys(translations).length === 0) return [];

  return [
    {
      key: `menu-section-${section.id || index}-${field}`,
      group: 'menuSections',
      ref: { target: 'menuSection', index, field },
      fieldLabel: field === 'name' ? 'menu_section_name' : 'editor_translations_field_menu_section_description',
      multiline: field === 'description',
      source,
      translations,
    },
  ];
}

export function buildMenuSectionTranslationSlots(
  sections: readonly TranslatableMenuSection[] | null | undefined,
): TranslationSlot[] {
  return (sections ?? []).flatMap((section, index) => [
    ...sectionSlot(section, index, 'name'),
    ...sectionSlot(section, index, 'description'),
  ]);
}
