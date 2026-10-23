import { fireEvent, render, screen } from '@testing-library/react';
import type { MenuBundleItem } from '@/types/menu';
import WaiterBundleCustomization from './WaiterBundleCustomization';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, fallback?: string | object) => (typeof fallback === 'string' ? fallback : key),
  }),
}));
const bundle: MenuBundleItem = {
  id: 'menu',
  name: 'Menu',
  basePrice: 10,
  isActive: true,
  isAvailable: true,
  isSpecial: false,
  displayOrder: 0,
  menuDefinition: {
    id: 'definition',
    isAlwaysAvailable: true,
    availableMonday: true,
    availableTuesday: true,
    availableWednesday: true,
    availableThursday: true,
    availableFriday: true,
    availableSaturday: true,
    availableSunday: true,
    sections: [],
  },
};

it('prices and confirms the fixed replacement range while disabling quantity edits', () => {
  const onConfirm = jest.fn();
  render(
    <WaiterBundleCustomization bundle={bundle} isOpen onClose={jest.fn()} onConfirm={onConfirm} fixedQuantity={2} />,
  );
  expect(screen.getByRole('button', { name: '+' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '−' })).toBeDisabled();
  const confirm = screen.getByRole('button', { name: /Add to Order/ });
  expect(confirm).toHaveTextContent('20.00');
  fireEvent.click(confirm);
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2, unitPrice: 10 }));
});

it('keeps quantity edits available for added bundles', () => {
  const onConfirm = jest.fn();
  render(<WaiterBundleCustomization bundle={bundle} isOpen onClose={jest.fn()} onConfirm={onConfirm} />);
  fireEvent.click(screen.getByRole('button', { name: '+' }));
  fireEvent.click(screen.getByRole('button', { name: /Add to Order/ }));
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2, unitPrice: 10 }));
});
