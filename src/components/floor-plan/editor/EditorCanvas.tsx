'use client';

import { useRef } from 'react';

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
 * outlines, rotate/resize grips) is drawn through the scene's overlay slot so it
 * shares one viewBox. Pointer events go to the drag hook, which moves, rotates or
 * resizes through the grabbed target and defers to pan/pinch on empty space.
 * Rendered crisp (no skin) for editing precision.
 */
interface EditorCanvasProps {
  editor: FloorPlanEditorApi;
  ariaLabel: string;
  formatTableLabel: (table: FloorPlanTableGeometry, state: TableRenderState) => string;
}

export default function EditorCanvas({ editor, ariaLabel, formatTableLabel }: Readonly<EditorCanvasProps>) {
  const states: Record<string, TableRenderState> = Object.fromEntries(
    editor.selectedIds.map((id) => [id, 'selected' as const]),
  );
  // Was the click we are about to see produced by a real pointer? Every genuine
  // click is preceded by its own pointerdown; a synthesized one (voice control,
  // some AT activations) is not, and must still select. The stage clears the
  // flag after the scene's own click handler has bubbled past it.
  const fromPointer = useRef(false);

  return (
    <div
      ref={editor.viewport.stageRef}
      className={styles.stage}
      onPointerDown={(e) => {
        fromPointer.current = true;
        editor.dragHandlers.onPointerDown(e);
      }}
      onPointerMove={editor.dragHandlers.onPointerMove}
      onPointerUp={editor.dragHandlers.onPointerUp}
      onPointerCancel={editor.dragHandlers.onPointerCancel}
      onClick={() => {
        fromPointer.current = false;
      }}
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
        // AT-synthesized clicks have no such press, so they select here.
        onSelectTable={(id, source) => {
          if (source?.viaKeyboard || !fromPointer.current) {
            editor.select(id, Boolean(source?.additive));
          }
        }}
        formatTableLabel={formatTableLabel}
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
