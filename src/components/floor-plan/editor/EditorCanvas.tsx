'use client';

import FloorPlanScene from '../FloorPlanScene';
import type { TableRenderState } from '../sceneTypes';
import type { FloorPlanTableGeometry } from '@/types/floorPlan';
import type { FloorPlanEditorApi } from '@/hooks/floorPlan/useFloorPlanEditor';
import EditorOverlay from './EditorOverlay';
import styles from './EditorCanvas.module.css';

/**
 * The editor canvas (FLOOR-PLAN-REVAMP §4.3) — the same `FloorPlanScene` the
 * guest map uses, in edit mode: the grid shows, the selected table renders
 * `selected`, and the `EditorOverlay` (selection box, snap guides, overlap
 * outlines) is drawn through the scene's overlay slot so it shares one viewBox.
 * Pointer events go to the drag hook, which moves a grabbed table and defers to
 * pan/pinch on empty space. Rendered crisp (no skin) for editing precision.
 */
interface EditorCanvasProps {
  editor: FloorPlanEditorApi;
  ariaLabel: string;
  formatTableLabel: (table: FloorPlanTableGeometry, state: TableRenderState) => string;
}

export default function EditorCanvas({ editor, ariaLabel, formatTableLabel }: Readonly<EditorCanvasProps>) {
  const states: Record<string, TableRenderState> | undefined = editor.selectedId
    ? { [editor.selectedId]: 'selected' }
    : undefined;

  return (
    <div
      ref={editor.viewport.stageRef}
      className={styles.stage}
      onPointerDown={editor.dragHandlers.onPointerDown}
      onPointerMove={editor.dragHandlers.onPointerMove}
      onPointerUp={editor.dragHandlers.onPointerUp}
      onPointerCancel={editor.dragHandlers.onPointerCancel}
    >
      <FloorPlanScene
        document={editor.document}
        tableStates={states}
        viewBox={editor.viewport.viewBox}
        showGrid={editor.gridVisible}
        role="application"
        ariaLabel={ariaLabel}
        onSelectTable={editor.select}
        formatTableLabel={formatTableLabel}
        overlay={
          <EditorOverlay
            document={editor.document}
            selectedId={editor.selectedId}
            guides={editor.guides}
            overlaps={editor.overlaps}
          />
        }
      />
    </div>
  );
}
