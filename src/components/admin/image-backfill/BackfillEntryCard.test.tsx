import { render, screen } from '@testing-library/react';
import BackfillEntryCard from './BackfillEntryCard';
import type { ImageBackfillEntry } from '@/services/imageMaintenanceService';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, fallback?: string) => fallback ?? _k }),
}));

function entry(over: Partial<ImageBackfillEntry> = {}): ImageBackfillEntry {
  return {
    relativePath: 'products/kebab.jpg',
    originalUrl: 'https://cdn.example/uploads/products/kebab.jpg',
    previewUrl: 'https://cdn.example/uploads/_preview/products/kebab.jpg',
    originalWidth: 4000,
    originalHeight: 3000,
    originalBytes: 5_000_000,
    newWidth: 1600,
    newHeight: 1200,
    newBytes: 400_000,
    bytesSaved: 4_600_000,
    outcome: 'resized',
    ...over,
  };
}

describe('BackfillEntryCard', () => {
  it('shows the stored file on the left and the candidate on the right', () => {
    render(<BackfillEntryCard entry={entry()} />);
    const images = screen.getAllByRole('presentation', { hidden: true });
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('src', 'https://cdn.example/uploads/products/kebab.jpg');
    expect(images[1]).toHaveAttribute('src', 'https://cdn.example/uploads/_preview/products/kebab.jpg');
  });

  it('falls back to the original on the right when no candidate was written, and says so', () => {
    render(<BackfillEntryCard entry={entry({ previewUrl: null, outcome: 'skipped-no-gain' })} />);

    const images = screen.getAllByRole('presentation', { hidden: true });
    // Both panes deliberately show the same file — the note is what stops that reading as a bug.
    expect(images[1]).toHaveAttribute('src', 'https://cdn.example/uploads/products/kebab.jpg');
    expect(screen.getByText(/both panes show the stored file/i)).toBeInTheDocument();
  });

  it('does not print a saving for an entry that was not changed', () => {
    render(<BackfillEntryCard entry={entry({ previewUrl: null, outcome: 'skipped-no-gain', bytesSaved: 0 })} />);
    expect(screen.queryByText(/−/)).not.toBeInTheDocument();
  });

  // Asserted on the TONE, not on the label: the label comes from i18next, which the mock
  // controls, so a label assertion would be testing the mock. The tone is the component's own
  // decision and the thing that makes these visually distinguishable.
  it.each([
    ['resized', 'success'],
    ['skipped-no-gain', 'neutral'],
    ['skipped-unprocessable', 'warning'],
    // needs-review means the resize produced something that looked like a failed decode and was
    // deliberately NOT written — a file a human has to open. It must not read as a routine skip.
    ['needs-review', 'danger'],
    ['failed', 'danger'],
  ] as const)('renders %s with the %s tone', (outcome, tone) => {
    render(<BackfillEntryCard entry={entry({ previewUrl: null, outcome })} />);
    expect(document.querySelector(`.${tone}`)).toBeInTheDocument();
  });
});
