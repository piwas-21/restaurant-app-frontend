import { render, screen } from '@testing-library/react';
import BackfillSummary from './BackfillSummary';
import type { ImageBackfillReport } from '@/services/imageMaintenanceService';

// Handles both `t(key, 'fallback')` and `t(key, { defaultValue, ...interpolations })`, because
// this component uses both and the object form would otherwise reach React as a child object.
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

function report(over: Partial<ImageBackfillReport> = {}): ImageBackfillReport {
  return {
    applied: false,
    maxImageEdgePixels: 1600,
    imageQuality: 80,
    filesScanned: 500,
    filesChanged: 300,
    filesSkipped: 200,
    filesFailed: 0,
    totalOriginalBytes: 9000,
    totalNewBytes: 4000,
    totalBytesSaved: 5000,
    truncated: false,
    nextCursor: null,
    entries: [],
    ...over,
  };
}

describe('BackfillSummary', () => {
  it('says nothing about the limit when the walk reached the end', () => {
    render(<BackfillSummary report={report()} />);
    expect(screen.queryByText(/per-run limit/i)).not.toBeInTheDocument();
  });

  // The copy this replaces said the files past the cap "are not reachable from here", which was
  // true of the old backend and is now false. A truncated run that hands back a cursor has to
  // point at the way forward, or the screen still cannot finish the job it exists to do.
  it('points a truncated run at Continue when the server handed back a cursor', () => {
    render(<BackfillSummary report={report({ truncated: true, nextCursor: 'products/m.jpg' })} />);

    expect(screen.getByText(/Continue scans the next batch/i)).toBeInTheDocument();
    expect(screen.queryByText(/cannot continue past it/i)).not.toBeInTheDocument();
  });

  // The degradation path, and the reason the two messages are not one. The backend half of #280
  // is merged but unreleased, so prod truncates with NO cursor — there the old claim is the
  // TRUE one, and promising a Continue that cannot exist would be the same lie in reverse.
  it('admits a truncated run is the end of the road when the server sent no cursor', () => {
    render(<BackfillSummary report={report({ truncated: true, nextCursor: undefined })} />);

    expect(screen.getByText(/cannot continue past it/i)).toBeInTheDocument();
    expect(screen.queryByText(/Continue scans the next batch/i)).not.toBeInTheDocument();
  });

  it('labels the change count by tense — what WOULD change on a dry run, what was rewritten after', () => {
    const { rerender } = render(<BackfillSummary report={report()} />);
    expect(screen.getByText('Would change')).toBeInTheDocument();

    rerender(<BackfillSummary report={report({ applied: true })} />);
    expect(screen.getByText('Rewritten')).toBeInTheDocument();
  });

  // Tally's `default:` arm counts needs-review into FilesSkipped server-side, so the report's own
  // numbers describe the one outcome that needs a human as a routine skip.
  it('surfaces needs-review separately from the ordinary skips', () => {
    const entries = [
      { relativePath: 'a.jpg', outcome: 'needs-review' as const },
      { relativePath: 'b.jpg', outcome: 'skipped-no-gain' as const },
    ].map((partial) => ({
      originalUrl: '',
      previewUrl: null,
      originalWidth: 0,
      originalHeight: 0,
      originalBytes: 0,
      newWidth: 0,
      newHeight: 0,
      newBytes: 0,
      bytesSaved: 0,
      ...partial,
    }));

    render(<BackfillSummary report={report({ entries })} />);

    expect(screen.getByText(/need a human eye/i)).toBeInTheDocument();
    expect(screen.getByText('Needs review')).toBeInTheDocument();
  });

  it('warns about failures only when there were some', () => {
    const { rerender } = render(<BackfillSummary report={report()} />);
    expect(screen.queryByText(/could not be processed/i)).not.toBeInTheDocument();

    rerender(<BackfillSummary report={report({ filesFailed: 2 })} />);
    expect(screen.getByText(/could not be processed/i)).toBeInTheDocument();
  });
});
