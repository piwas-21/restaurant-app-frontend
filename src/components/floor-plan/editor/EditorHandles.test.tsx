import { render } from '@testing-library/react';
import EditorHandles from './EditorHandles';
import type { ActiveGesture } from '@/hooks/floorPlan/editorStage';
import type { MovableGeometry } from '@/lib/floorPlan/movable';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string, vars?: Record<string, unknown>) =>
      Object.entries(vars ?? {}).reduce(
        (text, [name, value]) => text.replaceAll(`{{${name}}}`, String(value)),
        fallback ?? key,
      ),
    i18n: { language: 'en' },
  }),
}));

/** The selection's footprint — a table or an item; the grips cannot tell. */
const rect = (over: Partial<MovableGeometry> = {}): MovableGeometry => ({
  x: 2,
  y: 2,
  widthMeters: 1.2,
  heightMeters: 0.8,
  rotationDegrees: 0,
  ...over,
});

const origin = rect();

const draw = (pxPerCm: number, gesture: ActiveGesture | null = null, over?: Partial<MovableGeometry>) =>
  render(
    <svg>
      <EditorHandles rect={rect(over)} pxPerCm={pxPerCm} gesture={gesture} />
    </svg>,
  ).container;

describe('EditorHandles', () => {
  it('draws nothing until the stage has been measured', () => {
    expect(draw(0).querySelectorAll('[data-handle]')).toHaveLength(0);
  });

  it('draws eight resize grips plus the rotate grip', () => {
    const grips = [...draw(2).querySelectorAll('[data-handle]')].map((el) => el.getAttribute('data-handle'));
    expect(grips.toSorted()).toEqual(['e', 'n', 'ne', 'nw', 'rotate', 's', 'se', 'sw', 'w'].toSorted());
  });

  it('holds a grip at a constant screen size, so halving the zoom doubles its plan size', () => {
    const at = (pxPerCm: number) => Number(draw(pxPerCm).querySelector('[data-handle="se"]')?.getAttribute('width'));
    expect(at(1)).toBeCloseTo(at(2) * 2, 6);
  });

  it('shows no ghost or badge when no gesture is running', () => {
    const svg = draw(2);
    expect(svg.querySelector('polygon')).toBeNull();
    expect(svg.querySelector('text')).toBeNull();
  });

  it('shows the pre-gesture ghost and the live angle while rotating', () => {
    const svg = draw(2, { kind: 'rotate', origin }, { rotationDegrees: 45 });
    expect(svg.querySelector('polygon')).not.toBeNull();
    expect(svg.querySelector('text')?.textContent).toBe('45°');
  });

  it('shows the live footprint while resizing', () => {
    const svg = draw(2, { kind: 'resize', origin }, { widthMeters: 1.5, heightMeters: 0.9 });
    expect(svg.querySelector('text')?.textContent).toBe('1.50 × 0.90 m');
  });

  it('keeps the canvas quiet while moving — the guides already say what is happening', () => {
    const svg = draw(2, { kind: 'move', origin });
    expect(svg.querySelector('polygon')).toBeNull();
    expect(svg.querySelector('text')).toBeNull();
  });

  it('carries the grips round with a rotated object', () => {
    const northOf = (rotationDegrees: number) =>
      draw(2, null, { rotationDegrees }).querySelector('[data-handle="n"]')?.getAttribute('x');
    expect(northOf(90)).not.toBe(northOf(0));
  });
});
