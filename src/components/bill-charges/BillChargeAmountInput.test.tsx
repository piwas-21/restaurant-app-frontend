import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import BillChargeAmountInput from './BillChargeAmountInput';
import { parseBillChargeAmount } from '@/lib/billChargeAmount';

function Harness() {
  const [amount, setAmount] = useState(0);
  return (
    <>
      <BillChargeAmountInput label="Service fee" currency="CHF" value={amount} onChange={setAmount} />
      <output>{amount}</output>
    </>
  );
}

it('allows zero to be deleted and keeps intermediate decimals while emitting numeric amounts', () => {
  render(<Harness />);
  const input = screen.getByRole('textbox', { name: 'Service fee' });
  expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: '0' } });
  fireEvent.change(input, { target: { value: '' } });
  expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: '3.' } });
  expect(input).toHaveValue('3.');
  fireEvent.change(input, { target: { value: '3.50' } });
  expect(input).toHaveValue('3.50');
  expect(screen.getByRole('status')).toHaveTextContent('3.5');
  fireEvent.change(input, { target: { value: '4,25' } });
  expect(input).toHaveValue('4,25');
  expect(screen.getByRole('status')).toHaveTextContent('4.25');
});

it('retains invalid input, reports validity, and accepts authoritative external changes', () => {
  const change = jest.fn();
  const validity = jest.fn();
  const view = render(
    <BillChargeAmountInput label="Fee" currency="EUR" value={5} onChange={change} onValidityChange={validity} />,
  );
  const input = screen.getByRole('textbox', { name: 'Fee' });
  fireEvent.change(input, { target: { value: '-2' } });
  expect(change).not.toHaveBeenCalled();
  expect(input).toHaveValue('-2');
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAccessibleDescription('billCharges.invalidAmount');
  expect(validity).toHaveBeenLastCalledWith(false);
  view.rerender(
    <BillChargeAmountInput label="Fee" currency="EUR" value={7} onChange={change} onValidityChange={validity} />,
  );
  expect(input).toHaveValue('7');
  expect(validity).toHaveBeenLastCalledWith(true);
});

it.each([
  ['', 0],
  ['.', 0],
  ['0.50', 0.5],
  ['10000', 10000],
  ['-1', null],
  ['1e2', null],
  ['1.001', null],
  ['10000.01', null],
  ['abc', null],
])('parses %s without silently accepting invalid amounts', (text, amount) => {
  expect(parseBillChargeAmount(String(text))).toBe(amount);
});

it('accepts percentage values through one hundred and rejects larger values', () => {
  const changed = jest.fn();
  const validity = jest.fn();
  render(
    <BillChargeAmountInput
      label="Percentage"
      currency="EUR"
      value={10}
      percentage
      onChange={changed}
      onValidityChange={validity}
    />,
  );
  const field = screen.getByRole('textbox', { name: 'Percentage' });
  fireEvent.change(field, { target: { value: '100' } });
  expect(changed).toHaveBeenLastCalledWith(100);
  fireEvent.change(field, { target: { value: '100.01' } });
  expect(validity).toHaveBeenLastCalledWith(false);
  expect(changed).toHaveBeenCalledTimes(1);
});
