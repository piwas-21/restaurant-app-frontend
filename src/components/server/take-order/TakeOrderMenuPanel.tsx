import { formatPlainCurrency } from '@/utils/currency';
import { useTranslation } from 'react-i18next';
import { Product, Category } from '@/services/serverService';
import styles from './TakeOrderMenuPanel.module.css';

interface TakeOrderMenuPanelProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categories: Category[];
  selectedCategory: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  isLoading: boolean;
  filteredProducts: Product[];
  onProductClick: (product: Product) => void;
}

export default function TakeOrderMenuPanel({
  searchQuery,
  onSearchChange,
  categories,
  selectedCategory,
  onSelectCategory,
  isLoading,
  filteredProducts,
  onProductClick,
}: Readonly<TakeOrderMenuPanelProps>) {
  const { t } = useTranslation();

  return (
    <div className={styles.menuPanel}>
      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder={t('server.search_items', 'Search items...')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.categories}>
        <button
          className={`${styles.categoryButton} ${!selectedCategory ? styles.categoryActive : ''}`}
          onClick={() => onSelectCategory(null)}
        >
          {t('server.all', 'All')}
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            className={`${styles.categoryButton} ${selectedCategory === category.id ? styles.categoryActive : ''}`}
            onClick={() => onSelectCategory(category.id)}
          >
            {category.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <span>{t('server.loading_menu', 'Loading menu...')}</span>
        </div>
      ) : (
        <div className={styles.productGrid}>
          {filteredProducts.map((product) => (
            <button key={product.id} className={styles.productCard} onClick={() => onProductClick(product)}>
              <span className={styles.productName}>{product.name}</span>
              <span className={styles.productPrice}>{formatPlainCurrency(product.basePrice)}</span>
            </button>
          ))}
          {filteredProducts.length === 0 && !isLoading && (
            <div className={styles.noProducts}>{t('server.no_products', 'No products found')}</div>
          )}
        </div>
      )}
    </div>
  );
}
