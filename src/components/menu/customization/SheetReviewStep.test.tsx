import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import SheetReviewStep from './SheetReviewStep';
import type { CustomizationStep } from '@/utils/customizationSteps';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: Record<string, unknown>) => {
      const value =
        {
          offer_family_choose_mode: 'How would you like it?',
          offer_family_menu: 'Menu',
          offer_family_item_only: 'Item only',
          step_nothing_selected: 'None',
          step_change: 'Change',
          step_change_named: 'Change {{title}}',
          special_request_label: 'Special request',
          product_special_requests: 'Special Requests',
          customer_step_for_item: 'For {{item}}',
        }[key] ?? key;
      return Object.entries(options ?? {}).reduce(
        (translated, [name, replacement]) => translated.replaceAll(`{{${name}}}`, String(replacement)),
        value,
      );
    },
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

  it('shows an explicit recovery warning and keeps the section change link available', () => {
    const onJump = jest.fn();
    const step: CustomizationStep = {
      id: 'section:main',
      kind: 'section',
      title: 'Main',
      singleChoice: true,
      isRequired: true,
    };
    render(
      <SheetReviewStep
        rows={[{ step, values: [], warning: 'This saved choice needs to be selected again.' }]}
        onJump={onJump}
        specialInstructions=""
        onInstructionsChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('This saved choice needs to be selected again.');
    expect(screen.queryByText('step_nothing_selected')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button'));
    expect(onJump).toHaveBeenCalledWith(step);
  });

  it('labels component notes and keeps their owning item visible in the review term', () => {
    const step: CustomizationStep = {
      id: 'special:burger-row',
      kind: 'special',
      titleKey: 'product_special_requests',
      singleChoice: false,
      isRequired: false,
      component: { id: 'burger-row', productId: 'burger', productName: 'E2E Beef Burger' } as NonNullable<
        CustomizationStep['component']
      >,
    };

    const { container } = render(
      <SheetReviewStep
        rows={[{ step, values: [] }]}
        onJump={jest.fn()}
        specialInstructions=""
        onInstructionsChange={jest.fn()}
      />,
    );

    const term = container.querySelector('dt');
    expect(term).toBeInTheDocument();
    expect(term).toHaveTextContent('For E2E Beef Burger');
    expect(screen.getByText('E2E Beef Burger')).toHaveAttribute('dir', 'auto');
  });
});
