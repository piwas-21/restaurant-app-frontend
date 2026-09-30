'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useServerTaskCount, type ServerTaskCountState } from '@/hooks/serverWorkspace/useServerTasks';
import { appPathname } from '@/lib/tenantLocaleRouting';

const DEFAULT_SUMMARY: ServerTaskCountState = {
  count: 0,
  connectionState: 'reconnecting',
  lastConfirmed: null,
  refresh: async () => undefined,
};

const ServerTaskContext = createContext<ServerTaskCountState>(DEFAULT_SUMMARY);

export function ServerTaskSummaryProvider({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const summary = useServerTaskCount(appPathname(pathname) !== '/server/tasks');
  return <ServerTaskContext.Provider value={summary}>{children}</ServerTaskContext.Provider>;
}

export function useServerTaskSummary(): ServerTaskCountState {
  return useContext(ServerTaskContext);
}
