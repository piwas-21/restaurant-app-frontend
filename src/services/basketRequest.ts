import type { AddToBasketDto } from '@/types/basket';
import type { SelectedMenuOption } from '@/types/menu';

export type AddToBasketInput = Omit<AddToBasketDto, 'selectedMenuOptions'> & {
  /** The UI may retain the read-side modifier for local price calculations. */
  selectedMenuOptions?: Array<SelectedMenuOption>;
};

/** Strip read-side variation pricing; the server resolves it from the variation id. */
export function toAddToBasketRequest(item: AddToBasketInput): AddToBasketDto {
  const { selectedMenuOptions, ...rest } = item;
  return {
    ...rest,
    ...(selectedMenuOptions
      ? {
          selectedMenuOptions: selectedMenuOptions.map((option) => {
            const { productVariationPriceModifier: _ignored, ...requestOption } = option;
            return requestOption;
          }),
        }
      : {}),
  };
}
