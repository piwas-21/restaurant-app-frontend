import { useTenantLocaleRouter } from '@/hooks/useTenantLocaleRouter';
import type { TableServiceSessionDto } from '@/types/order';

/** Start through the table authority, then use its returned visit identity for the composer. */
export function useAddServerTableOrder(tableId: string, startTable: () => Promise<TableServiceSessionDto>) {
  const router = useTenantLocaleRouter();
  return async () => {
    try {
      const opened = await startTable();
      router.push(
        `/server/tables/${encodeURIComponent(tableId)}/order?serviceSessionId=${encodeURIComponent(opened.serviceSessionId)}`,
      );
    } catch (error: unknown) {
      // startTable stores the API error in the table workspace; retain that visible state.
      console.warn('Table ordering could not be opened', error);
    }
  };
}
