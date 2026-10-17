import { fireEvent, render, screen } from '@testing-library/react';
import SoundSelector from './SoundSelector';

jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const close = jest.fn();
const choose = jest.fn();
const testSound = jest.fn();
const props = {
  isOpen: true,
  onClose: close,
  soundType: 'chime' as const,
  onSoundTypeChange: choose,
  onTestSound: testSound,
  repeatUntilMouseMoves: false,
  onToggleRepeat: jest.fn(),
};
beforeEach(() => jest.clearAllMocks());
it('dismisses outside the sound choices and with Escape', () => {
  render(<SoundSelector {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'dismiss' }));
  expect(close).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(close).toHaveBeenCalledTimes(2);
});
it('allows testing without dismissing and choosing with dismissal', () => {
  render(<SoundSelector {...props} />);
  fireEvent.click(screen.getAllByRole('button', { name: 'staffSound.testNamed' })[0]);
  expect(testSound).toHaveBeenCalledWith('chime');
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'staffSound.bell' }));
  expect(choose).toHaveBeenCalledWith('bell');
  expect(close).toHaveBeenCalledTimes(1);
});
