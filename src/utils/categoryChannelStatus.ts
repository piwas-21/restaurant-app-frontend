import { OrderType } from '@/types/order';
import { ALL_ORDER_TYPES, maskFromOrderTypes, orderTypesFromMask } from './orderChannels';
import { orderTypeListLabel } from './orderTypeLabels';

/** The `t` shape these helpers need — key, fallback, optional interpolation. */
type Translate = (key: string, fallback: string, vars?: Record<string, string>) => string;

/** One category, reduced to what a mid-service toggle has to say about it. */
export interface CategoryChannelStatus {
  id: string;
  /** Already display-mapped — the caller resolves the translated category name. */
  name: string;
  /** Channels this category can be ordered through right now. */
  open: OrderType[];
  /** Channels it cannot. Empty means unrestricted. */
  closed: OrderType[];
  /**
   * Milliseconds since the category row was last written, or `null` when that cannot be stated.
   *
   * ⚠️ Two honest caveats, both deliberate. (1) The backend stores no "channel changed at" — the
   * only server-side timestamp is `Category.UpdatedAt`, which ANY edit to the row bumps (rename,
   * image, active flag). So this is "since the last change to this category": the same instant in
   * the overwhelmingly common case, and never a fabricated one. (2) It is measured against the
   * DEVICE clock, because `/api/tenant/today` publishes a date and nothing publishes tenant
   * time-of-day. A skewed till would misreport the age, so a negative age (device behind the
   * server) is reported as `null` rather than as "0 min".
   */
  closedForMs: number | null;
}

/** The category fields this module needs. Structural, so both the admin row type and the wire fit. */
export interface CategoryChannelInput {
  id: string;
  availableOrderTypes?: number | null;
  updatedAt?: string | null;
}

/** Parse an ISO instant into epoch ms, or `null` when it is absent or unparseable. */
function parseInstant(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || value === '') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Reduce one category to its channel status.
 *
 * `nowMs` is passed in rather than read here so every row of one render shares an instant, and so
 * the tests are not a race against the wall clock.
 */
export function categoryChannelStatus(
  category: CategoryChannelInput,
  name: string,
  nowMs: number,
): CategoryChannelStatus {
  const open = orderTypesFromMask(category.availableOrderTypes);
  const closed = ALL_ORDER_TYPES.filter((type) => !open.includes(type));

  const changedAt = parseInstant(category.updatedAt);
  const age = changedAt === null ? null : nowMs - changedAt;

  return {
    id: category.id,
    name,
    open,
    closed,
    closedForMs: closed.length > 0 && age !== null && age >= 0 ? age : null,
  };
}

/**
 * Whether one channel may be flipped to `next` without leaving the category orderable nowhere.
 *
 * Mask `0` is rejected by the API (`ValidOrderChannelMask` = null or 1..7) and renders as
 * "Available for: ." with no stateable reason, so the last open channel must not be one tap from
 * being lost. The admin matrix solves this with a disabled Save; a one-tap control has no Save, so
 * it has to refuse the tap itself.
 */
export function canSetChannel(mask: number | null | undefined, orderType: OrderType, next: boolean): boolean {
  if (next) return true;
  return orderTypesFromMask(mask).some((type) => type !== orderType);
}

/**
 * The mask to store when one channel is flipped. Collapses a full set to `null` — the CATEGORY
 * convention (`maskFromOrderTypes`), not the product one, where `null` means "inherit".
 */
export function maskWithChannel(mask: number | null | undefined, orderType: OrderType, next: boolean): number | null {
  const open = orderTypesFromMask(mask);
  const kept = ALL_ORDER_TYPES.filter((type) => (type === orderType ? next : open.includes(type)));
  return maskFromOrderTypes(kept);
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * "for 25 min" / "for 3 h" / "for 2 d", or `null` when there is nothing to state.
 *
 * Deliberately NOT an i18next `count` interpolation: `count` triggers plural resolution, and the
 * ten locales here include Arabic and Russian, whose plural categories would have to be authored
 * (and reviewed by a speaker) for three units. An abbreviation with a `{{value}}` placeholder says
 * the same thing in every one of them.
 */
export function closedForLabel(closedForMs: number | null, t: Translate): string | null {
  if (closedForMs === null || closedForMs < MINUTE_MS) return null;
  if (closedForMs < HOUR_MS) {
    return t('quick_channels_for_minutes', 'for {{value}} min', { value: String(Math.floor(closedForMs / MINUTE_MS)) });
  }
  if (closedForMs < DAY_MS) {
    return t('quick_channels_for_hours', 'for {{value}} h', { value: String(Math.floor(closedForMs / HOUR_MS)) });
  }
  return t('quick_channels_for_days', 'for {{value}} d', { value: String(Math.floor(closedForMs / DAY_MS)) });
}

/**
 * "Dürüm: closed to Dine In" — the sentence the plan insists on. "Dine-In: off" is meaningless
 * mid-service; the label has to name the category it is talking about.
 */
export function closedSentence(status: CategoryChannelStatus, t: Translate, language: string): string {
  return t('quick_channels_category_closed', '{{category}}: closed to {{orderTypes}}', {
    category: status.name,
    orderTypes: orderTypeListLabel(status.closed, (key, fallback) => t(key, fallback), language),
  });
}

/**
 * What the pinned trigger says without being opened. One closure states itself in full, including
 * how long it has been in place; several are listed by name rather than counted, which keeps the
 * copy free of plural rules and still names the categories.
 */
export function quickToggleSummary(statuses: CategoryChannelStatus[], t: Translate, language: string): string {
  const restricted = statuses.filter((status) => status.closed.length > 0);

  if (restricted.length === 0) {
    return t('quick_channels_all_open', 'All categories: every order type');
  }

  if (restricted.length === 1) {
    const since = closedForLabel(restricted[0].closedForMs, t);
    const sentence = closedSentence(restricted[0], t, language);
    return since === null ? sentence : `${sentence} · ${since}`;
  }

  return t('quick_channels_several_closed', '{{categories}}: order types limited', {
    categories: restricted.map((status) => status.name).join(', '),
  });
}
