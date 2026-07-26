'use client';

import type { RefObject } from 'react';
import type { ViewBox } from '@/lib/floorPlan/geometry';
import type { FloorPlanDocument } from '@/types/floorPlan';
import { useEditorMarquee } from './useEditorMarquee';
import { useEditorDrag } from './useEditorDrag';
import { useEditorItems } from './useEditorItems';
import { useWallDraft } from './useWallDraft';
import { useWallPick } from './useWallPick';
import type { StagePointerHandlers } from './editorStage';
import type { EditorTool } from '@/lib/floorPlan/editorTools';

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
  onPickWall: (wallId: string) => void;
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
 * 3. **object gestures** — a press on a table, an item or a grip moves / rotates
 *    / resizes it.
 * 4. **wall pick** — a press on bare wall selects that wall. Below the objects on
 *    purpose: a table sitting against a wall must still win its own press.
 * 5. **marquee** — a sweep across bare plan rubber-bands a selection.
 * 6. **viewport** — anything left over pans, pinches or zooms.
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
  apply,
  select,
  selectMany,
  onPickWall,
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

  const items = useEditorItems({
    stageRef,
    viewBox,
    document: doc,
    snapEnabled,
    selectedIds,
    apply,
    onSelectMany: selectMany,
    fallback: drag.handlers,
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

  return { handlers: wall.handlers, draft: wall.draft, band: marquee.band, drag, items };
}
