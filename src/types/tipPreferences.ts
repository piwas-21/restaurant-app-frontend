export interface TipPreferences {
  readonly mode: 'percentage' | 'fixed';
  /** Fixed amounts use currency minor units. Percentages use whole percent values. */
  readonly values: readonly number[];
  readonly currency: string | null;
}
