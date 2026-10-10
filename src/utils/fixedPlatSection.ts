import type { MenuSection } from '@/types/menu';

/**
 * Kebab d'Ilhan's fixed main-dish section is the French tenant-authored `Plat` section. It is
 * intentionally narrower than “one required option”: a one-option drink or a future single-choice
 * section must remain a normal picker until its own product decision says otherwise.
 */
export function isFixedPlatSection(section: MenuSection): boolean {
  const sourceName =
    'sourceName' in section && typeof section.sourceName === 'string' ? section.sourceName : section.name;
  return (
    sourceName.trim().toLocaleLowerCase() === 'plat' &&
    section.isRequired &&
    section.minSelection === 1 &&
    section.maxSelection === 1 &&
    section.items.length === 1
  );
}
