import type { ProductDetails } from '@/app/admin/menu-management/interfaces';

export interface UseProductEditorFormOptions {
  product: ProductDetails;
  isBundle: boolean;
  mode?: 'create' | 'edit';
  onSaved: () => void;
}
