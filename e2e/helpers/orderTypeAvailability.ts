import type { Page, APIRequestContext } from '@playwright/test';
import { apiBaseUrl } from './config';

/**
 * Fixture discovery + channel seeding for the per-order-type availability suite
 * (ORDER-TYPE-AVAILABILITY-PLAN §4.4).
 *
 * The suite is deliberately **environment-agnostic**: it asks the API which channels the restaurant
 * has enabled and which catalog rows are actually restricted, then skips whatever the environment
 * cannot demonstrate. That is what lets one spec run against a seeded local backend in CI *and*
 * against staging (classic) and demo (craft), whose data differ substantially — staging enables all
 * three channels with one Takeaway/Delivery-only category, demo enables only Takeaway.
 *
 * Hardcoding product names would have made it a staging-only script.
 */

export type Channel = 'DineIn' | 'Takeaway' | 'Delivery';

export const CHANNEL_LABEL: Record<Channel, string> = {
  DineIn: 'Dine In',
  Takeaway: 'Takeaway',
  Delivery: 'Delivery',
};

/** Declaration order — mirrors `ALL_ORDER_TYPES`, which drives chip ordering in the UI. */
const ALL_CHANNELS: Channel[] = ['DineIn', 'Takeaway', 'Delivery'];

interface ProductRow {
  id: string;
  name: string;
  availability?: { canOrder: boolean; reason: string; allowedOrderTypes: Channel[] };
}

/** A product the guest can order on `orderableOn` but NOT on `blockedOn`. */
export interface BlockedFixture {
  product: ProductRow;
  /** An enabled channel the server refuses for this item. */
  blockedOn: Channel;
  /** Enabled channels that CAN order it — empty when every one of them is switched off. */
  orderableOn: Channel[];
  /** The chip copy the UI must render, built the same way the app builds it. */
  expectedChipText: string;
}

async function json(request: APIRequestContext, url: string): Promise<Record<string, unknown>> {
  const res = await request.get(url);
  if (!res.ok()) throw new Error(`GET ${url} → ${res.status()}`);
  return (await res.json()) as Record<string, unknown>;
}

function items<T>(payload: Record<string, unknown>): T[] {
  return (((payload.data as Record<string, unknown>)?.items as T[]) ?? []) as T[];
}

export async function enabledChannels(request: APIRequestContext): Promise<Channel[]> {
  const payload = await json(request, `${apiBaseUrl()}/api/OrderTypeConfiguration/enabled`);
  return (payload.data as Channel[]) ?? [];
}

async function allProducts(request: APIRequestContext, channel?: Channel): Promise<ProductRow[]> {
  const q = `${apiBaseUrl()}/api/Products?Page=1&PageSize=100${channel ? `&RequestedOrderType=${channel}` : ''}`;
  return items<ProductRow>(await json(request, q));
}

/**
 * The English list phrasing the app produces via `Intl.ListFormat` — "Takeaway and Delivery".
 * Built here rather than asserted loosely so a regression in the interpolation is a failure, not a
 * substring that still happens to match.
 */
export function channelList(channels: Channel[]): string {
  const labels = channels.map((c) => CHANNEL_LABEL[c]);
  return new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(labels);
}

/**
 * Find a product that is genuinely blocked on some ENABLED channel.
 *
 * "Enabled" is the load-bearing qualifier: an item excluded only from channels the admin has
 * switched off is effectively unrestricted, the UI says nothing about it by design, and a test that
 * picked it would fail for the wrong reason.
 */
export async function findBlockedFixture(request: APIRequestContext): Promise<BlockedFixture | null> {
  const enabled = await enabledChannels(request);
  for (const blockedOn of ALL_CHANNELS.filter((c) => enabled.includes(c))) {
    const rows = await allProducts(request, blockedOn);
    const hit = rows.find((p) => p.availability?.canOrder === false && p.availability?.reason === 'WrongOrderType');
    if (!hit) continue;

    const allowed = hit.availability?.allowedOrderTypes ?? [];
    const orderableOn = ALL_CHANNELS.filter((c) => enabled.includes(c) && allowed.includes(c));
    return {
      product: hit,
      blockedOn,
      orderableOn,
      // Mirrors `useItemAvailabilityNotice`: an item whose every allowed channel is disabled has no
      // restriction it can state, so it falls back to the plain unavailable line.
      expectedChipText: orderableOn.length > 0 ? `${channelList(orderableOn)} only` : 'Unavailable',
    };
  }
  return null;
}

/** A product with no restriction to report on any enabled channel — the "renders nothing" control. */
export async function findUnrestrictedProduct(request: APIRequestContext): Promise<ProductRow | null> {
  const enabled = await enabledChannels(request);
  const rows = await allProducts(request);
  return (
    rows.find((p) => {
      const allowed = p.availability?.allowedOrderTypes ?? [];
      return enabled.every((c) => allowed.includes(c));
    }) ?? null
  );
}

/**
 * Put the browser in "this channel is chosen" before the app boots.
 *
 * Writing `OrderTypeContext`'s own persisted state rather than driving the sidebar toggle: picking a
 * channel through the UI opens a follow-up modal (table / address / contact) whose flows are already
 * covered by `order-type-followup.e2e.ts`, and re-driving them here would make every availability
 * assertion depend on an unrelated form. `chosenAt` must be fresh — the context expires a choice
 * after 24h and would silently hand back the no-channel state.
 *
 * Also pins the locale: accessible names come from translated copy, so the run must be `en`.
 */
export async function seedChannel(page: Page, channel: Channel | null): Promise<void> {
  await page.addInitScript(
    ({ ch }) => {
      window.localStorage.setItem('i18nextLng', 'en');
      if (ch === null) {
        window.localStorage.removeItem('rumi_order_type_state');
        return;
      }
      window.localStorage.setItem(
        'rumi_order_type_state',
        JSON.stringify({ orderType: ch, table: '', deliveryAddress: null, chosenAt: Date.now() }),
      );
    },
    { ch: channel },
  );
}
