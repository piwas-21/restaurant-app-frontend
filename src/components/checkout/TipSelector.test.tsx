import { fireEvent, render, screen } from '@testing-library/react';
import TipSelector from './TipSelector';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

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
