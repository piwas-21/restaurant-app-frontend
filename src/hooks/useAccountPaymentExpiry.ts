'use client';

import { useEffect, useState } from 'react';
const EXPIRY_CHECK_INTERVAL_MS = 1000;

export function useAccountPaymentExpiry(expiresAt: string | null) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), EXPIRY_CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [expiresAt]);
  const expiry = expiresAt === null ? Number.NaN : Date.parse(expiresAt);
  return !Number.isFinite(expiry) || expiry <= now;
}
