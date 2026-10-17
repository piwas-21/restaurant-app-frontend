'use client';
import { useCallback, useState } from 'react';
import { OrderType } from '@/types/order';
import type { CustomizationResult, ProductCustomizationDetail } from '@/components/catalog/productCustomizationTypes';
import type { Product } from '@/services/serverService';
import { getProductById } from '@/services/menuService';
import { addCustomizedItem, type OrderItem } from '@/components/catalog/orderItems';
import { decideProductTap } from '@/components/catalog/productTap';
import { getErrorMessage } from '@/utils/apiClient';
export function useServerTakeawayProduct(
  phase: string,
  mutate: (change: (current: OrderItem[]) => OrderItem[]) => void,
  setError: (error: string | null) => void,
) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [tapPendingId, setTapPendingId] = useState<string | null>(null);
  const tapProduct = useCallback(
    async (product: Product) => {
      if (tapPendingId !== null || phase !== 'idle') return;
      setTapPendingId(product.id);
      setError(null);
      try {
        const response = (await getProductById(product.id, undefined, OrderType.Takeaway)) as {
          success?: boolean;
          data?: ProductCustomizationDetail;
        };
        if (!response.success || !response.data || response.data.availability?.canOrder === false) {
          setError('server.takeaway.product_unavailable');
          return;
        }
        const decision = decideProductTap(response.data);
        if (decision.kind === 'sheet') setSelectedProduct(product);
        else mutate((current) => addCustomizedItem(current, product, decision.result));
      } catch (error: unknown) {
        setError(getErrorMessage(error) ?? 'server.takeaway.product_unavailable');
      } finally {
        setTapPendingId(null);
      }
    },
    [mutate, phase, setError, tapPendingId],
  );
  const confirmCustomization = useCallback(
    (result: CustomizationResult) => {
      const product = selectedProduct;
      if (!product) return;
      setSelectedProduct(null);
      mutate((current) => addCustomizedItem(current, product, result));
    },
    [mutate, selectedProduct],
  );
  return {
    selectedProduct,
    tapPendingId,
    tapProduct,
    confirmCustomization,
    closeCustomization: () => setSelectedProduct(null),
  };
}
