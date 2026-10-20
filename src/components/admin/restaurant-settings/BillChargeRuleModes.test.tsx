import { fireEvent, render, screen } from '@testing-library/react';
import BillChargeRuleModes from './BillChargeRuleModes';
import type { BillChargeRule } from '@/types/billCharge';

it('lets an administrator independently choose a reduction and percentage', () => {
  const change = jest.fn();
  const rule: BillChargeRule = {
    key: 'custom',
    label: 'Custom',
    enabled: true,
    defaultAmount: 5,
    allowCustomAmount: true,
    orderTypes: ['DineIn'],
    roles: ['Server'],
  };
  const view = render(<BillChargeRuleModes rule={rule} disabled={false} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'billCharges.reduce' }));
  expect(change).toHaveBeenLastCalledWith({ ...rule, effect: 'Reduce' });
  view.rerender(<BillChargeRuleModes rule={{ ...rule, effect: 'Reduce' }} disabled={false} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'billCharges.percentage' }));
  expect(change).toHaveBeenLastCalledWith({ ...rule, effect: 'Reduce', calculation: 'Percentage' });
});
