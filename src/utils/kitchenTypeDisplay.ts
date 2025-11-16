/**
 * Kitchen Type Display Utilities
 *
 * Provides functions to get proper display names and styles for kitchen types
 */

import { KitchenType, KITCHEN_TYPES } from '@/types/menu';

/**
 * Get the display label for a kitchen type
 */
export function getKitchenTypeLabel(kitchenType: KitchenType | undefined): string {
  if (!kitchenType) return 'Not Assigned';
  return KITCHEN_TYPES[kitchenType]?.label || 'Unknown';
}

/**
 * Get background color for kitchen type chip
 */
export function getKitchenTypeColor(kitchenType: KitchenType | undefined): string {
  if (!kitchenType || kitchenType === 'None') return '#9CA3AF'; // gray
  if (kitchenType === 'FrontKitchen') return '#3B82F6'; // blue
  if (kitchenType === 'BackKitchen') return '#DC2626'; // red
  return '#9CA3AF';
}

/**
 * Get all kitchen type options for select dropdowns
 */
export function getKitchenTypeOptions(): Array<{ label: string; value: KitchenType }> {
  return Object.values(KITCHEN_TYPES);
}
