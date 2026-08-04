import '@testing-library/jest-dom';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import ImageBackfillPage from './page';
import { imageMaintenanceService, type ImageBackfillReport } from '@/services/imageMaintenanceService';
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

jest.mock('@/components/admin/AdminAuthGuard', () => ({
  AdminAuthGuard: ({ children }: { children: ReactNode }) => <>{children}</>,
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

const emptyTotals: BackfillWindowTally = {
  filesScanned: 0,
  filesChanged: 0,
  filesSkipped: 0,
  filesFailed: 0,
  totalBytesSaved: 0,
};

const mockBackfill = {
  report: null as ImageBackfillReport | null,
  busy: null as 'preview' | 'continue' | 'apply' | 'clear' | null,
  error: null as string | null,
  notice: null as string | null,
  preview: jest.fn(),
  continueScan: jest.fn(),
  apply: jest.fn(),
  clearPreviews: jest.fn(),
  startOver: jest.fn(),
  applyEnabled: false,
  canContinue: false,
  resumed: false,
  passWindows: 0,
  passTotals: emptyTotals,
  passFinished: false,
};

/**
 * The hook is stubbed by default so each presentational rule can be pinned in isolation — but one
 * of them (the Continue button's in-flight label) depends on how the REAL hook sequences its
 * state, and a stub can be posed in combinations the real hook never produces. `mockUseRealHook`
 * flips the same mock over to the genuine implementation for those cases, with only the service
 * faked underneath.
 */
let mockUseRealHook = false;

jest.mock('@/services/imageMaintenanceService', () => ({
  MAX_FILES_PER_RUN: 500,
  imageMaintenanceService: {
    previewBackfill: jest.fn(),
    applyBackfill: jest.fn(),
    clearPreviews: jest.fn(),
  },
}));

jest.mock('@/hooks/admin/useImageBackfill', () => {
  const actual = jest.requireActual('@/hooks/admin/useImageBackfill');
  return { useImageBackfill: () => (mockUseRealHook ? actual.useImageBackfill() : mockBackfill) };
});

const mockPreview = imageMaintenanceService.previewBackfill as jest.MockedFunction<
  typeof imageMaintenanceService.previewBackfill
>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseRealHook = false;
  // The page awaits it before closing the dialog, so it has to settle like the real hook's does.
  mockBackfill.apply.mockResolvedValue(undefined);
  Object.assign(mockBackfill, {
    report: null,
    busy: null,
    error: null,
    notice: null,
    applyEnabled: false,
    canContinue: false,
    resumed: false,
    passWindows: 0,
    passTotals: emptyTotals,
    passFinished: false,
  });
});

describe('ImageBackfillPage', () => {
  it('opens with only the controls that can do something', () => {
    render(<ImageBackfillPage />);

    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Start over' })).not.toBeInTheDocument();
  });

  // The whole point of the cursor: a truncated window is no longer a dead end.
  it('offers Continue once the report on screen carries a cursor', () => {
    mockBackfill.report = report({ truncated: true, nextCursor: 'products/m.jpg' });
    mockBackfill.canContinue = true;
    render(<ImageBackfillPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(mockBackfill.continueScan).toHaveBeenCalledTimes(1);
  });

  // A pre-#280 backend truncates without a cursor. The page must then be exactly what it was —
  // a control that cannot work is worse than no control, because clicking it looks like progress.
  it('hides Continue when the server sent no cursor to continue from', () => {
    mockBackfill.report = report({ truncated: true, nextCursor: undefined });
    mockBackfill.canContinue = false;
    render(<ImageBackfillPage />);

    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
    expect(screen.getByText(/cannot continue past it/i)).toBeInTheDocument();
  });

  it('offers Start over only once the pass has left the first window', () => {
    mockBackfill.resumed = true;
    render(<ImageBackfillPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Start over' }));
    expect(mockBackfill.startOver).toHaveBeenCalledTimes(1);
  });

  it('shows the pass totals rather than only the window on screen', () => {
    mockBackfill.report = report({ truncated: true, nextCursor: 'products/z.jpg', filesScanned: 120 });
    mockBackfill.canContinue = true;
    mockBackfill.passWindows = 2;
    mockBackfill.passTotals = { ...emptyTotals, filesScanned: 620, filesChanged: 340 };
    render(<ImageBackfillPage />);

    expect(screen.getByText('Across 2 batches so far')).toBeInTheDocument();
    expect(screen.getByText('620')).toBeInTheDocument();
  });

  // The guard that must survive paging untouched: apply rewrites originals in place and the only
  // way back is the nightly backup, so it stays behind BOTH the dry-run gate and a typed word.
  it('keeps apply behind the type-to-confirm dialog', async () => {
    mockBackfill.report = report();
    mockBackfill.applyEnabled = true;
    render(<ImageBackfillPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(screen.getByText(/Overwrite the original images\?/i)).toBeInTheDocument();
    // Two "Apply" buttons now — the page's and the dialog's confirm. The confirm is inert until
    // the word is typed, so nothing has been requested yet.
    const confirm = screen.getAllByRole('button', { name: 'Apply' })[1];
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(mockBackfill.apply).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'APPLY' } });
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Apply' })[1]);
    });
    expect(mockBackfill.apply).toHaveBeenCalledTimes(1);
  });

  it('disables every action while a run is in flight', () => {
    mockBackfill.report = report({ truncated: true, nextCursor: 'products/m.jpg' });
    mockBackfill.canContinue = true;
    mockBackfill.resumed = true;
    mockBackfill.busy = 'continue';
    render(<ImageBackfillPage />);

    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Scanning…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear previews' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeDisabled();
  });

  // Driven through the REAL hook, because the state this asserts is one a stub can be posed in and
  // the hook cannot reach by accident: `continueScan` clears the report as it advances the cursor,
  // so `canContinue` is already false on the render that shows the in-flight label. Gating the
  // button on `canContinue` alone therefore unmounts it mid-request — leaving nothing on screen
  // for the length of a synchronous 500-image decode — and no stub-only test can see that.
  it('keeps the Continue control on screen, and labelled, for the whole of its own scan', async () => {
    mockUseRealHook = true;
    mockPreview.mockResolvedValueOnce(report({ truncated: true, nextCursor: 'products/m.jpg' }));
    let settle: (value: ImageBackfillReport) => void = () => {};
    mockPreview.mockReturnValueOnce(
      new Promise<ImageBackfillReport>((resolve) => {
        settle = resolve;
      }),
    );

    render(<ImageBackfillPage />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    });

    const inFlight = screen.getByRole('button', { name: 'Scanning…' });
    expect(inFlight).toBeDisabled();
    // The window's own report is gone — that is what disarms Apply for a window nobody previewed —
    // so this label is the only thing on the page saying work is happening.
    expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();

    await act(async () => {
      settle(report({ filesScanned: 120 }));
    });
    expect(screen.getByRole('button', { name: 'Clear previews' })).toBeEnabled();
  });

  it('surfaces the error and the notice the hook produced', () => {
    mockBackfill.error = 'storage unreachable';
    mockBackfill.notice = '7 preview file(s) removed.';
    render(<ImageBackfillPage />);

    expect(screen.getByText('storage unreachable')).toBeInTheDocument();
    expect(screen.getByText('7 preview file(s) removed.')).toBeInTheDocument();
  });

  it('says so when a window found nothing to change', () => {
    mockBackfill.report = report({ filesChanged: 0, entries: [] });
    render(<ImageBackfillPage />);

    expect(screen.getByText(/every stored image is already within the limits/i)).toBeInTheDocument();
  });

  it('renders a before/after card per entry in the window', () => {
    mockBackfill.report = report({
      entries: [
        {
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
        },
      ],
    });
    render(<ImageBackfillPage />);

    expect(screen.queryByText(/every stored image is already within the limits/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(2);
  });

  it('backing out of the confirm leaves the originals alone', () => {
    mockBackfill.report = report();
    mockBackfill.applyEnabled = true;
    render(<ImageBackfillPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText(/Overwrite the original images\?/i)).not.toBeInTheDocument();
    expect(mockBackfill.apply).not.toHaveBeenCalled();
  });

  it.each([
    ['preview', 'Preview'],
    ['apply', 'Apply'],
  ] as const)('replaces the %s label with its in-flight wording', (busy, idleLabel) => {
    mockBackfill.report = report();
    mockBackfill.applyEnabled = true;
    mockBackfill.busy = busy;
    render(<ImageBackfillPage />);

    expect(screen.queryByRole('button', { name: idleLabel })).not.toBeInTheDocument();
  });
});
