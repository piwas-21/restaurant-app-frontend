import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import LanguageSwitcher from './LanguageSwitcher';

let mockI18nState: { language: any; resolvedLanguage: any; changeLanguage: any; };

const mockUseTranslation = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => mockUseTranslation(), 
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, width, height }: { src: string; alt: string; width?: number; height?: number }) => {
    return <img src={src} alt={alt} width={width} height={height} />;
  },
}));

describe('LanguageSwitcher Component', () => {
  beforeEach(() => {
    mockI18nState = {
      language: 'en',
      resolvedLanguage: 'en',
      changeLanguage: jest.fn((lng) => {
        return new Promise((resolve) => {
          mockI18nState.language = lng;
          mockI18nState.resolvedLanguage = lng;
          resolve(undefined);
        });
      }),
    };
    mockUseTranslation.mockImplementation(() => ({
        i18n: mockI18nState,
        t: jest.fn((key) => key),
    }));
    localStorage.clear();
  });

  test('renders correctly with initial language (EN)', () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole('button', { name: /English EN/i })).toBeInTheDocument(); // Main toggle is a button
    expect(screen.getByAltText('English')).toHaveAttribute('src', '/flags/en.svg');
  });

  test('dropdown opens and closes on click', async () => {
    render(<LanguageSwitcher />);
    const dropdownButton = screen.getByRole('button', { name: /English EN/i }); // Main toggle is a button

    expect(screen.queryByRole('option', { name: /Deutsch Deutsch/i })).not.toBeInTheDocument();

    fireEvent.click(dropdownButton);
    await waitFor(() => expect(screen.getByRole('option', { name: /Deutsch Deutsch/i })).toBeVisible());
    expect(screen.getByRole('option', { name: /Türkçe Türkçe/i })).toBeVisible();

    fireEvent.click(dropdownButton);
    await waitFor(() => expect(screen.queryByRole('option', { name: /Deutsch Deutsch/i })).not.toBeInTheDocument());
  });

  test('changes language on selecting a language from dropdown and updates button', async () => {
    render(<LanguageSwitcher />);
    const initialButton = screen.getByRole('button', { name: /English EN/i }); // Main toggle is a button
    fireEvent.click(initialButton);

    await waitFor(() => expect(screen.getByRole('option', { name: /Deutsch Deutsch/i })).toBeVisible());
    const germanOption = screen.getByRole('option', { name: /Deutsch Deutsch/i });
    fireEvent.click(germanOption);

    await waitFor(() => {
        expect(mockI18nState.changeLanguage).toHaveBeenCalledWith('de');
    });
    expect(localStorage.getItem('i18nextLng')).toBe('de');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Deutsch DE/i })).toBeInTheDocument(); // Main toggle is a button
    });
    expect(screen.queryByRole('option', { name: /Deutsch Deutsch/i })).not.toBeInTheDocument();
  });

  test('displays the correct flag and name for a pre-set language (TR)', () => {
    mockI18nState.language = 'tr';
    mockI18nState.resolvedLanguage = 'tr';
    mockUseTranslation.mockImplementation(() => ({ 
        i18n: mockI18nState, 
        t: jest.fn(key => key) 
    }));

    render(<LanguageSwitcher />);
    
    expect(screen.getByRole('button', { name: /Türkçe TR/i })).toBeInTheDocument(); // Main toggle is a button
    expect(screen.getByAltText('Türkçe')).toHaveAttribute('src', '/flags/tr.svg');
  });

  test('closes dropdown when clicking outside', async () => {
    render(
      <div>
        <LanguageSwitcher />
        <div data-testid="outside-element">Outside</div>
      </div>
    );
    const dropdownButton = screen.getByRole('button', { name: /English EN/i }); // Main toggle is a button

    fireEvent.click(dropdownButton);
    await waitFor(() => expect(screen.getByRole('option', { name: /Deutsch Deutsch/i })).toBeVisible());

    fireEvent.mouseDown(screen.getByTestId('outside-element'));
    await waitFor(() => expect(screen.queryByRole('option', { name: /Deutsch Deutsch/i })).not.toBeInTheDocument());
  });
});
