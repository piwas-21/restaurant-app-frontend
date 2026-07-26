/**
 * The editor's tool modes (FLOOR-PLAN-REVAMP §4.3). A tool changes what a press
 * on the plan *means*, so it is the outermost fact about the pointer chain — the
 * one thing every layer below it has to agree on.
 *
 * `zone` and `measure` from §4.3's full list land with S8; adding them here early
 * would put dead buttons on the toolbar, which is the exact complaint that
 * started this revamp.
 */
export const EDITOR_TOOLS = ['select', 'wall'] as const;

export type EditorTool = (typeof EDITOR_TOOLS)[number];

/** Single-key shortcut per tool (§4.3: `V` Select · `W` Wall). */
export const TOOL_SHORTCUTS: Readonly<Record<string, EditorTool>> = {
  v: 'select',
  w: 'wall',
};

/** The tool a shortcut key selects, or null when the key belongs to something else. */
export const toolForKey = (key: string): EditorTool | null => TOOL_SHORTCUTS[key.toLowerCase()] ?? null;
