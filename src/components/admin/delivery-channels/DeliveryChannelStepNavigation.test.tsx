import { fireEvent, render, screen } from '@testing-library/react';
import DeliveryChannelStepNavigation from './DeliveryChannelStepNavigation';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe('DeliveryChannelStepNavigation', () => {
  it('keeps later steps unavailable until connection and menu review are ready', () => {
    render(
      <DeliveryChannelStepNavigation
        activeStep="connect"
        canReviewMenu={false}
        canPublish={false}
        onChange={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /deliveryChannels\.steps\.connect/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    expect(screen.getByRole('button', { name: /deliveryChannels\.steps\.menu/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /deliveryChannels\.steps\.publish/ })).toBeDisabled();
  });

  it('lets the operator return to a ready step', () => {
    const onChange = jest.fn();
    render(<DeliveryChannelStepNavigation activeStep="publish" canReviewMenu canPublish onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /deliveryChannels\.steps\.menu/ }));
    expect(onChange).toHaveBeenCalledWith('menu');
  });
});
