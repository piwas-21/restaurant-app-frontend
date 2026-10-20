import { fireEvent, render, screen } from '@testing-library/react';
import StaffButton from './StaffButton';

it('keeps a blocked action disabled and explains it on hover and alongside the action', () => {
  const onClick = jest.fn();
  render(
    <StaffButton disabledReason="Choose a replacement item first." onClick={onClick}>
      Get a quote
    </StaffButton>,
  );
  const button = screen.getByRole('button', { name: 'Get a quote' });
  expect(button).toBeDisabled();
  expect(button).toHaveAccessibleDescription('Choose a replacement item first.');
  expect(screen.getByText('Choose a replacement item first.')).toBeVisible();
  const wrapper = button.parentElement;
  expect(wrapper).toHaveAttribute('title', 'Choose a replacement item first.');
  expect(wrapper).not.toHaveAttribute('tabindex');
  fireEvent.click(button);
  expect(onClick).not.toHaveBeenCalled();
});

it('preserves existing descriptions when adding a disabled explanation', () => {
  render(
    <>
      <p id="extra-help">Reviewed price</p>
      <StaffButton aria-describedby="extra-help" disabledReason="Select an item.">
        Get a quote
      </StaffButton>
    </>,
  );
  expect(screen.getByRole('button', { name: 'Get a quote' })).toHaveAccessibleDescription(
    'Reviewed price Select an item.',
  );
});

it('runs an available action normally', () => {
  const onClick = jest.fn();
  render(<StaffButton onClick={onClick}>Get a quote</StaffButton>);
  fireEvent.click(screen.getByRole('button', { name: 'Get a quote' }));
  expect(onClick).toHaveBeenCalledTimes(1);
});
