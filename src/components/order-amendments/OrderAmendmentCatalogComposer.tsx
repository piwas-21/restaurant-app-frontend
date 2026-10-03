'use client';

import { useTranslation } from 'react-i18next';
import ProductCustomization, { type CustomizationResult } from '@/components/catalog/ProductCustomization';
import { addCustomizedItem, buildOrderItems, type OrderItem } from '@/components/catalog/orderItems';
import { buildBundleOrderItem } from '@/components/catalog/bundleOrderItems';
import TakeOrderMenuPanel from '@/components/server/take-order/TakeOrderMenuPanel';
import WaiterBundleCustomization, {
  type WaiterBundleCustomizationResult,
} from '@/components/server/WaiterBundleCustomization';
import { useWaiterMenu } from '@/components/server/take-order/useWaiterMenu';
import type { Product } from '@/services/serverService';
import type { OrderDto } from '@/types/order';
import type { OrderAmendmentDraft } from '@/hooks/orderAmendments/orderAmendmentTypes';
import { isNativeOrderType, updateOrderAmendmentChange } from './orderAmendmentDraft';
import styles from './OrderAmendmentEditStage.module.css';

interface OrderAmendmentCatalogComposerProps {
  readonly order: OrderDto;
  readonly draft: OrderAmendmentDraft;
  readonly onDraftChange: (draft: OrderAmendmentDraft) => void;
}

export default function OrderAmendmentCatalogComposer({
  order,
  draft,
  onDraftChange,
}: Readonly<OrderAmendmentCatalogComposerProps>) {
  const { t } = useTranslation();
  const menu = useWaiterMenu();
  const pendingReplacement = draft.changes.find((change) => change.kind === 'Replace' && !change.current);
  const currentOrderType = isNativeOrderType(order.type) ? order.type : undefined;
  const productForCustomization = menu.selectedProductForCustomization;
  const bundleForCustomization = menu.selectedBundleForCustomization;

  const selectedItem = (item: OrderItem) => {
    const requestItem = buildOrderItems([{ ...item, quantity: pendingReplacement?.quantity ?? item.quantity }])[0];
    if (pendingReplacement) {
      const change = draft.changes.find((candidate) => candidate.orderItemId === pendingReplacement.orderItemId);
      if (!change) return;
      onDraftChange(
        updateOrderAmendmentChange(draft, pendingReplacement.orderItemId, {
          ...change,
          current: requestItem,
        }),
      );
      return;
    }
    onDraftChange({ ...draft, additions: [...draft.additions, requestItem] });
  };

  const confirmProduct = (product: Product, result: CustomizationResult) => {
    selectedItem(addCustomizedItem([], product, result)[0]);
    menu.setSelectedProductForCustomization(null);
  };

  const confirmBundle = (result: WaiterBundleCustomizationResult) => {
    if (!bundleForCustomization) return;
    const product = menu.products.find((candidate) => candidate.id === bundleForCustomization.id);
    if (product) selectedItem(buildBundleOrderItem(product, bundleForCustomization, result));
    menu.setSelectedBundleForCustomization(null);
  };

  return (
    <>
      <section className={styles.stageSection} aria-labelledby="amendment-add-title">
        <div className={styles.sectionHeader}>
          <h3 id="amendment-add-title">
            {pendingReplacement
              ? t('orderAmendments.choose_replacement', 'Choose the replacement item')
              : t('orderAmendments.add_items', 'Add items')}
          </h3>
          {pendingReplacement && <span>{t('orderAmendments.replacement_for', 'Replacing selected units')}</span>}
        </div>
        <TakeOrderMenuPanel
          searchQuery={menu.searchQuery}
          onSearchChange={menu.setSearchQuery}
          categories={menu.categories}
          selectedCategory={menu.selectedCategory}
          onSelectCategory={menu.setSelectedCategory}
          isLoading={menu.isLoading}
          filteredProducts={menu.filteredProducts}
          onProductClick={(product) => void menu.handleProductClick(product)}
        />
        {menu.error && (
          <p className={styles.inlineError} role="alert">
            {t('orderAmendments.catalog_unavailable', 'The catalog item could not be opened.')}
          </p>
        )}
        {draft.additions.length > 0 && (
          <ul className={styles.additionList} aria-label={t('orderAmendments.draft_additions', 'New items to send')}>
            {draft.additions.map((item, index) => {
              const product = menu.products.find(
                (candidate) => candidate.id === item.productId || candidate.id === item.menuId,
              );
              return (
                <li key={`${item.productId ?? item.menuId ?? 'catalog'}-${index}`}>
                  <span>
                    {item.quantity}× {product?.name ?? t('orderAmendments.catalog_item', 'Catalog item')}
                  </span>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() =>
                      onDraftChange({
                        ...draft,
                        additions: draft.additions.filter((_, itemIndex) => itemIndex !== index),
                      })
                    }
                  >
                    {t('orderAmendments.remove_draft_item', 'Remove')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {productForCustomization && currentOrderType && (
        <ProductCustomization
          product={productForCustomization}
          isOpen
          onClose={() => menu.setSelectedProductForCustomization(null)}
          onConfirm={(result) => confirmProduct(productForCustomization, result)}
          requestedOrderType={currentOrderType}
        />
      )}
      {bundleForCustomization && (
        <WaiterBundleCustomization
          bundle={bundleForCustomization}
          isOpen
          onClose={() => menu.setSelectedBundleForCustomization(null)}
          onConfirm={confirmBundle}
        />
      )}
    </>
  );
}
