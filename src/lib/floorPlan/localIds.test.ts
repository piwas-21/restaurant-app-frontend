import { isLocalId, nextLocalId, nextLocalItemId, nextLocalOpeningId, nextLocalWallId } from './localIds';
import { planDocument, planItem, planWall } from './__fixtures__/editorFixtures';

describe('localIds — isLocalId', () => {
  it.each(['local-item-2', 'local-wall-1', 'local-opening-9'])('recognises %s whatever the kind', (id) => {
    expect(isLocalId(id)).toBe(true);
  });

  it('leaves a server id alone', () => {
    expect(isLocalId('e3f1c2d4-0000-4000-8000-000000000001')).toBe(false);
  });
});

describe('localIds — nextLocalId', () => {
  it('starts at one', () => {
    expect(nextLocalId('wall', [])).toBe('local-wall-1');
  });

  it('never reuses a number already taken, even with gaps', () => {
    expect(nextLocalId('wall', ['local-wall-1', 'local-wall-4'])).toBe('local-wall-5');
  });

  it('ignores ids of other kinds, so the counters stay independent', () => {
    expect(nextLocalId('wall', ['local-item-9', 'local-opening-7'])).toBe('local-wall-1');
  });

  it('ignores server ids and absent ones', () => {
    expect(nextLocalId('item', ['e3f1c2d4-0000-4000-8000-000000000001', null, undefined])).toBe('local-item-1');
  });
});

describe('localIds — per-collection helpers', () => {
  it('numbers items, walls and openings from their own collections', () => {
    const doc = planDocument([], {
      items: [planItem({ id: 'local-item-2' })],
      walls: [
        planWall({
          openings: [
            {
              id: 'local-opening-5',
              segmentIndex: 0,
              offsetMeters: 1,
              widthMeters: 0.9,
              kind: 'door',
              swingDirection: 'in',
            },
          ],
        }),
      ],
    });
    expect(nextLocalItemId(doc)).toBe('local-item-3');
    expect(nextLocalWallId(doc)).toBe('local-wall-1');
    expect(nextLocalOpeningId(doc)).toBe('local-opening-6');
  });

  it('numbers openings across the WHOLE plan, so moving one between walls cannot collide', () => {
    const opening = (id: string) => ({
      id,
      segmentIndex: 0,
      offsetMeters: 1,
      widthMeters: 0.9,
      kind: 'door' as const,
      swingDirection: 'in',
    });
    const doc = planDocument([], {
      walls: [
        planWall({ id: 'w1', openings: [opening('local-opening-1')] }),
        planWall({ id: 'w2', openings: [opening('local-opening-3')] }),
      ],
    });
    expect(nextLocalOpeningId(doc)).toBe('local-opening-4');
  });
});
