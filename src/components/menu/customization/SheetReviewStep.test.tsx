import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import SheetReviewStep from './SheetReviewStep';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) =>
      ({
        offer_family_choose_mode: 'How would you like it?',
        offer_family_menu: 'Menu',
        offer_family_item_only: 'Item only',
        step_nothing_selected: 'None',
        step_change: 'Change',
        step_change_named: 'Change {{title}}',
        special_request_label: 'Special request',
      })[key] ?? key,
  }),
}));

describe('SheetReviewStep offer-family mode', () => {
  it('keeps the selected Menu label in the existing review summary', () => {
    render(
      <SheetReviewStep
        rows={[]}
        offerMode="meal"
        onJump={jest.fn()}
        specialInstructions=""
        onInstructionsChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('offer-family-review-mode')).toHaveTextContent('How would you like it?Menu');
  });

  // Regression (mcdoner feedback, 2026-09-18): the item-only label was once picked by a
  // `language === 'fr'` branch that swapped the KEY behind i18next's back, so a French guest saw
  // “À la carte” where every other language saw their own item-only translation. The mock table
  // is language-independent ON PURPOSE: this passes only if the component never overrides it.
  it('labels the item-only mode through i18next, with no French-specific key override', () => {
    render(
      <SheetReviewStep
        rows={[]}
        offerMode="item"
        onJump={jest.fn()}
        specialInstructions=""
        onInstructionsChange={jest.fn()}
      />,
    );

    expect(screen.getByTestId('offer-family-review-mode')).toHaveTextContent('How would you like it?Item only');
  });
});
