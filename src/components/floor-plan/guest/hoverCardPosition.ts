/** The minimal rect shape the hover-card placement needs (DOMRect-compatible). */
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * Place the hover card beside a table, never over it (FLOOR-PLAN-REVAMP §4.2,
 * WCAG SC 1.4.13). It sits to the table's right, flips to the left when it would
 * overflow the stage, and is clamped inside the stage so it never leaves the
 * viewport. Coordinates are relative to the stage's top-left. Pure so the
 * placement is unit-tested without a browser.
 */
export function hoverCardPosition(
  tableRect: RectLike,
  stageRect: RectLike,
  cardWidth = 210,
  cardHeight = 150,
): { left: number; top: number } {
  const tableRight = tableRect.left - stageRect.left + tableRect.width;
  const tableLeft = tableRect.left - stageRect.left;
  let left = tableRight + 12;
  if (left + cardWidth > stageRect.width - 6) {
    left = tableLeft - cardWidth - 12;
  }
  const top = tableRect.top - stageRect.top + tableRect.height / 2 - cardHeight / 2;
  return {
    left: clamp(left, 6, Math.max(6, stageRect.width - cardWidth - 6)),
    top: clamp(top, 6, Math.max(6, stageRect.height - cardHeight - 6)),
  };
}
