'use client';

import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Eye,
  Grid3x3,
  Magnet,
  Maximize2,
  Plus,
  Redo2,
  Save,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { FloorPlanEditorApi } from '@/hooks/floorPlan/useFloorPlanEditor';
import styles from './EditorToolbar.module.css';

/**
 * Editor toolbar (FLOOR-PLAN-REVAMP §4.3): undo/redo, grid + snap toggles, an
 * overlap counter (warned, never blocked), zoom controls, Preview-as-guest,
 * Add table, and the one Save (disabled until there are unsaved edits). Every
 * control is a labelled button so the whole tool is operable without a drag.
 */
interface EditorToolbarProps {
  editor: FloorPlanEditorApi;
  onAddTable: () => void;
  onPreview: () => void;
  /** Add-table hits /api/tables + reloads, so it is locked while geometry is unsaved. */
  addDisabled: boolean;
}

export default function EditorToolbar({ editor, onAddTable, onPreview, addDisabled }: Readonly<EditorToolbarProps>) {
  const { t } = useTranslation();
  const { viewport } = editor;

  return (
    <div className={styles.bar} role="toolbar" aria-label={t('editor_toolbar', 'Floor plan tools')}>
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
          className={styles.button}
          onClick={onAddTable}
          disabled={addDisabled}
          aria-label={t('editor_add_table', 'Add table')}
        >
          <Plus size={18} aria-hidden="true" />
          <span className={styles.label}>{t('editor_add_table', 'Add table')}</span>
        </button>
        <button
          type="button"
          className={styles.save}
          onClick={editor.save}
          disabled={!editor.dirty || editor.saving}
          aria-label={t('editor_save', 'Save layout')}
        >
          <Save size={18} aria-hidden="true" />
          <span className={styles.label}>
            {editor.saving ? t('editor_saving', 'Saving…') : t('editor_save', 'Save layout')}
          </span>
          {editor.dirty && !editor.saving && <span className={styles.dirtyDot} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
