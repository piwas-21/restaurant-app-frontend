'use client';

import { useCallback, useMemo, useState } from 'react';
import { alignMovables, distributeMovables, type AlignEdge, type PlanAxis } from '@/lib/floorPlan/align';
import { EMPTY_DOCUMENT } from '@/lib/floorPlan/document';
import type { EditorTool } from '@/lib/floorPlan/editorTools';
import { findWall } from '@/lib/floorPlan/wallHitTest';
import { useEditorDocument } from './useEditorDocument';
import { useEditorAutoSave } from './useEditorAutoSave';
import { usePlanViewport } from './usePlanViewport';
import { useEditorPointerChain } from './useEditorPointerChain';
import { useEditorKeyboard } from './useEditorKeyboard';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
import { useWallSelection } from './useWallSelection';
import { useStageScale } from './useStageScale';
import { overlappingTableIds } from '@/lib/floorPlan/editorGeometry';
import { findMovable } from '@/lib/floorPlan/movable';
import type { FloorPlanItem, FloorPlanTableGeometry } from '@/types/floorPlan';

interface UseFloorPlanEditorArgs {
  /** Open the delete-table modal (a /api/tables lifecycle op the page owns). */
  onDeleteSelected: () => void;
  /** A modal owns the screen — its Escape and arrows are not the canvas's. */
  modalOpen?: boolean;
}

/**
 * The admin editor's composed state (FLOOR-PLAN-REVAMP §4.3). Glues the document
 * store (history + save), the shared zoom/pan viewport, the tool mode, the
 * pointer chain and keyboard control into one flat API for the editor components.
 * `document` is what the canvas renders — the live gesture preview while one is in
 * flight, else the committed present — while `committed` is what logic/save use.
 * Overlap warnings are derived here so the overlay and the toolbar counter share
 * one source.
 *
 * **Two selections, deliberately kept apart.** `selectedIds` is the movable
 * selection (tables + items, which share one geometry vocabulary); `selectedWallId`
 * is a single wall, whose shape is a polyline and whose panel is a different
 * panel. Picking either clears the other, so the inspector is never ambiguous
 * about what an edit would act on.
 */
export function useFloorPlanEditor({ onDeleteSelected, modalOpen = false }: UseFloorPlanEditorArgs) {
  const store = useEditorDocument();
  const [gridVisible, setGridVisible] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [activeTool, setActiveTool] = useState<EditorTool>('select');

  const committed = store.document ?? EMPTY_DOCUMENT;
  const { apply, selectedIds, clearSelection, selectMany } = store;
  const ready = store.status === 'ready';
  const viewport = usePlanViewport(committed.widthMeters, committed.heightMeters, ready);

  const clearMovables = useCallback(() => selectMany([]), [selectMany]);
  const walls = useWallSelection({ document: committed, apply, clearMovables });
  const { selectWall, clearWall } = walls;

  const chain = useEditorPointerChain({
    stageRef: viewport.stageRef,
    viewBox: viewport.viewBox,
    document: committed,
    ready,
    snapEnabled,
    activeTool,
    selectedIds,
    apply,
    // Picking any movable drops the wall selection: one inspector, one subject.
    select: useCallback(
      (id: string, additive: boolean) => {
        clearWall();
        store.select(id, additive);
      },
      [clearWall, store],
    ),
    selectMany: useCallback(
      (ids: string[]) => {
        clearWall();
        selectMany(ids);
      },
      [clearWall, selectMany],
    ),
    onPickWall: selectWall,
    onWallCreated: selectWall,
    onToolDone: useCallback(() => setActiveTool('select'), []),
    viewportHandlers: viewport.stageHandlers,
  });

  const { drag, items } = chain;
  const renderDoc = drag.previewDoc ?? committed;
  // The on-canvas grips size themselves in screen pixels, so they need the live
  // stage↔plan scale rather than the viewBox alone (§4.4).
  const pxPerCm = useStageScale(viewport.stageRef, viewport.viewBox, ready);

  // Escape cancels the most local thing first: an armed palette entry, then any
  // selection. Otherwise arming a plant and thinking better of it would have no
  // way out but placing it. (The Wall tool's own Escape is handled in its hook,
  // on the capture phase, so an abandoned draft never falls through to here.)
  const { armedKind, arm, disarm } = items;
  const escape = useCallback(() => {
    if (armedKind) {
      disarm();
    } else {
      clearWall();
      clearSelection();
    }
  }, [armedKind, clearSelection, clearWall, disarm]);

  /** Arming a palette entry is a Select-tool action — it cannot mean "draw a wall". */
  const armPaletteKind = useCallback(
    (kind: string, viaPointer: boolean) => {
      setActiveTool('select');
      arm(kind, viaPointer);
    },
    [arm],
  );

  useEditorKeyboard({
    enabled: ready && !modalOpen,
    document: committed,
    selectedIds,
    apply,
    undo: store.undo,
    redo: store.redo,
    clearSelection: escape,
    onDeleteSelected,
    onDeleteItems: items.deleteSelectedItems,
    onDuplicate: items.duplicateSelection,
    onSelectTool: setActiveTool,
  });

  // Geometry edits persist themselves shortly after the admin stops making them, so
  // a crash or a closed laptop costs seconds of work rather than the whole session.
  const autoSave = useEditorAutoSave({
    document: committed,
    dirty: store.dirty,
    saving: store.saving,
    conflicted: store.conflicted,
    save: store.save,
  });

  useUnsavedChangesGuard(store.dirty);

  const overlaps = useMemo(() => overlappingTableIds(renderDoc.tables), [renderDoc.tables]);
  const selectedTable: FloorPlanTableGeometry | null = renderDoc.tables.find((t) => t.id === store.selectedId) ?? null;
  const selectedItem: FloorPlanItem | null = renderDoc.items.find((i) => i.id === store.selectedId) ?? null;

  return {
    ...store,
    document: renderDoc,
    committed,
    gridVisible,
    setGridVisible,
    snapEnabled,
    setSnapEnabled,
    activeTool,
    setActiveTool,
    viewport,
    pxPerCm,
    /** The stage's whole pointer chain: draft → place → gesture → wall → marquee → pan. */
    dragHandlers: chain.handlers,
    /** The wall chain being drawn, or null when the Wall tool is not active. */
    wallDraft: chain.draft,
    guides: drag.guides,
    gesture: drag.gesture,
    marquee: chain.band,
    /** Autosave has given up (conflict, or repeated failures) — Save is the way out. */
    autoSaveStalled: autoSave.stalled,
    overlaps,
    overlapCount: overlaps.size,
    selectedTable,
    selectedItem,
    ...walls,
    // The wall itself is resolved here, against what is actually on screen — the
    // selection holds only an id, so a deleted or re-minted wall stops resolving
    // instead of going stale.
    selectedWall: findWall(renderDoc.walls, walls.selectedWallId),
    /** The single selection as a normalised rect — a table or an item alike. */
    selectedMovable: store.selectedId ? findMovable(renderDoc, store.selectedId) : null,
    armedKind,
    armPaletteKind,
    canPlaceItem: items.canPlace,
    deleteSelectedItems: items.deleteSelectedItems,
    duplicateSelection: items.duplicateSelection,
    /** Align/distribute act on the whole selection; both are pure document ops. */
    alignSelection: useCallback(
      (edge: AlignEdge) => apply(alignMovables(committed, selectedIds, edge)),
      [apply, committed, selectedIds],
    ),
    distributeSelection: useCallback(
      (axis: PlanAxis) => apply(distributeMovables(committed, selectedIds, axis)),
      [apply, committed, selectedIds],
    ),
  };
}

export type FloorPlanEditorApi = ReturnType<typeof useFloorPlanEditor>;
