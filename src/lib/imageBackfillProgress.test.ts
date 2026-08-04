import { FIRST_WINDOW_KEY, recordWindow, summarizePass, type BackfillPass } from './imageBackfillProgress';
import type { ImageBackfillReport } from '@/services/imageMaintenanceService';

function report(over: Partial<ImageBackfillReport> = {}): ImageBackfillReport {
  return {
    applied: false,
    maxImageEdgePixels: 1600,
    imageQuality: 80,
    filesScanned: 500,
    filesChanged: 300,
    filesSkipped: 190,
    filesFailed: 10,
    totalOriginalBytes: 9000,
    totalNewBytes: 4000,
    totalBytesSaved: 5000,
    truncated: true,
    nextCursor: 'products/m.jpg',
    entries: [],
    ...over,
  };
}

describe('imageBackfillProgress', () => {
  it('files the first window under the empty key, which no relative path can collide with', () => {
    const pass = recordWindow({}, null, report());
    expect(Object.keys(pass)).toEqual([FIRST_WINDOW_KEY]);
    expect(pass[FIRST_WINDOW_KEY].filesScanned).toBe(500);
  });

  it('adds up every window in the pass', () => {
    let pass: BackfillPass = recordWindow({}, null, report());
    pass = recordWindow(
      pass,
      'products/m.jpg',
      report({ filesScanned: 300, filesChanged: 100, totalBytesSaved: 2000 }),
    );

    expect(summarizePass(pass)).toEqual({
      windows: 2,
      totals: {
        filesScanned: 800,
        filesChanged: 400,
        filesSkipped: 380,
        filesFailed: 20,
        totalBytesSaved: 7000,
      },
    });
  });

  // The reason the pass is a map and not a running sum. Every window is run at least twice — the
  // dry run that shows the pairs, then the apply that rewrites them — and both report the same
  // ~500 files. A naive accumulator turns a 500-image library into "1000 scanned", which is the
  // number an operator would use to decide they are finished when they are half done.
  it('replaces a window when it is run again, so previewing then applying counts it ONCE', () => {
    let pass: BackfillPass = recordWindow({}, null, report({ filesChanged: 300, totalBytesSaved: 5000 }));
    pass = recordWindow(pass, null, report({ applied: true, filesChanged: 300, totalBytesSaved: 5000 }));

    const { windows, totals } = summarizePass(pass);
    expect(windows).toBe(1);
    expect(totals.filesScanned).toBe(500);
    expect(totals.totalBytesSaved).toBe(5000);
  });

  // The other direction of the same lie, and the one that is a single click away: Preview is never
  // disabled, so re-checking a window you already applied is an ordinary thing to do. That dry run
  // reports filesChanged: 0 BECAUSE the work is done — if it won, 500 rewritten images and their
  // saved bytes would vanish from the pass total.
  it('refuses to let a re-preview of an applied window erase what that window actually did', () => {
    let pass: BackfillPass = recordWindow(
      {},
      null,
      report({ applied: true, filesChanged: 300, totalBytesSaved: 5000 }),
    );
    pass = recordWindow(pass, null, report({ applied: false, filesChanged: 0, totalBytesSaved: 0 }));

    const { windows, totals } = summarizePass(pass);
    expect(windows).toBe(1);
    expect(totals.filesChanged).toBe(300);
    expect(totals.totalBytesSaved).toBe(5000);
  });

  // The guard is about applied work specifically, not about "first write wins" — two dry runs of
  // the same window must still collapse to the later one, or a re-preview after a settings change
  // would be invisible.
  it('still lets one dry run replace another over the same window', () => {
    let pass: BackfillPass = recordWindow({}, null, report({ filesChanged: 300 }));
    pass = recordWindow(pass, null, report({ filesChanged: 120 }));

    expect(summarizePass(pass).totals.filesChanged).toBe(120);
  });

  it('does not mutate the pass it is given', () => {
    const first = recordWindow({}, null, report());
    const second = recordWindow(first, 'products/m.jpg', report());

    expect(Object.keys(first)).toHaveLength(1);
    expect(Object.keys(second)).toHaveLength(2);
  });

  it('reports an untouched pass as zero rather than as undefined', () => {
    expect(summarizePass({})).toEqual({
      windows: 0,
      totals: {
        filesScanned: 0,
        filesChanged: 0,
        filesSkipped: 0,
        filesFailed: 0,
        totalBytesSaved: 0,
      },
    });
  });

  // Returned by reference, the shared EMPTY_TALLY would be one caller's mutation away from
  // becoming every future empty pass's starting point.
  it('hands out a fresh totals object for an empty pass', () => {
    expect(summarizePass({}).totals).not.toBe(summarizePass({}).totals);
  });
});
