import { renderHook } from '@testing-library/react';
import { useEditorErrors } from './useEditorErrors';
import type { EditorSection } from '@/components/admin/product-editor/EditorShell';
import { SECTION_IDS } from '@/components/admin/product-editor/editorSectionTypes';

const t = ((key: string, options?: unknown) =>
  typeof options === 'object' && options !== null && 'count' in options
    ? `${key}:${(options as { count: number }).count}`
    : key) as never;

const sections: EditorSection[] = [
  { id: SECTION_IDS.basics, label: 'Basics', node: null },
  { id: SECTION_IDS.pricing, label: 'Pricing', node: null },
];

const setup = (errors: Record<string, unknown>) => {
  const setActiveTab = jest.fn();
  const { result } = renderHook(() =>
    useEditorErrors({
      errors: errors as never,
      t,
      setActiveTab,
      itemTabId: 'item',
      translationsTabId: 'translations',
    }),
  );
  return { result, setActiveTab };
};

/**
 * The editor's error surface (D13 / S7). `editorValidation.test.ts` pins the derivation; this pins
 * the two things the hook adds on top — which sections get marked, and what "jump to first" does
 * when the first error is on the other tab.
 */
describe('useEditorErrors — count, markers, and the jump (D13)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reports nothing and marks nothing on a valid form', () => {
    const { result } = setup({});

    expect(result.current.count).toBe(0);
    expect(result.current.decorate(sections).every((section) => !section.hasError)).toBe(true);
  });

  // Reachable only from a stale render, but the chip is the ONLY caller and it is hidden at zero —
  // so this guard is what keeps a race between the two from throwing on `fields[0].name`.
  it('does nothing when asked to jump with no errors', () => {
    const { result, setActiveTab } = setup({});

    expect(() => result.current.jumpToFirst()).not.toThrow();
    expect(setActiveTab).not.toHaveBeenCalled();
  });

  it('marks only the sections that hold an error, and names the marker', () => {
    const { result } = setup({ basePrice: { message: 'Expected number' } });
    const decorated = result.current.decorate(sections);

    expect(decorated.find((section) => section.id === SECTION_IDS.pricing)?.hasError).toBe(true);
    expect(decorated.find((section) => section.id === SECTION_IDS.pricing)?.errorLabel).toBe(
      'editor_section_has_errors',
    );
    expect(decorated.find((section) => section.id === SECTION_IDS.basics)?.hasError).toBeUndefined();
  });

  it('interpolates the count into the summary sentence', () => {
    const { result } = setup({ name: { message: 'a' }, basePrice: { message: 'b' } });

    expect(result.current.count).toBe(2);
    expect(result.current.label).toBe('editor_error_summary:2');
  });

  it('stays on the item tab for a section field, and focuses it', () => {
    document.body.innerHTML = '<input name="name" />';
    const { result, setActiveTab } = setup({ name: { message: 'Name is required' } });

    result.current.jumpToFirst();

    expect(setActiveTab).toHaveBeenCalledWith('item');
    expect(document.activeElement).toBe(document.querySelector('input'));
  });

  // The panel is `hidden`, so the tab has to change BEFORE the focus is attempted — and the focus
  // is deferred a tick because the panel is still hidden in the same render.
  it('switches to the translations tab first for a translation field', () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<input name="content.0.name" />';
    const { result, setActiveTab } = setup({ content: [{ name: { message: 'Name is required' } }] });

    result.current.jumpToFirst();
    expect(setActiveTab).toHaveBeenCalledWith('translations');
    expect(document.activeElement).not.toBe(document.querySelector('input'));

    jest.runAllTimers();
    expect(document.activeElement).toBe(document.querySelector('input'));
    jest.useRealTimers();
  });
});
