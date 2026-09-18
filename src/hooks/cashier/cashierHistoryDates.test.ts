import { historyDateWindow } from './cashierHistoryDates';

describe('cashier history date windows', () => {
  it('uses the server-named tenant day for today and yesterday', () => {
    expect(historyDateWindow('today', '2026-03-09', '', '')).toEqual({ tenantDay: '2026-03-09' });
    expect(historyDateWindow('yesterday', '2026-03-09', '', '')).toEqual({ tenantDay: '2026-03-08' });
  });

  it('builds a tenant-day week as date-only tenant boundaries', () => {
    const window = historyDateWindow('week', '2026-03-11', '', '');
    expect(window).toEqual({ tenantStartDay: '2026-03-09', tenantEndDay: '2026-03-11' });
  });

  it('does not invent a date when the tenant day or custom range is invalid', () => {
    expect(historyDateWindow('today', undefined, '', '')).toEqual({});
    expect(historyDateWindow('custom', '2026-03-09', '2026-02-30', '2026-03-01')).toEqual({});
  });

  it('rejects a custom range whose end precedes its start', () => {
    expect(historyDateWindow('custom', undefined, '2026-03-04', '2026-03-03')).toEqual({});
  });

  it('keeps DST-boundary ranges as tenant calendar days instead of UTC instants', () => {
    expect(historyDateWindow('week', '2026-03-29', '', '')).toEqual({
      tenantStartDay: '2026-03-23',
      tenantEndDay: '2026-03-29',
    });
    expect(historyDateWindow('custom', undefined, '2026-10-25', '2026-10-26')).toEqual({
      tenantStartDay: '2026-10-25',
      tenantEndDay: '2026-10-26',
    });
  });

  it('passes the full custom range as date-only tenant boundaries', () => {
    const window = historyDateWindow('custom', undefined, '2026-03-01', '2026-03-03');
    expect(window).toEqual({ tenantStartDay: '2026-03-01', tenantEndDay: '2026-03-03' });
  });
});
