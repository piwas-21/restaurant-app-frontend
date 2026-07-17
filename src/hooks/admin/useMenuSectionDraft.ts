'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MenuSection, MenuSectionItem } from '@/types/menu';

interface UseMenuSectionDraftOptions {
  sections: MenuSection[];
  onChange: (sections: MenuSection[]) => void;
}

/**
 * Owns the menu-section draft: the local copy, which rows are open, and the
 * drag/delete interaction state. Extracted from `MenuSectionEditor` (redesign #176,
 * slice 7) — the fuller half of the split `utils/menuSectionDraft.ts` (PR1) promised,
 * so the component is left rendering only.
 *
 * Every mutation propagates immediately (`onChange`). This used to be the `live` half
 * of a `commitMode` flag whose `explicit` half buffered edits behind the bundle modals'
 * own Save/Cancel; those modals were deleted in PR2e and the flag with them, since the
 * unified editor page owns the single page-level Save (owner call, slice 7) and a nested
 * second commit point would compete with it.
 */
export function useMenuSectionDraft({ sections, onChange }: UseMenuSectionDraftOptions) {
  const [localSections, setLocalSections] = useState<MenuSection[]>(sections);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sectionToDelete, setSectionToDelete] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Resync when the sections prop changes. The parent echoes back the very array we
  // emitted, so this re-sets the array we already hold and React bails on Object.is —
  // the echo is an identity operation, not a clobber. See the PR #212 thread: an echo
  // guard here was measured to change nothing.
  useEffect(() => {
    setLocalSections(sections);
  }, [sections]);

  /** The one write point. It always pushes upward, so the page's form state is always
   *  the draft — there is no way to leave an edit stranded in here. */
  const applySections = useCallback(
    (next: MenuSection[]) => {
      setLocalSections(next);
      onChange(next);
    },
    [onChange],
  );

  const toggleSection = useCallback((sectionId: string) => {
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const addSection = useCallback(() => {
    const newSection: MenuSection = {
      id: `temp-${Date.now()}`,
      name: '',
      description: '',
      displayOrder: 0, // New section goes to top
      isRequired: true,
      minSelection: 1,
      maxSelection: 1,
      items: [],
    };

    // Update display orders for existing sections
    const updatedSections = localSections.map((s) => ({ ...s, displayOrder: s.displayOrder + 1 }));

    applySections([newSection, ...updatedSections]);
    setExpandedSections((current) => new Set([...current, newSection.id]));
  }, [localSections, applySections]);

  const updateSection = useCallback(
    (index: number, updates: Partial<MenuSection>) => {
      const newSections = [...localSections];
      newSections[index] = { ...newSections[index], ...updates };
      applySections(newSections);
    },
    [localSections, applySections],
  );

  const updateSectionItems = useCallback(
    (index: number, items: MenuSectionItem[]) => {
      updateSection(index, { items });
    },
    [updateSection],
  );

  const confirmRemoveSection = useCallback((index: number) => setSectionToDelete(index), []);
  const cancelRemoveSection = useCallback(() => setSectionToDelete(null), []);

  const handleRemoveSection = useCallback(() => {
    if (sectionToDelete !== null) {
      applySections(localSections.filter((_, i) => i !== sectionToDelete));
      setSectionToDelete(null);
    }
  }, [sectionToDelete, localSections, applySections]);

  const moveSection = useCallback(
    (index: number, direction: 'up' | 'down') => {
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === localSections.length - 1)) {
        return;
      }

      const newSections = [...localSections];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
      newSections.forEach((section, i) => {
        section.displayOrder = i;
      });

      applySections(newSections);
    },
    [localSections, applySections],
  );

  const handleDragStart = useCallback((index: number) => setDraggedIndex(index), []);
  const handleDragEnd = useCallback(() => setDraggedIndex(null), []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      if (draggedIndex === null || draggedIndex === index) return;

      const newSections = [...localSections];
      const [draggedSection] = newSections.splice(draggedIndex, 1);
      newSections.splice(index, 0, draggedSection);
      newSections.forEach((section, i) => {
        section.displayOrder = i;
      });

      applySections(newSections);
      setDraggedIndex(index);
    },
    [draggedIndex, localSections, applySections],
  );

  return {
    localSections,
    expandedSections,
    sectionToDelete,
    draggedIndex,
    toggleSection,
    addSection,
    updateSection,
    updateSectionItems,
    confirmRemoveSection,
    cancelRemoveSection,
    handleRemoveSection,
    moveSection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}
