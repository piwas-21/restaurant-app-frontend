'use client';

import type { ReactNode } from 'react';
import { useTableGuestFeature } from '@/contexts/TableGuestFeatureContext';

export default function ScanTableGuestFeatureReader({
  children,
}: Readonly<{
  children: (feature: ReturnType<typeof useTableGuestFeature>) => ReactNode;
}>) {
  return children(useTableGuestFeature());
}
