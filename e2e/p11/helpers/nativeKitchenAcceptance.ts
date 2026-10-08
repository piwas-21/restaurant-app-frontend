import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { openMenuBasket, proceedViaSidebarExpectingNavigation } from '../../helpers/menuBasket';
import type { TableAccountP11Fixture } from '../../seed/tableAccountP11';
import type {
  KitchenBoardCompletion,
  KitchenBoardCorrection,
  KitchenBoardOrder,
  KitchenBoardWorkFeed,
} from '@/types/kitchenBoard';

interface P11Response {
  json(): Promise<unknown>;
  ok(): boolean;
  status(): number;
}

interface ApiEnvelope<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errorCode?: string;
}

interface ServerTaskAction {
  readonly action: string;
  readonly allowed: boolean;
  readonly reasonCode: string | null;
}

export interface ServerTask {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly bucket: 'Ready' | 'Overdue' | 'Exception';
  readonly version: number;
  readonly permittedDeliveryActions: readonly ServerTaskAction[];
}

export interface NativeKitchenSnapshot {
  readonly orders: readonly KitchenBoardOrder[];
  readonly corrections: readonly KitchenBoardCorrection[];
  readonly completions: readonly KitchenBoardCompletion[];
}

export interface CreatedGuestRound {
  readonly id: string;
  readonly orderNumber: string;
  readonly serviceSessionId: string;
}

/** Financial removal keeps the frozen service record; cancel that unpaid work explicitly. */
export async function cancelFullyCreditedUnpaidOrder(api: APIRequestContext, orderId: string): Promise<void> {
  const order = await responseData<{
    readonly id: string;
    readonly version: number;
    readonly status: string;
    readonly total: number;
    readonly totalPaid: number;
    readonly remainingAmount: number;
    readonly billingCreditAmount: number;
  }>(await api.get(`/api/orders/${encodeURIComponent(orderId)}`), 'fully credited source readback');
  expect(order).toMatchObject({ id: orderId, status: 'Ready', totalPaid: 0, remainingAmount: 0 });
  expect(order.billingCreditAmount).toBe(order.total);
  expect(order.version).toBeGreaterThan(0);
  const cancelled = await responseData<{ readonly id: string; readonly status: string }>(
    await api.post(`/api/orders/${encodeURIComponent(orderId)}/cancel`, {
      data: {
        expectedVersion: order.version,
        cancellationReason: 'All unpaid units were removed and their billing credits resolved.',
      },
    }),
    'unpaid source cancellation',
  );
  expect(cancelled).toMatchObject({ id: orderId, status: 'Cancelled' });
}

async function responseData<T>(response: P11Response, label: string): Promise<T> {
  const body = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok() || body.success !== true || body.data === undefined) {
    throw new Error(`P11 ${label} was refused with HTTP ${response.status()}.`);
  }
  return body.data;
}

interface NativeKitchenCursors {
  readonly orders: string | null;
  readonly corrections: string | null;
  readonly completions: string | null;
}

function nativeKitchenFeedPath(cursors: NativeKitchenCursors): string {
  const query = new URLSearchParams({ pageSize: '100' });
  if (cursors.orders) query.set('ordersCursor', cursors.orders);
  if (cursors.corrections) query.set('correctionsCursor', cursors.corrections);
  if (cursors.completions) query.set('completionsCursor', cursors.completions);
  return `/api/staff/kitchen-board/work?${query.toString()}`;
}

/** Drains each protected work stream while replaying every current stream cursor unchanged. */
export async function readNativeKitchenSnapshot(api: APIRequestContext): Promise<NativeKitchenSnapshot> {
  const orders = new Map<string, KitchenBoardOrder>();
  const corrections = new Map<string, KitchenBoardCorrection>();
  const completions = new Map<string, KitchenBoardCompletion>();
  let cursors: NativeKitchenCursors = {
    orders: null,
    corrections: null,
    completions: null,
  };

  for (let page = 0; page < 50; page += 1) {
    const response = await api.get(nativeKitchenFeedPath(cursors));
    const feed = await responseData<KitchenBoardWorkFeed>(response, 'native kitchen work feed');

    for (const order of feed.orders.items) orders.set(order.orderId.toLowerCase(), order);
    for (const correction of feed.corrections.items) {
      corrections.set(correction.workItemId.toLowerCase(), correction);
    }
    for (const completion of feed.completions.items) {
      completions.set(`${completion.kind}:${completion.workItemId.toLowerCase()}`, completion);
    }

    const pages = [feed.orders, feed.corrections, feed.completions];
    if (pages.every((stream) => !stream.hasMore)) {
      return {
        orders: [...orders.values()],
        corrections: [...corrections.values()],
        completions: [...completions.values()],
      };
    }
    if (pages.some((stream) => stream.hasMore && !stream.nextCursor)) {
      throw new Error('P11 a native kitchen stream requested another page without a cursor.');
    }
    cursors = {
      orders: feed.orders.nextCursor,
      corrections: feed.corrections.nextCursor,
      completions: feed.completions.nextCursor,
    };
  }

  throw new Error('P11 native kitchen streams did not reach their terminal pages.');
}

export async function readServerTask(api: APIRequestContext, orderId: string): Promise<ServerTask> {
  const response = await api.get('/api/staff/server-workspace/tasks?pageSize=100');
  const feed = await responseData<{ readonly items: readonly ServerTask[]; readonly hasMore: boolean }>(
    response,
    'server work feed',
  );
  if (feed.hasMore) throw new Error('P11 server task proof exceeded the bounded single-page fixture.');
  const task = feed.items.find((item) => item.orderId.toLowerCase() === orderId.toLowerCase());
  if (!task) throw new Error('P11 expected server task was absent from the authoritative feed.');
  return task;
}

/** Submits a genuine guest basket round and verifies its active-visit auto-release. */
export async function addGuestBasketRound(
  guestPage: Page,
  api: APIRequestContext,
  table: TableAccountP11Fixture,
  serviceSessionId: string,
  admissionCode: string,
): Promise<CreatedGuestRound> {
  await guestPage.goto(`/en/scan?qr=${encodeURIComponent(table.qrCodeData)}`);
  await expect(guestPage.getByRole('heading', { name: 'Join this table visit' })).toBeVisible();
  await guestPage.getByLabel('Table visit code').fill(admissionCode);
  await guestPage.getByRole('button', { name: 'Join table', exact: true }).click();
  await expect(guestPage).toHaveURL(/\/en\/menu$/);

  const basketResponse = guestPage.waitForResponse(
    (response) =>
      /\/api\/Basket(?:\/|$)/i.test(new URL(response.url()).pathname) &&
      ['POST', 'PUT'].includes(response.request().method()),
  );
  await guestPage
    .getByTestId('menu-card')
    .filter({ hasText: 'E2E Test Product' })
    .getByRole('button', { name: 'Add E2E Test Product to order', exact: true })
    .click();
  await basketResponse;

  const basket = await openMenuBasket(guestPage);
  await proceedViaSidebarExpectingNavigation(guestPage, basket);
  await expect(guestPage.getByRole('heading', { name: 'Review this table round' })).toBeVisible();
  const roundResponse = await waitForGuestRound(guestPage, serviceSessionId);
  const account = await responseData<{
    readonly serviceSessionId: string;
    readonly orders: readonly {
      readonly orderId: string;
      readonly orderNumber: string;
      readonly status: string;
      readonly total: number;
    }[];
  }>(roundResponse, 'guest round submission');
  if (account.serviceSessionId.toLowerCase() !== serviceSessionId.toLowerCase()) {
    throw new Error('P11 guest basket response did not match the active visit.');
  }
  const guestOrders = account.orders.filter((order) => order.status === 'Confirmed' && order.total === 15);
  if (guestOrders.length !== 1) {
    throw new Error('P11 guest basket did not create one confirmed CHF 15 round in the active visit.');
  }
  const guestOrder = guestOrders[0];
  if (!guestOrder || !/^[0-9a-f-]{36}$/i.test(guestOrder.orderId)) {
    throw new Error('P11 guest round did not retain the seeded single-item CHF 15 order.');
  }

  const orderResponse = await api.get(`/api/orders/${encodeURIComponent(guestOrder.orderId)}`);
  const order = await responseData<{
    readonly id: string;
    readonly version: number;
    readonly status: string;
    readonly isKitchenReleased: boolean;
    readonly tableId: string | null;
    readonly serviceSessionId: string | null;
  }>(orderResponse, 'released guest order readback');
  if (
    order.id.toLowerCase() !== guestOrder.orderId.toLowerCase() ||
    order.tableId?.toLowerCase() !== table.tableId.toLowerCase() ||
    order.serviceSessionId?.toLowerCase() !== serviceSessionId.toLowerCase() ||
    order.status !== 'Confirmed' ||
    !order.isKitchenReleased ||
    order.version < 1
  ) {
    throw new Error('P11 guest order was not confirmed and released to the active visit kitchen.');
  }
  return {
    id: order.id,
    orderNumber: guestOrder.orderNumber,
    serviceSessionId,
  };
}

async function waitForGuestRound(page: Page, serviceSessionId: string) {
  const responsePromise = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === `/api/table-guest-visits/${serviceSessionId}/rounds` &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Add this round', exact: true }).click();
  return responsePromise;
}

export async function resolveUnpaidAmendmentCredit(
  api: APIRequestContext,
  orderId: string,
  amendmentId: string,
  expectedCreditMinor: number,
): Promise<void> {
  const historyResponse = await api.get(`/api/staff/orders/${encodeURIComponent(orderId)}/amendments`);
  const history = await responseData<
    readonly {
      readonly amendmentId: string;
      readonly financialResolution: {
        readonly currency: string | null;
        readonly potentialCreditMinor: number;
        readonly resolutionStatus: string;
      };
    }[]
  >(historyResponse, 'amendment financial history');
  const record = history.find((item) => item.amendmentId.toLowerCase() === amendmentId.toLowerCase());
  if (!record) throw new Error('P11 full-void amendment was absent from authoritative history.');
  expectPositiveUnpaidCredit(record.financialResolution, expectedCreditMinor);
  if (record.financialResolution.resolutionStatus === 'Resolved') return;
  if (record.financialResolution.resolutionStatus !== 'Pending') {
    throw new Error('P11 full-void amendment has an unexpected financial-resolution state.');
  }

  const basePath = `/api/staff/orders/${encodeURIComponent(orderId)}/amendments/${encodeURIComponent(amendmentId)}/financial-resolution`;
  const contextResponse = await api.get(`${basePath}/context`);
  const context = await responseData<{
    readonly expectedOrderVersion: number;
    readonly expectedAccountRevision: number | null;
    readonly currency: string;
    readonly creditMinor: number;
    readonly manualRefundCandidates: readonly unknown[];
  }>(contextResponse, 'unpaid amendment resolution context');
  if (
    context.currency !== 'CHF' ||
    context.creditMinor !== expectedCreditMinor ||
    context.manualRefundCandidates.length !== 0
  ) {
    throw new Error('P11 full-void context did not prove an unpaid CHF credit without tender candidates.');
  }

  const quoteRequest = {
    clientOperationId: crypto.randomUUID(),
    expectedOrderVersion: context.expectedOrderVersion,
    expectedAccountRevision: context.expectedAccountRevision,
    currency: context.currency,
    manualRefunds: [],
  };
  const quoteResponse = await api.post(`${basePath}/quote`, { data: quoteRequest });
  const quote = await responseData<{
    readonly orderId: string;
    readonly amendmentId: string;
    readonly clientOperationId: string;
    readonly quoteHash: string;
    readonly expiresAt: string;
    readonly currency: string;
    readonly creditMinor: number;
    readonly refundMinor: number;
    readonly unpaidWaivedMinor: number;
    readonly refundLegs: readonly unknown[];
  }>(quoteResponse, 'unpaid amendment resolution quote');
  if (
    quote.orderId.toLowerCase() !== orderId.toLowerCase() ||
    quote.amendmentId.toLowerCase() !== amendmentId.toLowerCase() ||
    quote.clientOperationId !== quoteRequest.clientOperationId ||
    quote.currency !== 'CHF' ||
    quote.creditMinor !== expectedCreditMinor ||
    quote.refundMinor !== 0 ||
    quote.unpaidWaivedMinor !== expectedCreditMinor ||
    quote.refundLegs.length !== 0 ||
    !quote.quoteHash ||
    Date.parse(quote.expiresAt) <= Date.now()
  ) {
    throw new Error('P11 resolution quote did not prove an unpaid-only waiver with no refund legs.');
  }

  const startResponse = await api.post(basePath, {
    data: { quote: quoteRequest, quoteHash: quote.quoteHash, expiresAt: quote.expiresAt },
  });
  const outcome = await responseData<{
    readonly outcome: string;
    readonly result?: {
      readonly state: string;
      readonly creditMinor: number;
      readonly refundMinor: number;
      readonly unpaidWaivedMinor: number;
      readonly refundLegs: readonly unknown[];
    };
  }>(startResponse, 'unpaid amendment resolution');
  if (
    outcome.outcome !== 'accepted' ||
    outcome.result?.state !== 'Resolved' ||
    outcome.result.creditMinor !== expectedCreditMinor ||
    outcome.result.refundMinor !== 0 ||
    outcome.result.unpaidWaivedMinor !== expectedCreditMinor ||
    outcome.result.refundLegs.length !== 0
  ) {
    throw new Error('P11 unpaid amendment resolution did not return the exact no-refund result.');
  }
}

export async function assertOrderAmendmentsSettled(api: APIRequestContext, orderId: string): Promise<void> {
  const response = await api.get(`/api/staff/orders/${encodeURIComponent(orderId)}/amendments`);
  const history = await responseData<
    readonly {
      readonly financialResolution: { readonly resolutionStatus: string };
    }[]
  >(response, 'amendment settlement history');
  if (
    history.length === 0 ||
    history.some((item) => !['Resolved', 'NotRequired'].includes(item.financialResolution.resolutionStatus))
  ) {
    throw new Error('P11 order still has unresolved amendment credit or refund work.');
  }
}

function expectPositiveUnpaidCredit(
  financial: {
    readonly currency: string | null;
    readonly potentialCreditMinor: number;
    readonly resolutionStatus: string;
  },
  expectedCreditMinor: number,
): void {
  if (
    financial.currency !== 'CHF' ||
    financial.potentialCreditMinor !== expectedCreditMinor ||
    !['Pending', 'Resolved'].includes(financial.resolutionStatus)
  ) {
    throw new Error('P11 full-void financial history did not match the expected CHF credit.');
  }
}

export { responseData };
