'use client';

import type { RefObject } from 'react';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import type { FloorPlanDocument } from '@/types/floorPlan';
import { useEditorMarquee } from './useEditorMarquee';
import { useEditorDrag } from './useEditorDrag';
import { useEditorItems } from './useEditorItems';
import { useWallDraft } from './useWallDraft';
import { useWallPick } from './useWallPick';
import { useWallVertexDrag } from './useWallVertexDrag';
import type { StagePointerHandlers } from './editorStage';
import type { EditorTool } from '@/lib/floorPlan/editorTools';
import type { FloorPlanWall } from '@/types/floorPlan';

interface PointerChainArgs {
  stageRef: RefObject<HTMLDivElement | null>;
  viewBox: ViewBox;
  document: FloorPlanDocument;
  ready: boolean;
  snapEnabled: boolean;
  activeTool: EditorTool;
  selectedIds: readonly string[];
  apply: (doc: FloorPlanDocument) => void;
  select: (id: string, additive: boolean) => void;
  selectMany: (ids: string[]) => void;
  /** The selected wall, whose corner grips are on screen and grabbable. */
  selectedWall: FloorPlanWall | null;
  onPickWall: (wallId: string) => void;
  onSelectVertex: (index: number | null) => void;
  onWallCreated: (wallId: string) => void;
  /** A finished or abandoned chain returns the toolbar to Select. */
  onToolDone: () => void;
  /** The last link: zoom / pan / pinch. */
  viewportHandlers: StagePointerHandlers;
}

/**
 * The editor stage's pointer chain, assembled in one place (FLOOR-PLAN-REVAMP
 * §4.3). Each layer either claims a press or hands it to the next, and the order
 * is the whole design — it is built innermost-first and **read most-specific
 * first**:
 *
 * 1. **wall draft** — while the Wall tool is active, every press places a vertex.
 * 2. **palette placement** — while a palette entry is armed, a press places it.
 * 3. **wall vertices** — a press on the selected wall's corner or midpoint grip
 *    reshapes it. Above the objects because the grips are drawn on top of them.
 * 4. **object gestures** — a press on a table, an item or a grip moves / rotates
 *    / resizes it.
 * 5. **wall pick** — a press on bare wall selects that wall. Below the objects on
 *    purpose: a table sitting against a wall must still win its own press.
 * 6. **marquee** — a sweep across bare plan rubber-bands a selection.
 * 7. **viewport** — anything left over pans, pinches or zooms.
 *
 * Extracted from `useFloorPlanEditor` so that ordering is legible as a list
 * rather than as five interleaved `fallback:` arguments among the rest of the
 * editor's state.
 */
export function useEditorPointerChain({
  stageRef,
  viewBox,
  document: doc,
  ready,
  snapEnabled,
  activeTool,
  selectedIds,
  selectedWall,
  apply,
  select,
  selectMany,
  onPickWall,
  onSelectVertex,
  onWallCreated,
  onToolDone,
  viewportHandlers,
}: PointerChainArgs) {
  const marquee = useEditorMarquee({
    stageRef,
    viewBox,
    document: doc,
    enabled: ready,
    selectedIds,
    onSelectMany: selectMany,
    fallback: viewportHandlers,
  });

  const wallPick = useWallPick({
    stageRef,
    viewBox,
    document: doc,
    enabled: ready && activeTool === 'select',
    onPickWall,
    fallback: marquee.handlers,
  });

  const drag = useEditorDrag({
    stageRef,
    viewBox,
    document: doc,
    snapEnabled,
    selectedIds,
    onSelect: select,
    onCommit: apply,
    fallback: wallPick.handlers,
  });

  const vertices = useWallVertexDrag({
    stageRef,
    viewBox,
    document: doc,
    wall: activeTool === 'select' ? selectedWall : null,
    snapEnabled,
    apply,
    onSelectVertex,
    fallback: drag.handlers,
  });

  const items = useEditorItems({
    stageRef,
    viewBox,
    document: doc,
    snapEnabled,
    selectedIds,
    apply,
    onSelectMany: selectMany,
    fallback: vertices.handlers,
  });

  const wall = useWallDraft({
    stageRef,
    viewBox,
    document: doc,
    active: ready && activeTool === 'wall',
    snapEnabled,
    apply,
    onCreated: onWallCreated,
    onDone: onToolDone,
    fallback: items.handlers,
  });

  return { handlers: wall.handlers, draft: wall.draft, band: marquee.band, drag, items, vertices };
}
