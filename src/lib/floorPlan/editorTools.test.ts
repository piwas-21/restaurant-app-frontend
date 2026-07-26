import { EDITOR_TOOLS, toolForKey } from './editorTools';

describe('editorTools', () => {
  it('offers exactly the tools that have an implementation', () => {
    expect(EDITOR_TOOLS).toEqual(['select', 'wall']);
  });

  it.each([
    ['v', 'select'],
    ['w', 'wall'],
    ['V', 'select'],
    ['W', 'wall'],
  ])('maps %s to the %s tool, whatever the caps lock is doing', (key, tool) => {
    expect(toolForKey(key)).toBe(tool);
  });

  it('claims no other key', () => {
    expect(toolForKey('z')).toBeNull();
    expect(toolForKey('Escape')).toBeNull();
  });
});
