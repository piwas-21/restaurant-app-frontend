import { fireEvent, render, screen } from '@testing-library/react';
import StaffTableTools from './StaffTableTools';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));

it('keeps controls hidden until opened, changes view and returns focus on Escape', () => {
  const change = jest.fn();
  render(
    <StaffTableTools
      view="map"
      onViewChange={change}
      onRefresh={jest.fn()}
      searchQuery=""
      onSearchChange={jest.fn()}
    />,
  );
  expect(screen.queryByRole('button', { name: 'List' })).not.toBeInTheDocument();
  const trigger = screen.getByRole('button', { name: 'Table tools' });
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'List' }));
  expect(change).toHaveBeenCalledWith('list');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});

it('locks all actions during a mutation and closes on an outside press', () => {
  render(
    <StaffTableTools
      view="map"
      disabled
      onViewChange={jest.fn()}
      onRefresh={jest.fn()}
      searchQuery=""
      onSearchChange={jest.fn()}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Table tools' }));
  expect(screen.getByRole('button', { name: 'Map' })).toBeDisabled();
  expect(screen.getByRole('searchbox')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'cashier.workspace.refresh' })).toBeDisabled();
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
});
