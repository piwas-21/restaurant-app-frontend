import { render, screen } from '@testing-library/react';
import { TableContextProvider, useTableContext } from './TableContext';

const STORAGE_KEY = 'rumi_table_context';

function Probe() {
  const { tableContext, hasTableContext } = useTableContext();
  return (
    <div>
      <span data-testid="tableId">{String(tableContext.tableId)}</span>
      <span data-testid="tableNumber">{String(tableContext.tableNumber)}</span>
      <span data-testid="qrScanned">{String(tableContext.qrScanned)}</span>
      <span data-testid="isOutdoor">{String(tableContext.isOutdoor)}</span>
      <span data-testid="has">{String(hasTableContext)}</span>
    </div>
  );
}

const renderWithStored = (raw: string | null) => {
  sessionStorage.clear();
  if (raw !== null) sessionStorage.setItem(STORAGE_KEY, raw);
  return render(
    <TableContextProvider>
      <Probe />
    </TableContextProvider>,
  );
};

/**
 * The catch in this provider is a deliberate ignore and stays one — a guest whose sessionStorage is
 * unavailable (Safari private browsing) or corrupt simply has no table scanned, which is the same
 * state as arriving without scanning and recovers by scanning again.
 *
 * What the E9 sweep found is that the catch was guarding the wrong thing. `JSON.parse` succeeding
 * does not mean the value is ours, and the result was fed straight into state — so the two cases
 * below never reached the catch at all, because neither one throws.
 */
describe('TableContext — what survives a bad stored value', () => {
  it('does not adopt a parsed `null` (which used to take the tree down)', () => {
    // `JSON.parse('null')` is `null`, so the state became null and the provider's own
    // `Boolean(tableContext.tableId)` threw during render.
    expect(() => renderWithStored('null')).not.toThrow();
    expect(screen.getByTestId('tableId')).toHaveTextContent('null');
    expect(screen.getByTestId('has')).toHaveTextContent('false');
  });

  it('fills the gaps in a partial stored object rather than replacing the state', () => {
    // A value written by an older shape used to REPLACE the state wholesale, so a field this
    // version added arrived `undefined` where a boolean is typed.
    renderWithStored(JSON.stringify({ tableId: 't1', tableNumber: '12' }));

    expect(screen.getByTestId('tableId')).toHaveTextContent('t1');
    expect(screen.getByTestId('tableNumber')).toHaveTextContent('12');
    expect(screen.getByTestId('qrScanned')).toHaveTextContent('false');
    expect(screen.getByTestId('isOutdoor')).toHaveTextContent('false');
  });

  it('ignores a primitive stored where an object belongs', () => {
    expect(() => renderWithStored('"just a string"')).not.toThrow();
    // `has` is false under the OLD code too (a string has no `.tableId`), so assert the state
    // itself: unguarded, `tableId` came back `undefined`; guarded, it is the default `null`.
    expect(screen.getByTestId('tableId')).toHaveTextContent('null');
    expect(screen.getByTestId('has')).toHaveTextContent('false');
  });

  it('falls back to the defaults when the value does not parse — the catch that is deliberate', () => {
    expect(() => renderWithStored('{not json')).not.toThrow();
    expect(screen.getByTestId('has')).toHaveTextContent('false');
  });

  it('restores a well-formed scan', () => {
    renderWithStored(
      JSON.stringify({ tableId: 't9', tableNumber: '9', qrScanned: true, isOutdoor: true, dineInPinned: true }),
    );

    expect(screen.getByTestId('tableId')).toHaveTextContent('t9');
    expect(screen.getByTestId('qrScanned')).toHaveTextContent('true');
    expect(screen.getByTestId('isOutdoor')).toHaveTextContent('true');
    expect(screen.getByTestId('has')).toHaveTextContent('true');
  });
});
