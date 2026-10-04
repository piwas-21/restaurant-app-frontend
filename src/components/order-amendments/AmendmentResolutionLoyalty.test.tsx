import { render, screen, within } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider } from 'react-i18next';
import en from '@/locales/en.json';
import workspace from '@/locales/order-workspace/en.json';
import AmendmentResolutionLoyalty from './AmendmentResolutionLoyalty';
import type { AmendmentResolutionLoyaltyResult } from '@/schemas/amendmentResolutionLoyalty.schema';

const held: AmendmentResolutionLoyaltyResult = {
  state: 'HeldShortfall',
  awardPending: false,
  candidatePoints: 25,
  appliedAwardPoints: 25,
  suppressedPoints: 0,
  earnedClawbackPoints: 10,
  redemptionRestorationPoints: 6,
  postedClawbackPoints: 0,
  postedRestorationPoints: 0,
  availablePointsBeforeClawback: 3,
  clawbackShortfallPoints: 7,
};

async function show(value?: AmendmentResolutionLoyaltyResult | null) {
  const instance = i18next.createInstance();
  await instance.init({ lng: 'en', fallbackLng: false, resources: { en: { translation: { ...en, ...workspace } } } });
  return render(
    <I18nextProvider i18n={instance}>
      <AmendmentResolutionLoyalty value={value} />
    </I18nextProvider>,
  );
}

describe('staff loyalty settlement evidence', () => {
  it('shows no points panel for an older response without loyalty evidence', async () => {
    const { container } = await show(null);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows expected adjustments separately from zero actual postings during a hold', async () => {
    await show(held);
    expect(screen.getByText('Not enough available points')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('before checking this refund again');
    const expected = screen.getByText('Points to deduct').closest('div')!;
    const posted = screen.getByText('Points deducted').closest('div')!;
    expect(within(expected).getByText('10 points')).toBeVisible();
    expect(within(posted).getByText('0 points')).toBeVisible();
    expect(screen.queryByText('Points adjustment confirmed')).not.toBeInTheDocument();
    expect(screen.getByText('Missing points').closest('div')).toHaveTextContent('7 points');
  });

  it('distinguishes an unavailable original customer from a points shortfall', async () => {
    await show({ ...held, state: 'OwnerUnavailable', clawbackShortfallPoints: null });
    expect(screen.getByRole('alert')).toHaveTextContent('original customer record is unavailable');
    expect(screen.queryByText('Not enough available points')).not.toBeInTheDocument();
    expect(screen.queryByText('Missing points')).not.toBeInTheDocument();
  });

  it('renders exact settled postings and the singular points translation', async () => {
    await show({
      ...held,
      state: 'Resolved',
      postedClawbackPoints: 10,
      redemptionRestorationPoints: 1,
      postedRestorationPoints: 1,
      clawbackShortfallPoints: null,
    });
    expect(screen.getByText('Points adjustment confirmed')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Points restored').closest('div')).toHaveTextContent('1 point');
    expect(screen.getByText('Points deducted').closest('div')).toHaveTextContent('10 points');
  });
});
