'use client';

import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useOrderType } from '@/contexts/OrderTypeContext';
import { getProductById } from '@/services/menuService';
import { retainOrderableCustomizationSelections } from '@/utils/explicitCustomization';
import type { CustomizationGroupSelection, DetailedProduct } from '@/types/menu';
import type { OrderType } from '@/types/order';

interface UseOrderTypeProductRefreshArgs {
  isOpen: boolean;
  product: DetailedProduct | null;
  detailOrderType: OrderType | null | undefined;
  setProduct: Dispatch<SetStateAction<DetailedProduct | null>>;
  setSelections: Dispatch<SetStateAction<CustomizationGroupSelection[]>>;
  setDetailOrderType: Dispatch<SetStateAction<OrderType | null | undefined>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  notifyAddFailed: (error: unknown, fallbackKey?: string) => void;
}

/** Re-resolve nested product availability when the guest switches channels in an open sheet. */
export function useOrderTypeProductRefresh({
  isOpen,
  product,
  detailOrderType,
  setProduct,
  setSelections,
  setDetailOrderType,
  setIsLoading,
  notifyAddFailed,
}: Readonly<UseOrderTypeProductRefreshArgs>) {
  const { state: orderTypeState } = useOrderType();
  const productId = product?.id;
  const currentOrderTypeRef = useRef(orderTypeState.orderType);
  currentOrderTypeRef.current = orderTypeState.orderType;
  const requestTypeRef = useRef<OrderType | null | undefined>(undefined);
  const notifyAddFailedRef = useRef(notifyAddFailed);
  notifyAddFailedRef.current = notifyAddFailed;

  useEffect(() => {
    const requestedOrderType = orderTypeState.orderType;
    if (
      !isOpen ||
      !productId ||
      detailOrderType === requestedOrderType ||
      requestTypeRef.current === requestedOrderType
    ) {
      return;
    }

    requestTypeRef.current = requestedOrderType;
    let current = true;
    setIsLoading(true);
    getProductById(productId, undefined, requestedOrderType)
      .then((response) => {
        const detail = (response as { data?: DetailedProduct })?.data;
        if (!detail) throw new Error('Missing product detail');
        if (!current) return;
        setProduct(detail);
        setSelections((selections) => retainOrderableCustomizationSelections(detail, selections));
        setDetailOrderType(requestedOrderType);
      })
      .catch((error: unknown) => {
        if (!current) return;
        console.error('Error refreshing product for order type:', error);
        notifyAddFailedRef.current(error, 'error_loading_product');
      })
      .finally(() => {
        if (current) setIsLoading(false);
      });

    return () => {
      current = false;
      if (requestTypeRef.current === requestedOrderType) requestTypeRef.current = undefined;
    };
  }, [
    detailOrderType,
    isOpen,
    productId,
    orderTypeState.orderType,
    setDetailOrderType,
    setIsLoading,
    setProduct,
    setSelections,
  ]);

  return { currentOrderTypeRef, orderType: orderTypeState.orderType };
}
