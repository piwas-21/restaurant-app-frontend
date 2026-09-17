'use client';

import { useTranslation } from 'react-i18next';
import CheckboxField from '@/components/design-system/CheckboxField';
import type { MenuLayout } from '@/types/restaurantInfo';
import type { BundlePresentationMode } from '@/types/menu/offerFamily';
import styles from './AppearanceTab.module.css';

/**
 * The Appearance tab's "Menu display" section (mcdoner partner request): the guest
 * menu's layout and whether the All tab also lists menu bundles. Presentational —
 * the tab owns the state and the full-upsert save through `appearanceCommand`.
 *
 * The layout control reuses the palette grid's radiogroup anatomy (same stylesheet):
 * two option cards, the chosen one outlined in the brand colour. The checkbox is a
 * `CheckboxField`, not a raw input — §3's mandatory wrapper for every new checkbox.
 */
export default function MenuDisplaySection({
  menuLayout,
  showBundlesOnAllTab,
  bundlePresentationMode,
  onLayoutChange,
  onBundlePresentationModeChange,
  onShowBundlesChange,
  disabled,
}: Readonly<{
  menuLayout: MenuLayout;
  showBundlesOnAllTab: boolean;
  bundlePresentationMode: BundlePresentationMode;
  onLayoutChange: (layout: MenuLayout) => void;
  onBundlePresentationModeChange: (mode: BundlePresentationMode) => void;
  onShowBundlesChange: (show: boolean) => void;
  disabled?: boolean;
}>) {
  const { t } = useTranslation();

  const layouts: Array<{ value: MenuLayout; labelKey: string; hintKey: string; fallback: string; hint: string }> = [
    {
      value: 'tabs',
      labelKey: 'menu_layout_tabs',
      hintKey: 'menu_layout_tabs_hint',
      fallback: 'Category tabs',
      hint: 'Guests switch between All items, Menu Bundles and one tab per category.',
    },
    {
      value: 'onepage',
      labelKey: 'menu_layout_onepage',
      hintKey: 'menu_layout_onepage_hint',
      fallback: 'One page',
      hint: 'All categories on one page; the category bar scrolls to each section.',
    },
  ];

  return (
    <section aria-labelledby="menu-display-heading" className={styles.menuDisplaySection}>
      <h3 id="menu-display-heading" className={styles.menuDisplayTitle}>
        {t('appearance_menu_display_title', 'Menu display')}
      </h3>
      <p className={styles.hint}>
        {t('appearance_menu_display_desc', 'Choose how guests browse your menu. Saved with the Appearance settings.')}
      </p>

      <div
        className={`${styles.grid} ${styles.layoutGrid}`}
        role="radiogroup"
        aria-label={t('menu_layout_title', 'Menu layout')}
      >
        {layouts.map((layout) => {
          const active = menuLayout === layout.value;
          return (
            <button
              key={layout.value}
              type="button"
              role="radio"
              aria-label={t(layout.labelKey, layout.fallback)}
              aria-checked={active}
              disabled={disabled}
              className={`${styles.option} ${styles.optionColumn} ${active ? styles.active : ''}`}
              onClick={() => onLayoutChange(layout.value)}
            >
              <span className={styles.optionLabel}>{t(layout.labelKey, layout.fallback)}</span>
              <span className={styles.optionHint}>{t(layout.hintKey, layout.hint)}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.menuDisplayCheckbox}>
        <h4 className={styles.menuDisplayTitle}>{t('menu_bundle_presentation_title', 'Bundle presentation')}</h4>
        <p className={styles.hint}>
          {t(
            'menu_bundle_presentation_desc',
            'Choose whether linked menu offers appear with their anchor item or in a separate bundle view.',
          )}
        </p>
        <div
          className={`${styles.grid} ${styles.layoutGrid}`}
          role="radiogroup"
          aria-label={t('menu_bundle_presentation_title', 'Bundle presentation')}
        >
          <button
            type="button"
            role="radio"
            aria-label={t('menu_bundle_presentation_legacy', 'Separate bundle view')}
            aria-checked={bundlePresentationMode === 'legacySeparate'}
            disabled={disabled}
            className={`${styles.option} ${styles.optionColumn} ${bundlePresentationMode === 'legacySeparate' ? styles.active : ''}`}
            onClick={() => onBundlePresentationModeChange('legacySeparate')}
          >
            <span className={styles.optionLabel}>{t('menu_bundle_presentation_legacy', 'Separate bundle view')}</span>
            <span className={styles.optionHint}>
              {t('menu_bundle_presentation_legacy_hint', 'Keep the technical Menu Bundles view for guests.')}
            </span>
          </button>
          <button
            type="button"
            role="radio"
            aria-label={t('menu_bundle_presentation_category', 'Offers in categories')}
            aria-checked={bundlePresentationMode === 'categoryOffers'}
            disabled={disabled}
            className={`${styles.option} ${styles.optionColumn} ${bundlePresentationMode === 'categoryOffers' ? styles.active : ''}`}
            onClick={() => onBundlePresentationModeChange('categoryOffers')}
          >
            <span className={styles.optionLabel}>{t('menu_bundle_presentation_category', 'Offers in categories')}</span>
            <span className={styles.optionHint}>
              {t('menu_bundle_presentation_category_hint', 'Show one card with an Item or Meal choice.')}
            </span>
          </button>
        </div>
      </div>

      {bundlePresentationMode === 'legacySeparate' && (
        <div className={styles.menuDisplayCheckbox}>
          <CheckboxField
            label={t('show_bundles_on_all_tab', 'Show menu bundles under All items')}
            description={t(
              'show_bundles_on_all_tab_hint',
              'Combos appear as their own group on the guest All items tab.',
            )}
            checked={showBundlesOnAllTab}
            onChange={onShowBundlesChange}
            disabled={disabled}
            data-testid="show-bundles-on-all-tab"
          />
        </div>
      )}
    </section>
  );
}
