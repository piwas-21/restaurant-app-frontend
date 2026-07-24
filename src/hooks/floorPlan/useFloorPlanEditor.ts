'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { alignTables, distributeTables, type AlignEdge, type PlanAxis } from '@/lib/floorPlan/align';
import { useEditorDocument } from './useEditorDocument';
import { usePlanViewport } from './usePlanViewport';
import { useEditorDrag } from './useEditorDrag';
import { useEditorMarquee } from './useEditorMarquee';
import { useEditorKeyboard } from './useEditorKeyboard';
import { useStageScale } from './useStageScale';
import { overlappingTableIds } from '@/lib/floorPlan/editorGeometry';
import type { FloorPlanDocument, FloorPlanTableGeometry } from '@/types/floorPlan';

/** A stable placeholder so the hooks below run unconditionally while loading. */
const EMPTY_DOC: FloorPlanDocument = {
  id: '',
  name: '',
  widthMeters: 12,
  heightMeters: 8,
  gridSizeCm: 25,
  backgroundStyle: '',
  isDefault: true,
  displayOrder: 0,
  updatedAt: null,
  walls: [],
  items: [],
  tables: [],
};

interface UseFloorPlanEditorArgs {
  /** Open the delete-table modal (a /api/tables lifecycle op the page owns). */
  onDeleteSelected: () => void;
  /** A modal owns the screen — its Escape and arrows are not the canvas's. */
  modalOpen?: boolean;
}

/**
 * The admin editor's composed state (FLOOR-PLAN-REVAMP §4.3). Glues the document
 * store (history + save), the shared zoom/pan viewport, pointer gestures (move /
 * rotate / resize) and keyboard control into one flat API for the editor
 * components. `document` is what the canvas renders — the live gesture preview
 * while one is in flight, else the committed present — while `committed` is what
 * logic/save use. Overlap warnings are derived here so the overlay and the
 * toolbar counter share one source.
 */
export function useFloorPlanEditor({ onDeleteSelected, modalOpen = false }: UseFloorPlanEditorArgs) {
  const store = useEditorDocument();
  const [gridVisible, setGridVisible] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);

  const committed = store.document ?? EMPTY_DOC;
  const { apply, selectedIds } = store;
  const viewport = usePlanViewport(committed.widthMeters, committed.heightMeters, store.status === 'ready');

  // The stage's pointer chain, most specific first: a press on a table or grip
  // is a gesture; on bare plan it sweeps a marquee; anything else pans/pinches.
  const marquee = useEditorMarquee({
    stageRef: viewport.stageRef,
    viewBox: viewport.viewBox,
    document: committed,
    enabled: store.status === 'ready',
    selectedIds: store.selectedIds,
    onSelectMany: store.selectMany,
    fallback: viewport.stageHandlers,
  });

  const drag = useEditorDrag({
    stageRef: viewport.stageRef,
    viewBox: viewport.viewBox,
    document: committed,
    snapEnabled,
    selectedIds: store.selectedIds,
    onSelect: store.select,
    onCommit: store.apply,
    fallback: marquee.handlers,
  });

  const renderDoc = drag.previewDoc ?? committed;
  // The on-canvas grips size themselves in screen pixels, so they need the live
  // stage↔plan scale rather than the viewBox alone (§4.4).
  const pxPerCm = useStageScale(viewport.stageRef, viewport.viewBox, store.status === 'ready');

  useEditorKeyboard({
    enabled: store.status === 'ready' && !modalOpen,
    document: committed,
    selectedIds: store.selectedIds,
    apply: store.apply,
    undo: store.undo,
    redo: store.redo,
    clearSelection: store.clearSelection,
    onDeleteSelected,
  });

  // Warn the browser before a reload / tab-close while geometry edits are unsaved.
  const { dirty } = store;
  useEffect(() => {
    if (!dirty) {
      return;
    }
    // Calling preventDefault triggers the browser's unsaved-changes prompt (the
    // modern replacement for the deprecated `event.returnValue`).
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const overlaps = useMemo(() => overlappingTableIds(renderDoc.tables), [renderDoc.tables]);
  const selectedTable: FloorPlanTableGeometry | null = renderDoc.tables.find((t) => t.id === store.selectedId) ?? null;

  return {
    ...store,
    document: renderDoc,
    committed,
    gridVisible,
    setGridVisible,
    snapEnabled,
    setSnapEnabled,
    viewport,
    pxPerCm,
    dragHandlers: drag.handlers,
    guides: drag.guides,
    gesture: drag.gesture,
    marquee: marquee.band,
    overlaps,
    overlapCount: overlaps.size,
    selectedTable,
    /** Align/distribute act on the whole selection; both are pure document ops. */
    alignSelection: useCallback(
      (edge: AlignEdge) => apply(alignTables(committed, selectedIds, edge)),
      [apply, committed, selectedIds],
    ),
    distributeSelection: useCallback(
      (axis: PlanAxis) => apply(distributeTables(committed, selectedIds, axis)),
      [apply, committed, selectedIds],
    ),
  };
}

export type FloorPlanEditorApi = ReturnType<typeof useFloorPlanEditor>;
