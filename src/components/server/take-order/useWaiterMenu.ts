import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCategories, type Category, type Product } from '@/services/serverService';
import { getProductById, getProducts } from '@/services/menuService';
import { toBundleItemFromDetail } from '@/utils/catalogItem';
import { mapMenuProducts } from './menuProductMapper';
import type { DetailedProductResponse, MenuBundleItem } from '@/types/menu';

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
      const response = (await getProductById(product.id)) as DetailedProductResponse;
      const bundle = response.success && response.data ? toBundleItemFromDetail(response.data) : null;
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
