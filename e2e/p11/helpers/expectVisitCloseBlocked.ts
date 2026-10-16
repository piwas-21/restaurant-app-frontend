import { expect, request, type Page } from '@playwright/test';

export async function expectVisitCloseBlocked(page: Page, apiOrigin: string, token: string, sessionId: string) {
  await expect(page.getByRole('button', { name: 'Close visit', exact: true })).toHaveCount(0);
  const api = await request.newContext({
    baseURL: apiOrigin,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  try {
    const path = `/api/table-service-sessions/${encodeURIComponent(sessionId)}`;
    const response = await api.get(path);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      readonly success: boolean;
      readonly data: { readonly status: string; readonly canClose: boolean; readonly version: number };
    };
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ status: 'Open', canClose: false });
    expect(body.data.version).toBeGreaterThan(0);
    const close = await api.post(`${path}/close`, { data: { expectedVersion: body.data.version } });
    expect(close.status()).toBe(200);
    expect(await close.json()).toMatchObject({ success: false, errorCode: 'KitchenCorrectionUnresolved' });
    const retained = await api.get(path);
    expect(retained.status()).toBe(200);
    expect(await retained.json()).toMatchObject({
      success: true,
      data: { status: 'Open', version: body.data.version, canClose: false },
    });
  } finally {
    await api.dispose();
  }
}
