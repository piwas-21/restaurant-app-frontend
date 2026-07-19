import { getFullImageUrl } from './image';

describe('getFullImageUrl', () => {
  it('passes absolute local public paths through untouched (incl. the /branding placeholder)', () => {
    expect(getFullImageUrl('/branding/placeholder.png')).toBe('/branding/placeholder.png');
    expect(getFullImageUrl('/images/placeholder-app.png')).toBe('/images/placeholder-app.png');
  });

  it('passes absolute http(s) URLs through untouched', () => {
    expect(getFullImageUrl('https://cdn.example.com/x.png')).toBe('https://cdn.example.com/x.png');
  });

  it('prefixes a bare backend image id with the Google-Drive path', () => {
    expect(getFullImageUrl('abc123')).toBe('https://lh3.google.com/u/0/d/abc123');
  });
});
