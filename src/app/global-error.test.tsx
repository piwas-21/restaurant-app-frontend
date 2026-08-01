import React from 'react';
import { render, screen } from '@testing-library/react';
import GlobalError from './global-error';

/**
 * `global-error.tsx` renders its own `<html>`/`<body>` because it REPLACES the root layout.
 * jsdom mounts that inside the testing-library container and React logs a nesting warning
 * for it — expected, and not what these tests are about, so `console.error` is stubbed
 * (which the log assertion below then reads).
 */
let consoleError: jest.SpyInstance;

beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('app/global-error.tsx', () => {
  it('renders without i18n, because the providers it would need are gone', () => {
    // The whole point of this file: it replaces the ROOT LAYOUT, so `ClientProviders` is
    // not mounted. Any `useTranslation` in here would throw inside the boundary that
    // exists to catch throwing — this test is what stops someone "fixing" the hardcoded
    // English later.
    render(<GlobalError error={new Error('layout blew up')} reset={jest.fn()} />);

    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('logs the error that took the layout down', () => {
    const error = new Error('layout blew up');
    render(<GlobalError error={error} reset={jest.fn()} />);

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('global-error.tsx'), error);
  });

  it('shows the digest when there is one', () => {
    const error = Object.assign(new Error('layout blew up'), { digest: '99887766' });
    render(<GlobalError error={error} reset={jest.fn()} />);

    expect(screen.getByText(/99887766/)).toBeInTheDocument();
  });
});
