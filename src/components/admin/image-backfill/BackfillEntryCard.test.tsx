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
  it('pairs the stored file with the candidate on a dry run', () => {
    render(<BackfillEntryCard entry={entry()} applied={false} />);
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('src', 'https://cdn.example/uploads/products/kebab.jpg');
    expect(images[1]).toHaveAttribute('src', 'https://cdn.example/uploads/_preview/products/kebab.jpg');
  });

  // The backend writes previewUrl ONLY on a dry run. Rendering a "pair" after an apply would
  // show one URL twice under two different captions — a fabricated comparison, shown at the
  // exact moment the operator most needs to trust the screen.
  it('shows ONE pane after an apply, never the same URL twice under two captions', () => {
    render(<BackfillEntryCard entry={entry({ previewUrl: null })} applied />);
    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);
    expect(screen.getByText(/this is the rewritten file/i)).toBeInTheDocument();
  });

  // Defence in depth, and deliberately UNREALISTIC input: the backend does not set previewUrl
  // on an applied run today. The guard exists so that a stale report left in state, or a
  // backend that starts returning one, cannot resurrect the fabricated pair. Without a case
  // that actually carries previewUrl AND applied, `!applied` is untested — verified by
  // mutation: removing it kept every other test green.
  it('still refuses to pair when an applied report somehow carries a previewUrl', () => {
    render(<BackfillEntryCard entry={entry()} applied />);
    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByText(/this is the rewritten file/i)).toBeInTheDocument();
  });

  it('cache-busts the applied image, which the preview step already loaded under its old bytes', () => {
    render(<BackfillEntryCard entry={entry({ previewUrl: null })} applied />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://cdn.example/uploads/products/kebab.jpg?v=400000');
  });

  it('shows one pane and says why when a dry run produced no candidate', () => {
    render(<BackfillEntryCard entry={entry({ previewUrl: null, outcome: 'skipped-no-gain' })} applied={false} />);

    const images = screen.getAllByRole('img');
    expect(images).toHaveLength(1);
    // Unchanged: no cache-bust, and the caption must quote the ORIGINAL dimensions, not the
    // resize the backend merely calculated and then discarded.
    expect(images[0]).toHaveAttribute('src', 'https://cdn.example/uploads/products/kebab.jpg');
    expect(screen.getByText(/this is the stored file, unchanged/i)).toBeInTheDocument();
    expect(screen.getByText(/4000×3000/)).toBeInTheDocument();
  });

  it('does not print a saving for an entry that was not changed', () => {
    render(
      <BackfillEntryCard
        entry={entry({ previewUrl: null, outcome: 'skipped-no-gain', bytesSaved: 0 })}
        applied={false}
      />,
    );
    expect(screen.queryByText(/−/)).not.toBeInTheDocument();
  });

  it('falls back to a warning tone for an outcome the backend added and this build does not know', () => {
    // Outcome is a plain string server-side. An unknown value must not render as the calm case.
    render(<BackfillEntryCard entry={entry({ outcome: 'quarantined' as never })} applied={false} />);
    expect(document.querySelector('.warning')).toBeInTheDocument();
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
    render(<BackfillEntryCard entry={entry({ previewUrl: null, outcome })} applied={false} />);
    expect(document.querySelector(`.${tone}`)).toBeInTheDocument();
  });
});
