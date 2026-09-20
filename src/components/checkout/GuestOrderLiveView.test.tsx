import { render, screen } from '@testing-library/react';
import GuestOrderLiveView from './GuestOrderLiveView';

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

it('does not put the direct-flow preparation promise above an acknowledge cancellation', () => {
  render(
    <GuestOrderLiveView
      orderNumber="ORD-42"
      status={{
        orderNumber: 'ORD-42',
        type: 'Takeaway',
        status: 'Cancelled',
        estimatedDeliveryTime: null,
      }}
      config={{ flow: 'acknowledge', reviewWindowMinutes: 2 }}
      unavailable={false}
    />,
  );

  expect(screen.getByRole('heading', { name: 'The restaurant could not accept this order' })).toBeInTheDocument();
  expect(screen.queryByText(/will start preparing it shortly/i)).not.toBeInTheDocument();
  expect(screen.getByText('ORD-42')).toBeInTheDocument();
});
