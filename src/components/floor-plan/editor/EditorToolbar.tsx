'use client';

import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { AlertTriangle, Eye, Grid3x3, Magnet, Maximize2, Redo2, Save, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import type { FloorPlanEditorApi } from '@/hooks/floorPlan/useFloorPlanEditor';
import EditorToolControls from './EditorToolControls';
import styles from './EditorToolbar.module.css';

/**
 * Editor toolbar (FLOOR-PLAN-REVAMP §4.3): the tool switch, undo/redo, grid +
 * snap toggles, an overlap counter (warned, never blocked), zoom controls,
 * Preview-as-guest and the one Save (disabled until there are unsaved edits).
 * Every control is a labelled button so the whole tool is operable without a
 * drag. **Adding objects — tables included — lives in the palette**, which is
 * where §4.3 puts it and which keeps one control per action.
 */

/**
 * What the toolbar says about the save state. Edits autosave a moment after the
 * admin stops, so this is mostly reassurance that the work is on the server — the
 * unsaved dot it replaced said only *that* something was pending, never that it was
 * about to be handled. A function, not nested ternaries in the JSX.
 */
function saveStatusText(t: TFunction, editor: FloorPlanEditorApi): string {
  if (editor.conflicted) {
    return t('editor_save_conflict_short', 'Reload needed');
  }
  if (editor.saving) {
    return t('editor_saving', 'Saving…');
  }
  // Autosave stopped trying, so "saving shortly" would be a lie — and a lie here is
  // the worst case of all, since the admin would keep working on unsaved edits.
  if (editor.autoSaveStalled) {
    return t('editor_autosave_stalled', 'Not saved — use Save');
  }
  if (editor.dirty) {
    return t('editor_autosave_pending', 'Saving shortly…');
  }
  return t('editor_all_saved', 'All changes saved');
}

interface EditorToolbarProps {
  editor: FloorPlanEditorApi;
  onPreview: () => void;
}

export default function EditorToolbar({ editor, onPreview }: Readonly<EditorToolbarProps>) {
  const { t } = useTranslation();
  const { viewport } = editor;

  return (
    <div className={styles.bar} role="toolbar" aria-label={t('editor_toolbar', 'Floor plan tools')}>
      <EditorToolControls activeTool={editor.activeTool} onSelectTool={editor.setActiveTool} />

      <div className={styles.group}>
        <button
          type="button"
          className={styles.button}
          onClick={editor.undo}
          disabled={!editor.canUndo}
          aria-label={t('editor_undo', 'Undo')}
        >
          <Undo2 size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={editor.redo}
          disabled={!editor.canRedo}
          aria-label={t('editor_redo', 'Redo')}
        >
          <Redo2 size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.group}>
        <button
          type="button"
          className={styles.button}
          aria-pressed={editor.gridVisible}
          onClick={() => editor.setGridVisible((v) => !v)}
          aria-label={t('editor_toggle_grid', 'Toggle grid')}
        >
          <Grid3x3 size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.button}
          aria-pressed={editor.snapEnabled}
          onClick={() => editor.setSnapEnabled((v) => !v)}
          aria-label={t('editor_toggle_snap', 'Toggle snapping')}
        >
          <Magnet size={18} aria-hidden="true" />
        </button>
        {editor.overlapCount > 0 && (
          <output className={styles.warn}>
            <AlertTriangle size={15} aria-hidden="true" />
            {t('editor_overlaps', '{{count}} overlaps', { count: editor.overlapCount })}
          </output>
        )}
      </div>

      <div className={styles.spacer} />

      <div className={styles.group}>
        <button
          type="button"
          className={styles.button}
          onClick={viewport.zoomOut}
          aria-label={t('editor_zoom_out', 'Zoom out')}
        >
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={viewport.zoomIn}
          aria-label={t('editor_zoom_in', 'Zoom in')}
        >
          <ZoomIn size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={viewport.fit}
          disabled={!viewport.isZoomed}
          aria-label={t('editor_fit', 'Fit to view')}
        >
          <Maximize2 size={18} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.group}>
        {/* Deliberately not a live region: this cycles saved -> shortly -> saving ->
            saved on every edit, and `<output>`'s implicit role=status announced all
            three each time. The Save button carries the accessible state — it is
            disabled exactly when there is nothing outstanding. */}
        <span className={styles.status}>{saveStatusText(t, editor)}</span>
        <button
          type="button"
          className={styles.button}
          onClick={onPreview}
          aria-label={t('editor_preview', 'Preview as guest')}
        >
          <Eye size={18} aria-hidden="true" />
          <span className={styles.label}>{t('editor_preview', 'Preview as guest')}</span>
        </button>
        <button
          type="button"
          className={styles.save}
          onClick={() => void editor.save()}
          disabled={!editor.dirty || editor.saving}
          aria-label={t('editor_save', 'Save layout')}
        >
          <Save size={18} aria-hidden="true" />
          <span className={styles.label}>
            {editor.saving ? t('editor_saving', 'Saving…') : t('editor_save', 'Save layout')}
          </span>
        </button>
      </div>
    </div>
  );
}
