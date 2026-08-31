import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CSS = readFileSync(join(__dirname, 'AppearanceTab.module.css'), 'utf8');

describe('Appearance save action', () => {
  it('uses the same branded button treatment as the other settings forms', () => {
    const block = CSS.slice(CSS.indexOf('.actions button {'), CSS.indexOf('\n}', CSS.indexOf('.actions button {')));
    expect(block).toContain('background: var(--brand-primary)');
    expect(block).toContain('color: var(--text-on-primary)');
    expect(block).toContain('cursor: pointer');
  });

  it('has explicit hover and disabled states', () => {
    expect(CSS).toContain('.actions button:hover:not(:disabled)');
    expect(CSS).toContain('background: var(--brand-primary-hover)');
    expect(CSS).toContain('.actions button:disabled');
  });
});
