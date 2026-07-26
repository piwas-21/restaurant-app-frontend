'use client';

import { useTranslation } from 'react-i18next';
import { MousePointer2, Spline } from 'lucide-react';
import { EDITOR_TOOLS, type EditorTool } from '@/lib/floorPlan/editorTools';
import styles from './EditorToolbar.module.css';

/**
 * The tool switch (FLOOR-PLAN-REVAMP §4.3) — Select (`V`) and Wall (`W`). A tool
 * changes what a press on the plan *means*, which is why it is a radio group
 * rather than a row of independent toggles: exactly one is always active, and
 * assistive tech is told so through `aria-checked` rather than having to infer it
 * from styling.
 */

const TOOL_ICONS: Record<EditorTool, typeof MousePointer2> = {
  select: MousePointer2,
  wall: Spline,
};

const TOOL_LABELS: Record<EditorTool, { key: string; fallback: string }> = {
  select: { key: 'editor_tool_select', fallback: 'Select (V)' },
  wall: { key: 'editor_tool_wall', fallback: 'Draw wall (W)' },
};

interface EditorToolControlsProps {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
}

export default function EditorToolControls({ activeTool, onSelectTool }: Readonly<EditorToolControlsProps>) {
  const { t } = useTranslation();
  return (
    <div className={styles.group} role="radiogroup" aria-label={t('editor_tools', 'Tool')}>
      {EDITOR_TOOLS.map((tool) => {
        const Icon = TOOL_ICONS[tool];
        const label = t(TOOL_LABELS[tool].key, TOOL_LABELS[tool].fallback);
        return (
          <button
            key={tool}
            type="button"
            role="radio"
            className={styles.button}
            aria-checked={activeTool === tool}
            aria-label={label}
            title={label}
            onClick={() => onSelectTool(tool)}
          >
            <Icon size={18} aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
