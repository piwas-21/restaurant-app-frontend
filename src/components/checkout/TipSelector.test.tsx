import { fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import TipSelector from './TipSelector';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

function BasketValidityHarness() {
  const [isValid, setIsValid] = useState(true);
  const [basketId, setBasketId] = useState(0);
  const [tip, setTip] = useState(0);
  const onValidityChange = useCallback((valid: boolean) => setIsValid(valid), []);
  const onTipChange = useCallback((amount: number) => setTip(amount), []);

  return (
    <div>
      <button type="button" onClick={() => setBasketId((current) => current + 1)}>
        Start new basket
      </button>
      <button type="submit" disabled={!isValid}>
        Submit
      </button>
      <TipSelector
        key={basketId}
        subtotal={15}
        selectedTipAmount={tip}
        onTipChange={onTipChange}
        onValidityChange={onValidityChange}
        currency="CHF"
        locale="en"
      />
    </div>
  );
}

it('prefills the selected percentage and lets staff replace it with the exact custom tip', () => {
  const onTipChange = jest.fn();
  const onValidityChange = jest.fn();
  render(
    <TipSelector
      subtotal={15}
      selectedTipAmount={0}
      onTipChange={onTipChange}
      onValidityChange={onValidityChange}
      currency="CHF"
      locale="en"
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: /10%/ }));
  const customTip = screen.getByLabelText('Enter custom tip amount');
  expect(customTip).toHaveValue('1.50');

  fireEvent.change(customTip, { target: { value: '1.25' } });

  expect(customTip).toHaveValue('1.25');
  expect(onTipChange).toHaveBeenLastCalledWith(1.25);
  expect(onValidityChange).toHaveBeenLastCalledWith(true);
});

it('restores parent validity when a new basket remounts after invalid custom input', () => {
  render(<BasketValidityHarness />);

  fireEvent.change(screen.getByLabelText('Enter custom tip amount'), { target: { value: '12.345' } });
  expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Start new basket' }));

  expect(screen.getByRole('button', { name: 'Submit' })).toBeEnabled();
});
