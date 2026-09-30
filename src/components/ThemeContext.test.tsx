import { fireEvent, render, screen } from '@testing-library/react';
import { useTheme, ThemeProvider } from './ThemeContext';

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return <button onClick={toggleTheme}>Theme: {theme}</button>;
}

describe('ThemeProvider with blocked browser storage', () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

  beforeEach(() => {
    const storageError = new Error('Browser storage is unavailable');
    storageError.name = 'SecurityError';
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get: () => {
        throw storageError;
      },
    });
  });

  afterEach(() => {
    if (storageDescriptor) {
      Object.defineProperty(window, 'localStorage', storageDescriptor);
    } else {
      Reflect.deleteProperty(window, 'localStorage');
    }
    document.documentElement.removeAttribute('data-theme');
    jest.restoreAllMocks();
  });

  it('keeps theme UI functional and reports storage refusal without surfacing its message', () => {
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    fireEvent.click(screen.getByRole('button', { name: 'Theme: light' }));

    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(screen.getByRole('button', { name: 'Theme: dark' })).toBeInTheDocument();
    expect(warning.mock.calls.map((call) => call.join(' ')).join(' ')).not.toContain('Browser storage is unavailable');
    expect(warning).toHaveBeenCalledWith(
      'Browser storage could not read theme preference (SecurityError); continuing without persistence.',
    );
    expect(warning).toHaveBeenCalledWith(
      'Browser storage could not persist theme preference (SecurityError); continuing without persistence.',
    );
  });
});
