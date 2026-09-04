import { withResyncedSnapshots } from './translationResync';
import { localizedDescription, localizedName } from '@/utils/localizedContent';

/**
 * #536 — the multilingual description was a frozen creation-time snapshot.
 *
 * The fixtures are the WIRE shape, not the form's: `ProductDescriptionDto.Name` is `string` and
 * `Description` is `string?`, and the API sets no `DefaultIgnoreCondition`, so an absent
 * description really does arrive as an explicit `null` rather than as a missing key.
 */
describe('withResyncedSnapshots', () => {
  const change = {
    previousName: 'Adana Dürüm',
    previousDescription: 'Acılı dürüm',
    nextName: 'Adana Dürüm',
    nextDescription: 'Bol acılı dürüm',
  };

  it('follows the base text when the row is a verbatim copy of it', () => {
    expect(
      withResyncedSnapshots([{ language: 'tr', name: 'Adana Dürüm', description: 'Acılı dürüm' }], change),
    ).toEqual([{ language: 'tr', name: 'Adana Dürüm', description: 'Bol acılı dürüm' }]);
  });

  // The whole reason this is narrow enough to need no confirmation dialog. A translation someone
  // actually typed is not a snapshot and must survive untouched — if this ever goes green wrongly,
  // the feature is destroying an admin's work.
  it('leaves a translation that has diverged by one character exactly as it was', () => {
    const rows = [{ language: 'fr', name: 'Adana Dürüm', description: 'Wrap épicé' }];

    expect(withResyncedSnapshots(rows, change)[0].description).toBe('Wrap épicé');
  });

  it('follows a rename too — a stale content.en.name is the same defect on the other field', () => {
    const renamed = { ...change, nextName: 'Adana Wrap', nextDescription: change.previousDescription };
    const rows = [{ language: 'en', name: 'Adana Dürüm', description: 'Acılı dürüm' }];

    expect(withResyncedSnapshots(rows, renamed)).toEqual([
      { language: 'en', name: 'Adana Wrap', description: 'Acılı dürüm' },
    ]);
  });

  // Trimmed on both sides: the create path copies the raw input and the edit path trims on the way
  // out, so one round trip can leave a snapshot differing from its source by whitespace alone.
  it('recognises a snapshot that differs only by whitespace', () => {
    const rows = [{ language: 'tr', name: 'Adana Dürüm', description: '  Acılı dürüm  ' }];

    expect(withResyncedSnapshots(rows, change)[0].description).toBe('Bol acılı dürüm');
  });

  /**
   * The over-reach control, and the one that matters most. An item created with NO description
   * writes an empty string into its row. If "" counted as a snapshot, the first description an
   * admin ever wrote would flood every locale carrying an empty string — turning a fix for a stale
   * translation into a machine for inventing translations that were never written.
   */
  it('never treats a blank base text as a snapshot source', () => {
    const rows = [
      { language: 'fr', name: 'Adana Dürüm', description: '' },
      { language: 'de', name: 'Adana Dürüm', description: null },
    ];
    const fromNothing = {
      previousName: 'Adana Dürüm',
      previousDescription: '',
      nextName: 'Adana Dürüm',
      nextDescription: 'Bol acılı dürüm',
    };

    expect(withResyncedSnapshots(rows, fromNothing)).toEqual(rows);
  });

  it('adds no row, removes no row and reorders nothing', () => {
    const rows = [
      { language: 'tr', name: 'Adana Dürüm', description: 'Acılı dürüm' },
      { language: 'fr', name: 'Wrap Adana', description: 'Wrap épicé' },
    ];

    expect(withResyncedSnapshots(rows, change).map((row) => row.language)).toEqual(['tr', 'fr']);
    expect(withResyncedSnapshots([], change)).toEqual([]);
    expect(withResyncedSnapshots(undefined, change)).toEqual([]);
  });

  // Identity on a no-op save, so an untouched edit cannot mark rows dirty or rewrite them.
  it('returns the very same row objects when the base text did not change', () => {
    const rows = [{ language: 'tr', name: 'Adana Dürüm', description: 'Acılı dürüm' }];
    const unchanged = { ...change, nextDescription: change.previousDescription };

    expect(withResyncedSnapshots(rows, unchanged)[0]).toBe(rows[0]);
  });
});

/**
 * The other END of #536: what the GUEST reads.
 *
 * A payload assertion alone would prove the editor changed its mind, not that anyone can see it.
 * This runs the re-synced rows through the REAL guest resolver (`localizedContent.ts`, what
 * `MenuCard` and the customization sheet both call) rather than a restatement of its rules — the
 * chain is `content[lang] || content.en || item`, and the whole defect was that the first link held
 * a stale value and therefore shadowed the edited one.
 */
describe('#536 end to end — the guest reads what the admin typed', () => {
  const asGuestItem = (rows: ReturnType<typeof withResyncedSnapshots>, name: string, description: string) => ({
    name,
    description,
    content: Object.fromEntries(
      rows.map((row) => [row.language as string, { name: row.name as string, description: row.description ?? '' }]),
    ),
  });

  const storedRows = [{ language: 'tr', name: 'Adana Dürüm', description: 'Acılı dürüm' }];
  const change = {
    previousName: 'Adana Dürüm',
    previousDescription: 'Acılı dürüm',
    nextName: 'Adana Dürüm',
    nextDescription: 'Bol acılı dürüm',
  };

  it('showed the STALE text before the re-sync — the defect, reproduced', () => {
    const guest = asGuestItem(storedRows, 'Adana Dürüm', 'Bol acılı dürüm');

    expect(localizedDescription(guest, 'tr')).toBe('Acılı dürüm');
  });

  it('shows the edited text after it', () => {
    const guest = asGuestItem(withResyncedSnapshots(storedRows, change), 'Adana Dürüm', 'Bol acılı dürüm');

    expect(localizedDescription(guest, 'tr')).toBe('Bol acılı dürüm');
    expect(localizedName(guest, 'tr')).toBe('Adana Dürüm');
  });

  // A guest whose locale has no row at all was never affected, and must stay unaffected — the
  // fallback already reaches the item's own text for them.
  it('leaves a locale with no translation reading the base text, as it always did', () => {
    const guest = asGuestItem(withResyncedSnapshots(storedRows, change), 'Adana Dürüm', 'Bol acılı dürüm');

    expect(localizedDescription(guest, 'it')).toBe('Bol acılı dürüm');
  });
});
