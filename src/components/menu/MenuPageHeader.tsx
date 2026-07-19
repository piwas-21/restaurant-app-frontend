import { useTranslation } from 'react-i18next';

/**
 * The menu page's main heading, kept as a visually-hidden (sr-only) <h1> so the
 * page retains its top-level landmark + accessible name for screen readers while
 * the previous decorative fork-and-knife icon is no longer shown. The category
 * nav already signals "you're on the menu" and highlights the active section, so
 * a visible page heading here is redundant.
 */
export default function MenuPageHeader() {
  const { t } = useTranslation();

  return (
    <h1 id="menu-page-heading" className="sr-only">
      {t('menu_title', 'Our Menu')}
    </h1>
  );
}
