import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCategories, type Category, type Product } from '@/services/serverService';
import { getProducts } from '@/services/menuService';
import { getMenuBundleById } from '@/services/menuBundleService';
import { mapMenuProducts } from './menuProductMapper';
import type { MenuBundleItem } from '@/types/menu';

/** The waiter grid: ordinary products plus menu parents, never option-only components. */
export function useWaiterMenu() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProductForCustomization, setSelectedProductForCustomization] = useState<Product | null>(null);
  const [selectedBundleForCustomization, setSelectedBundleForCustomization] = useState<MenuBundleItem | null>(null);

  useEffect(() => {
    async function loadCategories() {
      try {
        setCategories((await getCategories()).filter((category) => category.isActive));
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
    void loadCategories();
  }, []);

  useEffect(() => {
    async function loadProducts() {
      try {
        setIsLoading(true);
        setError(null);
        // Menus are product parents on the staff POST path. Include them, but never components.
        const response = await getProducts(1, 100, selectedCategory || undefined, { includeMenus: true });
        setProducts(response.success && response.data?.items ? mapMenuProducts(response.data.items) : []);
      } catch (err) {
        console.error('Failed to load menu items:', err);
        setError('Failed to load menu items');
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    }
    void loadProducts();
  }, [selectedCategory]);

  const filteredProducts = useMemo(() => {
    const visible = products.filter((product) => product.isActive && product.isAvailable);
    if (!searchQuery) return visible;
    const query = searchQuery.toLowerCase();
    return visible.filter(
      (product) => product.name.toLowerCase().includes(query) || product.description?.toLowerCase().includes(query),
    );
  }, [products, searchQuery]);

  const handleProductClick = useCallback(async (product: Product) => {
    if (product.type.toLowerCase() !== 'menu') {
      setSelectedProductForCustomization(product);
      return;
    }

    try {
      setError(null);
      // The public bundle contract (`GET /api/Menus/{id}`), NOT `GET /api/Products/{id}`. The product
      // read projects a menu's option rows down to id/name/price — no `detailedIngredients`, no sauce
      // rule (`MenuSectionItemDto` vs `MenuBundleSectionItemDto`, backend #468) — so a fixed Plat
      // opened from it had nothing to customize, and the waiter's child row reached the server
      // without the recipe the guest's carries. Same contract the guest grid reads, so the two sheets
      // agree. No `requestedOrderType` is sent, so option availability resolves against "no channel
      // chosen" — permissive, which is what a till ringing in a dine-in order wants.
      const response = (await getMenuBundleById(product.id)) as { success?: boolean; data?: MenuBundleItem | null };
      const bundle = response.success && response.data ? response.data : null;
      if (!bundle) throw new Error('Menu definition was unavailable');
      setSelectedBundleForCustomization(bundle);
    } catch (err) {
      console.error('Failed to load menu bundle:', err);
      setError('Failed to load menu bundle');
    }
  }, []);

  return {
    products,
    categories,
    selectedCategory,
    setSelectedCategory,
    isLoading,
    error,
    setError,
    searchQuery,
    setSearchQuery,
    selectedProductForCustomization,
    setSelectedProductForCustomization,
    selectedBundleForCustomization,
    setSelectedBundleForCustomization,
    filteredProducts,
    handleProductClick,
  };
}
