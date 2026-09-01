'use client';

import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPlainCurrency } from '@/utils/currency';
import BaseModal from '@/components/design-system/BaseModal';
import BundleSectionSelector from '@/components/menu/customization/BundleSectionSelector';
import SpecialRequestSection from '@/components/menu/customization/SpecialRequestSection';
import { useLinePrice } from '@/hooks/menu/useLinePrice';
import {
  bundleOptionKey,
  findBundleSelectionErrors,
  toggleBundleOption,
  updateBundleOption,
} from '@/utils/bundleSelection';
import type { MenuBundleItem, SelectedMenuOption } from '@/types/menu';
import { buildWaiterBundleDefaultSelection } from './take-order/waiterBundleSelection';
import styles from './ProductCustomization.module.css';

export interface WaiterBundleCustomizationResult {
  selectedOptions: SelectedMenuOption[];
  quantity: number;
  specialInstructions?: string;
  unitPrice: number;
}

interface WaiterBundleCustomizationProps {
  bundle: MenuBundleItem;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (result: WaiterBundleCustomizationResult) => void;
}

/**
 * The staff counterpart of the guest bundle sheet. It shares the selector, default-selection and
 * price rules, but returns a direct-order DTO shape instead of adding to a customer basket.
 */
export default function WaiterBundleCustomization({
  bundle,
  isOpen,
  onClose,
  onConfirm,
}: Readonly<WaiterBundleCustomizationProps>) {
  const { t, i18n } = useTranslation();
  const [selectedOptions, setSelectedOptions] = useState(() =>
    buildWaiterBundleDefaultSelection(bundle.menuDefinition.sections),
  );
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [expandedOptionKey, setExpandedOptionKey] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);
  const currentLanguage = (i18n.language || 'en').split('-')[0];
  const sections = bundle.menuDefinition.sections;
  const linePrice = useLinePrice({ kind: 'bundle', basePrice: bundle.basePrice, quantity, sections, selectedOptions });
  const errors = useMemo(() => findBundleSelectionErrors(sections, selectedOptions), [sections, selectedOptions]);
  const errorsBySection = new Map((showValidation ? errors : []).map((error) => [error.sectionId, error.minSelection]));

  const close = () => {
    setShowValidation(false);
    onClose();
  };
  const confirm = () => {
    if (errors.length > 0) {
      setShowValidation(true);
      return;
    }
    onConfirm({
      selectedOptions,
      quantity,
      specialInstructions: specialInstructions || undefined,
      unitPrice: linePrice.unitPrice,
    });
  };

  const footer = (
    <div className={styles.footerRow}>
      <div className={styles.quantityControl}>
        <button type="button" className={styles.qtyButton} onClick={() => setQuantity(Math.max(1, quantity - 1))}>
          −
        </button>
        <span className={styles.qtyValue}>{quantity}</span>
        <button type="button" className={styles.qtyButton} onClick={() => setQuantity(quantity + 1)}>
          +
        </button>
      </div>
      <button type="button" className={styles.confirmButton} onClick={confirm}>
        {t('server.add_to_order', 'Add to Order')} · {formatPlainCurrency(linePrice.total)}
      </button>
    </div>
  );

  return (
    <BaseModal isOpen={isOpen} onClose={close} title={bundle.name} size="lg" footer={footer}>
      {sections.map((section) => (
        <BundleSectionSelector
          key={section.id}
          section={section}
          selectedOptions={selectedOptions}
          minSelectionError={errorsBySection.get(section.id)}
          expandedOptionKey={expandedOptionKey}
          currentLanguage={currentLanguage}
          onToggleOption={(nextSection, itemId) => {
            setSelectedOptions((previous) => toggleBundleOption(nextSection, previous, itemId));
            setExpandedOptionKey((previous) =>
              previous === bundleOptionKey(nextSection.id, itemId) ? null : previous,
            );
          }}
          onToggleExpanded={(sectionId, itemId) => {
            const key = bundleOptionKey(sectionId, itemId);
            setExpandedOptionKey((previous) => (previous === key ? null : key));
          }}
          onCustomizationChange={(sectionId, itemId, patch) =>
            setSelectedOptions((previous) => updateBundleOption(previous, sectionId, itemId, patch))
          }
        />
      ))}
      <SpecialRequestSection specialInstructions={specialInstructions} onInstructionsChange={setSpecialInstructions} />
    </BaseModal>
  );
}
