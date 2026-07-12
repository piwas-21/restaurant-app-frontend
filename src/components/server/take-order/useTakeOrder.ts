import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  getCategories,
  createServerOrder,
  Product,
  Category,
  UserDto,
  calculateDiscountFromPoints,
} from '@/services/serverService';
import { getProducts } from '@/services/menuService';
import { CreateOrderItemDto } from '@/types/order';
import { CustomizationResult } from '../ProductCustomization';
import { OrderItem, mapMenuProducts, addCustomizedItem } from './orderItems';

interface UseTakeOrderParams {
  tableNumber: string;
  onClose: () => void;
  onOrderCreated: () => void;
}

/** State + behaviour for the take-order flow, consumed by the orchestrator + panels. */
export function useTakeOrder({ tableNumber, onClose, onOrderCreated }: UseTakeOrderParams) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductForCustomization, setSelectedProductForCustomization] = useState<Product | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  useEffect(() => {
    async function loadCategories() {
      try {
        const categoriesData = await getCategories();
        const activeCategories = categoriesData.filter((c) => c.isActive);
        setCategories(activeCategories);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    // loadCategories has its own try/catch (logs silently); fire-and-forget.
    void loadCategories();
  }, []);

  // Fetch products when category changes (filtering is done server-side)
  useEffect(() => {
    async function fetchProducts() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await getProducts(1, 100, selectedCategory || undefined);
        if (response.success && response.data?.items) {
          const mappedProducts = mapMenuProducts(response.data.items);
          setProducts(mappedProducts.filter((p) => p.isActive && p.isAvailable));
        } else {
          setProducts([]);
        }
      } catch (err) {
        console.error('Failed to load products:', err);
        setError('Failed to load menu items');
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    }
    // fetchProducts has its own try/catch (sets error state); fire-and-forget.
    void fetchProducts();
  }, [selectedCategory]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;

    const query = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query));
  }, [products, searchQuery]);

  const orderSubtotal = useMemo(() => {
    return orderItems.reduce((sum, item) => {
      return sum + item.unitPrice * item.quantity;
    }, 0);
  }, [orderItems]);

  const pointsDiscount = useMemo(() => {
    return calculateDiscountFromPoints(pointsToRedeem);
  }, [pointsToRedeem]);

  const orderTotal = useMemo(() => {
    return Math.max(0, orderSubtotal - pointsDiscount);
  }, [orderSubtotal, pointsDiscount]);

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProductForCustomization(product);
  }, []);

  const handleCustomizationConfirm = useCallback(
    (result: CustomizationResult) => {
      const product = selectedProductForCustomization;
      if (!product) return;
      setOrderItems((prev) => addCustomizedItem(prev, product, result));
      setSelectedProductForCustomization(null);
    },
    [selectedProductForCustomization],
  );

  const handleUserSelect = useCallback((user: UserDto | null) => {
    setSelectedUser(user);
    setPointsToRedeem(0); // Reset points when user changes
  }, []);

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      setOrderItems((prev) => prev.filter((_, i) => i !== index));
    } else {
      setOrderItems((prev) => {
        const updated = [...prev];
        updated[index].quantity = quantity;
        return updated;
      });
    }
  };

  const removeItem = (index: number) => {
    setOrderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (orderItems.length === 0) {
      setError('Please add at least one item to the order');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const items: CreateOrderItemDto[] = orderItems.map((item) => ({
        productId: item.product.id,
        productVariationId: item.variationId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        specialInstructions: item.notes,
        // Note: excludedIngredients, addedIngredients, sideItems would need backend support
      }));

      await createServerOrder(
        parseInt(tableNumber, 10),
        items,
        customerName || undefined,
        orderNotes || undefined,
        selectedUser?.id,
        pointsToRedeem > 0 ? pointsToRedeem : undefined,
      );

      onOrderCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create order:', err);
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    products,
    categories,
    selectedCategory,
    setSelectedCategory,
    orderItems,
    customerName,
    setCustomerName,
    orderNotes,
    setOrderNotes,
    isLoading,
    isSubmitting,
    error,
    searchQuery,
    setSearchQuery,
    selectedProductForCustomization,
    setSelectedProductForCustomization,
    selectedUser,
    handleUserSelect,
    pointsToRedeem,
    setPointsToRedeem,
    filteredProducts,
    orderSubtotal,
    orderTotal,
    handleProductClick,
    handleCustomizationConfirm,
    updateQuantity,
    removeItem,
    handleSubmit,
  };
}
