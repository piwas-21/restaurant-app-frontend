import { fireEvent, render, screen } from '@testing-library/react';
import DeliveryChannelWorkspaceNavigation from './DeliveryChannelWorkspaceNavigation';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

afterEach(() => {
  document.documentElement.dir = '';
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
});

it('uses an accessible vertical tablist with keyboard section navigation', () => {
  const onChange = jest.fn();
  render(<DeliveryChannelWorkspaceNavigation activeSection="overview" onChange={onChange} />);

  const tablist = screen.getByRole('tablist', { name: 'deliveryChannels.workspace.navigation' });
  const overview = screen.getByRole('tab', { name: 'deliveryChannels.workspace.overview' });
  const connection = screen.getByRole('tab', { name: 'deliveryChannels.workspace.connection' });

  expect(tablist).toHaveAttribute('aria-orientation', 'vertical');
  fireEvent.keyDown(overview, { key: 'ArrowDown' });
  expect(onChange).toHaveBeenCalledWith('connection');
  expect(connection).toHaveFocus();
});

it('uses the forward visual arrow for mobile RTL navigation', () => {
  document.documentElement.dir = 'rtl';
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
  const onChange = jest.fn();
  render(<DeliveryChannelWorkspaceNavigation activeSection="overview" onChange={onChange} />);
  fireEvent(window, new Event('resize'));

  const tablist = screen.getByRole('tablist', { name: 'deliveryChannels.workspace.navigation' });
  const overview = screen.getByRole('tab', { name: 'deliveryChannels.workspace.overview' });
  const connection = screen.getByRole('tab', { name: 'deliveryChannels.workspace.connection' });

  expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
  fireEvent.keyDown(overview, { key: 'ArrowLeft' });
  expect(onChange).toHaveBeenCalledWith('connection');
  expect(connection).toHaveFocus();
});
