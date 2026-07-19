import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { OrderFlowSidebarProps } from '@/components/order/OrderFlowSidebar';
import CraftOrderFlowSidebar from './CraftOrderFlowSidebar';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}));
jest.mock('./CraftCartContents', () => ({ __esModule: true, default: () => <div data-testid="craft-cart" /> }));

const followUp = { pickType: jest.fn() } as unknown as OrderFlowSidebarProps['followUp'];

describe('CraftOrderFlowSidebar', () => {
  it('renders the order-pad panel with a hand-lettered heading + contents', () => {
    render(<CraftOrderFlowSidebar followUp={followUp} />);
    expect(screen.getByRole('complementary', { name: 'Shopping Basket' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Shopping Basket' })).toBeInTheDocument();
    expect(screen.getByTestId('craft-cart')).toBeInTheDocument();
  });
});
