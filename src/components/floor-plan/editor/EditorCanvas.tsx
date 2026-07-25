'use client';

import FloorPlanScene from '../FloorPlanScene';
import type { TableRenderState } from '../sceneTypes';
import type { FloorPlanItem, FloorPlanTableGeometry } from '@/types/floorPlan';
import type { FloorPlanEditorApi } from '@/hooks/floorPlan/useFloorPlanEditor';
import EditorOverlay from './EditorOverlay';
import styles from './EditorCanvas.module.css';

/**
 * The editor canvas (FLOOR-PLAN-REVAMP §4.3) — the same `FloorPlanScene` the
 * guest map uses, in edit mode: the grid shows, the selected table renders
 * `selected`, and the `EditorOverlay` (selection box, snap guides, overlap
 * outlines, rotate/resize grips) is drawn through the scene's overlay slot so it
 * shares one viewBox. Pointer events go to the drag hook, which moves, rotates or
 * resizes through the grabbed target and defers to pan/pinch on empty space.
 * Rendered crisp (no skin) for editing precision.
 */
interface EditorCanvasProps {
  editor: FloorPlanEditorApi;
  ariaLabel: string;
  formatTableLabel: (table: FloorPlanTableGeometry, state: TableRenderState) => string;
  formatItemLabel: (item: FloorPlanItem) => string;
}

export default function EditorCanvas({
  editor,
  ariaLabel,
  formatTableLabel,
  formatItemLabel,
}: Readonly<EditorCanvasProps>) {
  const states: Record<string, TableRenderState> = Object.fromEntries(
    editor.selectedIds.map((id) => [id, 'selected' as const]),
  );
  return (
    <div
      ref={editor.viewport.stageRef}
      // An armed palette entry turns the whole plan into a drop target, and the
      // cursor is the only thing that says so before the first click.
      className={[styles.stage, editor.armedKind ? styles.placing : undefined].filter(Boolean).join(' ')}
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
        // A pointer press is already selected by the gesture layer on
        // pointer-DOWN; honouring the trailing click too would collapse a
        // multi-selection the moment a group drag ended. Keyboard activation and
        // pointer-less clicks (assistive tech) have no such press, so they select.
        onSelectTable={(id, source) => {
          if (source?.viaKeyboard || source?.synthetic) {
            editor.select(id, Boolean(source.additive));
          }
        }}
        formatTableLabel={formatTableLabel}
        // Items are hit-tested by footprint on pointer-down (a plant is too thin
        // to click reliably), so only the pointer-less paths select here too.
        onSelectItem={(id, source) => {
          if (source?.viaKeyboard || source?.synthetic) {
            editor.select(id, Boolean(source.additive));
          }
        }}
        formatItemLabel={formatItemLabel}
        selectedItemIds={editor.selectedIds}
        overlay={
          <EditorOverlay
            document={editor.document}
            selectedIds={editor.selectedIds}
            marquee={editor.marquee}
            guides={editor.guides}
            overlaps={editor.overlaps}
            pxPerCm={editor.pxPerCm}
            gesture={editor.gesture}
          />
        }
      />
    </div>
  );
}
