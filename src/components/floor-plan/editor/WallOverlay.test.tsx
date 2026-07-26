import { render } from '@testing-library/react';
import WallOverlay from './WallOverlay';
import { planWall } from '@/lib/floorPlan/__fixtures__/editorFixtures';
import type { WallDraftState } from '@/hooks/floorPlan/useWallDraft';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, f?: string, v?: Record<string, unknown>) =>
      (f ?? _k).replace(/{{(\w+)}}/g, (_m, key: string) => String(v?.[key] ?? '')),
    i18n: { language: 'en' },
  }),
}));

const draw = (props: {
  draft?: WallDraftState | null;
  selectedWall?: ReturnType<typeof planWall> | null;
  selectedVertex?: number | null;
  pxPerCm?: number;
}) => {
  const { container } = render(
    <svg>
      <WallOverlay
        draft={props.draft ?? null}
        selectedWall={props.selectedWall ?? null}
        selectedVertex={props.selectedVertex ?? null}
        pxPerCm={props.pxPerCm ?? 1}
      />
    </svg>,
  );
  return container;
};

const CHAIN: WallDraftState = {
  points: [
    { x: 1, y: 1 },
    { x: 4, y: 1 },
  ],
  cursor: { point: { x: 4, y: 3 }, kind: 'angle' },
};

describe('WallOverlay — the draft', () => {
  it('draws the placed chain, a dot per corner and a rubber segment to the cursor', () => {
    const c = draw({ draft: CHAIN });
    // Points are metres → centimetres in the scene's user units.
    expect(c.querySelector('polyline')?.getAttribute('points')).toBe('100,100 400,100');
    expect(c.querySelectorAll('circle')).toHaveLength(3); // two corners + the snap ring
    expect(c.querySelector('line')).toHaveAttribute('x2', '400');
  });

  it('reports the live length and bearing — the readout is the point of the tool', () => {
    const c = draw({ draft: CHAIN });
    expect(c.querySelector('text')?.textContent).toBe('2.00 m · 90°');
  });

  it('draws no readout for a zero-length segment', () => {
    const c = draw({ draft: { points: [{ x: 1, y: 1 }], cursor: { point: { x: 1, y: 1 }, kind: 'grid' } } });
    expect(c.querySelector('text')).toBeNull();
  });

  it('leaves the cursor unringed when no snap moved it', () => {
    const c = draw({ draft: { points: [{ x: 1, y: 1 }], cursor: { point: { x: 2, y: 2 }, kind: 'free' } } });
    expect(c.querySelectorAll('circle')).toHaveLength(1); // the corner only
  });
});

describe('WallOverlay — the selected wall', () => {
  it('outlines a closed room back to its first corner', () => {
    const c = draw({ selectedWall: planWall() });
    expect(c.querySelector('polyline')?.getAttribute('points')).toBe('100,100 500,100 500,400 100,400 100,100');
  });

  it('leaves an open run open', () => {
    const c = draw({
      selectedWall: planWall({
        isClosed: false,
        points: [
          { x: 1, y: 1 },
          { x: 5, y: 1 },
        ],
      }),
    });
    expect(c.querySelector('polyline')?.getAttribute('points')).toBe('100,100 500,100');
  });
});

describe('WallOverlay — before the stage is measured', () => {
  // Every size in here is a screen pixel taken through the zoom; with no scale
  // yet that division is meaningless, so the layer draws nothing rather than
  // sizing its handles off an infinity.
  it('renders nothing at all', () => {
    expect(draw({ draft: CHAIN, selectedWall: planWall(), pxPerCm: 0 }).querySelector('polyline')).toBeNull();
  });
});
