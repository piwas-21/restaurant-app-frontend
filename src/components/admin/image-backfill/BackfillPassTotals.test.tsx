import { render, screen } from '@testing-library/react';
import BackfillPassTotals from './BackfillPassTotals';
import type { BackfillWindowTally } from '@/lib/imageBackfillProgress';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, second?: string | Record<string, unknown>) => {
      if (typeof second === 'string') return second;
      if (!second) return key;
      const options = second as { defaultValue?: string };
      return Object.entries(second).reduce(
        (text, [name, value]) => text.replace(`{{${name}}}`, String(value)),
        options.defaultValue ?? key,
      );
    },
  }),
}));

function totals(over: Partial<BackfillWindowTally> = {}): BackfillWindowTally {
  return {
    filesScanned: 620,
    filesChanged: 340,
    filesSkipped: 275,
    filesFailed: 5,
    totalBytesSaved: 5_900_000,
    ...over,
  };
}

describe('BackfillPassTotals', () => {
  // One window makes this an exact duplicate of the summary above it in different words, which is
  // worse than absent: two sets of identical numbers invite the reader to hunt for a difference.
  it.each([[0], [1]])('renders nothing for a %i-window pass', (windows) => {
    const { container } = render(<BackfillPassTotals windows={windows} totals={totals()} finished={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('adds up the whole pass once there is more than one window to add up', () => {
    render(<BackfillPassTotals windows={2} totals={totals()} finished={false} />);

    expect(screen.getByText('Across 2 batches so far')).toBeInTheDocument();
    expect(screen.getByText('620')).toBeInTheDocument();
    expect(screen.getByText('340')).toBeInTheDocument();
    // The decimal separator belongs to the RUNNER's locale, not to this test: `formatBytes`
    // localises the number on purpose (`5.6 MB` in en, `5,6 MB` in de/fr/nl), so a hardcoded
    // `5.6 MB` was asserting the ambient locale — green on a `C`/en CI runner and red on any
    // developer machine defaulting to a comma. What is being pinned here is the summed value and
    // its unit. (Found while adding the timezone environment in frontend #511: same family — an
    // assertion that reads the environment rather than the code.)
    expect(screen.getByText(/^5[.,]6 MB$/)).toBeInTheDocument();
  });

  // A pass mixes dry-run windows with applied ones, so the summary's two labels — "Would change"
  // and "Rewritten" — are each false of the total. The neutral wording is the point, not a
  // shortcut: a label claiming 340 images were rewritten when half the pass is still a preview
  // would tell the operator they are finished when nothing has been written.
  it('hedges both mutable totals, because a pass is neither wholly dry-run nor wholly applied', () => {
    render(<BackfillPassTotals windows={3} totals={totals()} finished={false} />);

    expect(screen.getByText('Changed or would change')).toBeInTheDocument();
    expect(screen.getByText('Saved or would save')).toBeInTheDocument();
    // The summary's two tenses, either of which would be a claim about the whole pass that half
    // of it contradicts. "Changed" bare is the same overclaim in shorter words.
    expect(screen.queryByText('Would change')).not.toBeInTheDocument();
    expect(screen.queryByText('Rewritten')).not.toBeInTheDocument();
    expect(screen.queryByText('Changed')).not.toBeInTheDocument();
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('says the scan is done only once it actually is', () => {
    const { rerender } = render(<BackfillPassTotals windows={2} totals={totals()} finished={false} />);
    expect(screen.queryByText(/end of the library/i)).not.toBeInTheDocument();

    rerender(<BackfillPassTotals windows={2} totals={totals()} finished />);
    expect(screen.getByText(/end of the library/i)).toBeInTheDocument();
  });
});
