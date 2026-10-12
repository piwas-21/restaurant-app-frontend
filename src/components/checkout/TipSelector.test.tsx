import { fireEvent, render, screen } from '@testing-library/react';
import { useCallback, useState } from 'react';
import TipSelector from './TipSelector';

jest.mock('@/hooks/useRestaurantInfo', () => ({ useRestaurantInfo: () => ({ info: null }) }));

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

function InlineValidityHarness() {
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button type="button" onClick={() => setError('Terminaloffline')}>
        Show payment error
      </button>
      {error && <div role="alert">{error}</div>}
      <button type="submit" disabled={!isValid}>
        Submit
      </button>
      <TipSelector
        subtotal={15}
        selectedTipAmount={0}
        onTipChange={() => undefined}
        onValidityChange={(valid) => {
          setIsValid(valid);
          if (valid) setError(null);
        }}
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

it('does not clear a definitive payment error when an inline parent callback changes on rerender', () => {
  render(<InlineValidityHarness />);

  fireEvent.click(screen.getByRole('button', { name: 'Show payment error' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Terminaloffline');
});

it('does not report validity again for a render that keeps invalid state and callback unchanged', () => {
  const onValidityChange = jest.fn();
  const props = {
    subtotal: 15,
    selectedTipAmount: 0,
    onTipChange: jest.fn(),
    onValidityChange,
    currency: 'CHF',
    locale: 'en',
  } as const;
  const { rerender } = render(<TipSelector {...props} />);
  expect(onValidityChange).toHaveBeenCalledTimes(1);
  expect(onValidityChange).toHaveBeenLastCalledWith(true);

  rerender(<TipSelector {...props} />);

  expect(onValidityChange).toHaveBeenCalledTimes(1);
});

it('records fixed EUR presets without percentage calculation or rounding', () => {
  const change = jest.fn();
  render(
    <TipSelector
      subtotal={73.45}
      selectedTipAmount={0}
      onTipChange={change}
      currency="EUR"
      locale="fr"
      preferences={{ mode: 'fixed', values: [100, 200, 300, 400], currency: 'EUR' }}
    />,
  );
  expect(screen.queryByRole('button', { name: /10%/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /2,00/ }));
  expect(change).toHaveBeenLastCalledWith(2);
  fireEvent.click(screen.getByRole('button', { name: 'No Tip' }));
  expect(change).toHaveBeenLastCalledWith(0);
  expect(screen.getByRole('textbox', { name: 'Enter custom tip amount' })).toBeInTheDocument();
});

it('never offers fixed EUR presets on an older CHF account', () => {
  render(
    <TipSelector
      subtotal={50}
      selectedTipAmount={0}
      onTipChange={jest.fn()}
      currency="CHF"
      locale="en"
      preferences={{ mode: 'fixed', values: [100, 200, 300, 400], currency: 'EUR' }}
    />,
  );
  expect(screen.getAllByRole('button')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'No Tip' })).toBeInTheDocument();
});

it('uses configured percentages rather than the platform defaults', () => {
  const change = jest.fn();
  render(
    <TipSelector
      subtotal={100}
      selectedTipAmount={0}
      onTipChange={change}
      currency="EUR"
      locale="en"
      preferences={{ mode: 'percentage', values: [5, 8], currency: null }}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: /8%/ }));
  expect(change).toHaveBeenLastCalledWith(8);
  expect(screen.queryByRole('button', { name: /15%/ })).not.toBeInTheDocument();
});
