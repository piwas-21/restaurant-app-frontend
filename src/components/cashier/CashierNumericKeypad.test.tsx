import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import CashierNumericKeypad from './CashierNumericKeypad';

describe('CashierNumericKeypad', () => {
  it('appends digits, prevents duplicate decimals, and deletes safely', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <CashierNumericKeypad value="1.2" disabled={false} onChange={onChange} t={(key) => key} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(onChange).toHaveBeenCalledWith('1.23');
    fireEvent.click(screen.getByRole('button', { name: '.' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    rerender(<CashierNumericKeypad value="1.2" disabled={false} onChange={onChange} t={(key) => key} />);
    fireEvent.click(screen.getByRole('button', { name: 'cashier.collection.keypad_backspace' }));
    expect(onChange).toHaveBeenLastCalledWith('1.');
  });

  it('keeps every control disabled while a payment is pending', () => {
    render(<CashierNumericKeypad value="1" disabled onChange={jest.fn()} t={(key) => key} />);
    expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(true);
  });
});
