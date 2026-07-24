import { render } from '@testing-library/react';
import EditorHandles from './EditorHandles';
import type { ActiveGesture } from '@/hooks/floorPlan/useEditorDrag';
import type { FloorPlanTableGeometry } from '@/types/floorPlan';

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

const table = (over: Partial<FloorPlanTableGeometry> = {}): FloorPlanTableGeometry => ({
  id: 'a',
  tableNumber: '1',
  maxGuests: 4,
  isActive: true,
  isOutdoor: false,
  notes: null,
  positionX: over.positionX ?? 2,
  positionY: over.positionY ?? 2,
  width: over.width ?? 1.2,
  height: over.height ?? 0.8,
  shape: 'rectangle',
  rotation: over.rotation ?? 0,
});

const origin = { positionX: 2, positionY: 2, width: 1.2, height: 0.8, rotation: 0 };

const draw = (pxPerCm: number, gesture: ActiveGesture | null = null, over?: Partial<FloorPlanTableGeometry>) =>
  render(
    <svg>
      <EditorHandles table={table(over)} pxPerCm={pxPerCm} gesture={gesture} />
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
    const svg = draw(2, { kind: 'rotate', origin }, { rotation: 45 });
    expect(svg.querySelector('polygon')).not.toBeNull();
    expect(svg.querySelector('text')?.textContent).toBe('45°');
  });

  it('shows the live footprint while resizing', () => {
    const svg = draw(2, { kind: 'resize', origin }, { width: 1.5, height: 0.9 });
    expect(svg.querySelector('text')?.textContent).toBe('1.50 × 0.90 m');
  });

  it('keeps the canvas quiet while moving — the guides already say what is happening', () => {
    const svg = draw(2, { kind: 'move', origin });
    expect(svg.querySelector('polygon')).toBeNull();
    expect(svg.querySelector('text')).toBeNull();
  });

  it('carries the grips round with a rotated table', () => {
    const northOf = (rotation: number) =>
      draw(2, null, { rotation }).querySelector('[data-handle="n"]')?.getAttribute('x');
    expect(northOf(90)).not.toBe(northOf(0));
  });
});
