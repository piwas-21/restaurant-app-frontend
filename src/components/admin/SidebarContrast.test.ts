import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TOKENS = readFileSync(join(__dirname, '../../design-system/tokens/colors.css'), 'utf8');
const SIDEBAR = readFileSync(join(__dirname, '../../app/styles/AdminPage.module.css'), 'utf8');

function token(name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`).exec(TOKENS);
  if (!match) throw new Error(`Missing literal token ${name}`);
  return match[1];
}

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((value >> 16) & 0xff) + 0.7152 * channel((value >> 8) & 0xff) + 0.0722 * channel(value & 0xff)
  );
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

const AA = 4.5;

describe('admin sidebar palette isolation', () => {
  it.each([
    ['--admin-nav-text', '--admin-nav-bg'],
    ['--admin-nav-text-muted', '--admin-nav-bg'],
    ['--admin-nav-text', '--admin-nav-hover-bg'],
    ['--admin-nav-text', '--admin-nav-active-bg'],
    ['--admin-nav-accent', '--admin-nav-active-bg'],
  ])('%s clears text contrast on %s', (foreground, background) => {
    expect(contrast(token(foreground), token(background))).toBeGreaterThanOrEqual(AA);
  });

  it('binds the sidebar to admin-only tokens rather than tenant palette aliases', () => {
    const block = SIDEBAR.slice(SIDEBAR.indexOf('.sidebar {'), SIDEBAR.indexOf('.sidebar nav ul'));
    expect(block).toContain('background-color: var(--admin-nav-bg)');
    expect(block).toContain('color: var(--admin-nav-text)');
    expect(block).not.toContain('--primary-color-dark');
    expect(block).not.toContain('--button-text-color');
  });
});
