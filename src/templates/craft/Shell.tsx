'use client';

// craft template Shell (ADR-006, S15 T3 slice 2 — customer/staff split).
//
// Customer routes render craft's own chrome (./chrome/CustomerChrome:
// sticky letterpress header, hand-lettered wordmark, craft footer).
// Staff/admin routes render the SHARED app-internal-layout.tsx untouched:
// staff/admin is not templated in v1 (types.ts contract), so craft shows
// the exact same chrome there as classic does.
import { usePathname } from 'next/navigation';
import AppInternalLayout from '@/app/app-internal-layout';
import { isSharedChromeRoute } from '../shared-chrome';
import type { ShellProps } from '../types';
import CustomerChrome from './chrome/CustomerChrome';

export default function Shell({ children }: Readonly<ShellProps>) {
  const pathname = usePathname();
  if (isSharedChromeRoute(pathname)) {
    return <AppInternalLayout>{children}</AppInternalLayout>;
  }
  return <CustomerChrome>{children}</CustomerChrome>;
}
