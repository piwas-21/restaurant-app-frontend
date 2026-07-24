import { hoverCardPosition } from './hoverCardPosition';

const stage = { left: 0, top: 0, width: 600, height: 400 };

describe('hoverCardPosition', () => {
  it('places the card to the right of the table by default', () => {
    const table = { left: 100, top: 150, width: 40, height: 40 };
    const pos = hoverCardPosition(table, stage, 210, 150);
    expect(pos.left).toBe(100 + 40 + 12);
    expect(pos.top).toBe(150 + 20 - 75);
  });

  it('flips to the left when the card would overflow the stage', () => {
    const table = { left: 500, top: 150, width: 40, height: 40 };
    const pos = hoverCardPosition(table, stage, 210, 150);
    // right edge (540 + 12 + 210) overflows → flip left of the table
    expect(pos.left).toBe(500 - 210 - 12);
  });

  it('clamps the card inside the stage', () => {
    const table = { left: 0, top: 0, width: 10, height: 10 };
    const pos = hoverCardPosition(table, stage, 210, 150);
    expect(pos.left).toBeGreaterThanOrEqual(6);
    expect(pos.top).toBe(6);
  });
});
