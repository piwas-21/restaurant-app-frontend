import { OrderType } from '@/types/order';

/**
 * The tax form's own shape, separate from the hook that drives it.
 *
 * Split out when `useTaxConfigurations` crossed the CLAUDE.md §4 hook ceiling (200 LOC). The form
 * modal already imported `TaxFormData` from the hook purely to type its props, which meant a
 * presentational component depending on a data-access module for a plain record — this is the
 * boundary that was always implied.
 */
export interface TaxFormData {
  name: string;
  rate: number;
  isEnabled: boolean;
  description: string;
  applicableOrderTypes: OrderType[];
}

export const INITIAL_TAX_FORM: TaxFormData = {
  name: '',
  rate: 0,
  isEnabled: false,
  description: '',
  applicableOrderTypes: [],
};
