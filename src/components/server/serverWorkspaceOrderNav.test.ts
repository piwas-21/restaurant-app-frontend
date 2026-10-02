import { serverOrderNavItem } from './serverWorkspaceOrderNav';

describe('serverOrderNavItem', () => {
  const translate = (key: string) => key;

  it('shows Orders only when the amendment workspace flag is enabled', () => {
    expect(serverOrderNavItem(false, translate)).toEqual([]);
    expect(serverOrderNavItem(true, translate)).toEqual([{ href: '/server/orders', label: 'serverOrders.title' }]);
  });
});
