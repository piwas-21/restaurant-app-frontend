import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AppError from './error';
import NotFound from './not-found';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

describe('app/error.tsx', () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('replaces the crash with a page that says what happened and offers a way out', () => {
    render(<AppError error={new Error('boom')} reset={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });

  it('calls reset when the user retries', () => {
    const reset = jest.fn();
    render(<AppError error={new Error('boom')} reset={reset} />);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('keeps the real error in the console', () => {
    // The default Next boundary replaces it with a minified React message. Losing the
    // cause is what made the original report unreproducible, so this is the assertion
    // that matters most on this file.
    const error = new Error('the actual cause');
    render(<AppError error={error} reset={jest.fn()} />);

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('app/error.tsx'), error);
  });

  it('shows the digest when the error came from the server', () => {
    const error = Object.assign(new Error('boom'), { digest: '3627143001' });
    render(<AppError error={error} reset={jest.fn()} />);

    expect(screen.getByText(/3627143001/)).toBeInTheDocument();
  });

  it('shows no reference at all for a client-side error', () => {
    // A client error has no digest and no matching Sentry event, so printing the label
    // would promise a reference that support cannot look up.
    render(<AppError error={new Error('boom')} reset={jest.fn()} />);

    expect(screen.queryByText(/Reference/)).not.toBeInTheDocument();
  });
});

describe('app/not-found.tsx', () => {
  it('offers the two routes every tenant always has', () => {
    // Home and the menu are ungated (lib/modules.ts owns no entry for either), so a 404
    // cannot hand the user a link the module guard would then block.
    render(<NotFound />);

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'View the menu' })).toHaveAttribute('href', '/menu');
  });
});
