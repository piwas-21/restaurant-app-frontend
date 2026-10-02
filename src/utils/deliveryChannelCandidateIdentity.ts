export const candidateIdentity = (productId: string, variationId: string | null) =>
  `${productId}::${variationId ?? ''}`;
