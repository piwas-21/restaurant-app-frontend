import { resolvePublicLocalizedText } from './publicLocalizedText';

describe('resolvePublicLocalizedText', () => {
  it('uses the matching regional translation the coverage audit recognizes', () => {
    expect(
      resolvePublicLocalizedText(
        {
          name: 'Soupe source FR',
          description: 'Description source FR',
          sourceLocale: 'fr',
          content: {
            fr: { name: 'Soupe source FR', description: 'Description source FR' },
            'en-GB': { name: 'Regional soup EN', description: 'Regional description EN' },
          },
        },
        'en',
        'fr',
      ),
    ).toEqual({ name: 'Regional soup EN', description: 'Regional description EN' });
  });

  it('uses declared source text on the source locale instead of an English fallback', () => {
    expect(
      resolvePublicLocalizedText(
        {
          name: 'Nom source FR',
          description: 'Description source FR',
          sourceLocale: 'fr',
          content: { en: { name: 'Wrong English fallback', description: 'Wrong English body' } },
        },
        'fr',
        'en',
      ),
    ).toEqual({ name: 'Nom source FR', description: 'Description source FR' });
  });

  it('uses raw source text when an alternate route has no matching translation', () => {
    expect(
      resolvePublicLocalizedText(
        {
          name: 'Nom source FR',
          description: 'Description source FR',
          sourceLocale: 'fr',
          content: { en: { name: 'English translation', description: 'English body' } },
        },
        'de',
        'en',
      ),
    ).toEqual({ name: 'Nom source FR', description: 'Description source FR' });
  });
});
