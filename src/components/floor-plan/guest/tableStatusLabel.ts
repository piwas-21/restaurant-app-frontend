import type { TableRenderState } from '../sceneTypes';

/** The i18n `t` shape these helpers rely on (key, English fallback, interpolations). */
type Translate = (key: string, fallback: string, opts?: Record<string, unknown>) => string;

/**
 * Human status wording for a table on the guest map — shared by the hover card
 * and the List so both read identically (FLOOR-PLAN-REVAMP §4.2). A table too
 * small for the party spells out the mismatch rather than a bare "unavailable".
 */
export function tableStatusLabel(state: TableRenderState, maxGuests: number, party: number, t: Translate): string {
  if (state === 'booked') {
    return t('booked', 'Booked');
  }
  if (maxGuests < party) {
    return t('table_seats_party', 'Seats {{seats}}, you are {{party}}', { seats: maxGuests, party });
  }
  return t('available', 'Available');
}
