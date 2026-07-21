'use client';

// Display-only tax calculation for the checkout review page (extracted from the
// page's inline effect). Baskets carry tax = 0 — tax is only computed on order
// creation in the backend — so the review page fetches the order-type's tax
// config and derives a display amount, falling back to the basket's tax value if
// the config fetch fails.
import { useState, useEffect } from 'react';
import type { OrderType } from '@/types/order';
import type { BasketDto } from '@/types/basket';
import { adminTaxConfigurationService, type TaxConfiguration } from '@/services/adminTaxConfigurationService';

export function useCheckoutTax(orderType: OrderType | null, basket: BasketDto | null | undefined) {
  const [taxConfig, setTaxConfig] = useState<TaxConfiguration | null>(null);
  const [taxAmount, setTaxAmount] = useState(0);

  useEffect(() => {
    const fetchTaxConfig = async () => {
      if (!orderType) return;

      try {
        const config = await adminTaxConfigurationService.getTaxForOrderType(orderType);
        setTaxConfig(config);

        if (config && basket) {
          const subtotal = basket.subTotal - (basket.discount || 0) - (basket.customerDiscount || 0);
          setTaxAmount(subtotal * (config.rate / 100));
        } else {
          setTaxAmount(0);
        }
      } catch (error) {
        console.warn('Failed to fetch tax configuration:', error);
        // Fall back to the basket's tax value if available.
        setTaxConfig(null);
        setTaxAmount(basket?.tax || 0);
      }
    };
    // fetchTaxConfig has its own try/catch (logs and falls back); fire-and-forget.
    void fetchTaxConfig();
  }, [orderType, basket]);

  return { taxConfig, taxAmount };
}
