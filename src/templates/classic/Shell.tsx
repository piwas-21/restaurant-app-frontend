'use client';

// classic template Shell (ADR-006, S15 T3 slice 2 — customer/staff split).
//
// Customer routes render the template-owned chrome (./chrome/CustomerChrome,
// a verbatim extraction of app-internal-layout.tsx's customer path — zero
// visual delta is the gate). Staff/admin routes render the SHARED
// app-internal-layout.tsx untouched: staff/admin is not templated in v1
// (types.ts contract), so every template shows the identical chrome there.
import { usePathname } from 'next/navigation';
import AppInternalLayout from '@/app/app-internal-layout';
import { isSharedChromeRoute } from '../shared-chrome';
import type { ShellProps } from '../types';
import CustomerChrome from './chrome/CustomerChrome';

export default function Shell({ children }: ShellProps) {
  const pathname = usePathname();
  if (isSharedChromeRoute(pathname)) {
    return <AppInternalLayout>{children}</AppInternalLayout>;
  }
  return <CustomerChrome>{children}</CustomerChrome>;
}
