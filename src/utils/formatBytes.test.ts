import { formatBytes } from './formatBytes';

describe('formatBytes', () => {
  it('formats whole bytes without a decimal', () => {
    expect(formatBytes(512, 'en')).toBe('512 B');
  });

  it('steps up through the units', () => {
    expect(formatBytes(1024, 'en')).toBe('1.0 KB');
    expect(formatBytes(1024 * 1024, 'en')).toBe('1.0 MB');
    expect(formatBytes(1024 ** 3, 'en')).toBe('1.0 GB');
  });

  it('drops the decimal once the value is large enough not to need one', () => {
    expect(formatBytes(150 * 1024, 'en')).toBe('150 KB');
  });

  // The clamp: without it, a petabyte-scale number indexes past the unit table and prints
  // "undefined" — nonsense in a field whose whole job is to be read as a size.
  it('clamps to the largest known unit instead of running off the table', () => {
    expect(formatBytes(1024 ** 6, 'en')).toMatch(/GB$/);
  });

  it('treats zero and nonsense as zero rather than emitting NaN or -Infinity', () => {
    expect(formatBytes(0, 'en')).toBe('0 B');
    expect(formatBytes(-1, 'en')).toBe('0 B');
    expect(formatBytes(Number.NaN, 'en')).toBe('0 B');
  });

  it('localises the number, which is the part that actually differs per locale', () => {
    expect(formatBytes(1536, 'de')).toBe('1,5 KB');
  });
});
