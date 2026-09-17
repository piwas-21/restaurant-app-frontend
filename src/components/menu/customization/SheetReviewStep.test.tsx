import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SheetReviewStep from './SheetReviewStep';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) =>
      ({
        offer_family_choose_mode: 'How would you like it?',
        offer_family_meal: 'Meal',
        offer_family_item_only: 'Item only',
        step_nothing_selected: 'None',
        step_change: 'Change',
        step_change_named: 'Change {{title}}',
        special_request_label: 'Special request',
      })[key] ?? key,
  }),
}));

describe('SheetReviewStep offer-family mode', () => {
  it('keeps the selected Meal label in the existing review summary', () => {
    render(
      <SheetReviewStep
        rows={[]}
        offerMode="meal"
        onJump={jest.fn()}
        specialInstructions=""
        onInstructionsChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('offer-family-review-mode')).toHaveTextContent('How would you like it?Meal');
  });
});
