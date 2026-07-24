'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { hoverCardPosition } from '@/components/floor-plan/guest/hoverCardPosition';

const CLOSE_GRACE_MS = 220;

/**
 * Desktop hover-card state for the guest map (FLOOR-PLAN-REVAMP §4.2, SC
 * 1.4.13). The card is dismissible (the caller wires Esc + the close button to
 * `clear`), hoverable (entering it pins it open via `cardHandlers`), and
 * persistent (an 80–220ms grace before it closes). No card on touch — a tap
 * selects instead. Placement is the pure `hoverCardPosition`.
 */
export function useGuestHover(stageRef: RefObject<HTMLDivElement | null>) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const pinned = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    cancelClose();
    pinned.current = false;
    setHoverId(null);
  }, [cancelClose]);

  // Never leave a close timer running after unmount.
  useEffect(() => cancelClose, [cancelClose]);

  const locate = useCallback(
    (id: string) => {
      const stage = stageRef.current;
      const el = stage?.querySelector(`[data-table-id="${id}"]`);
      if (!stage || !el) {
        return;
      }
      const p = hoverCardPosition(el.getBoundingClientRect(), stage.getBoundingClientRect());
      setPosition({ left: p.left, top: p.top });
    },
    [stageRef],
  );

  const onStagePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'touch') {
        return;
      }
      const id = (e.target as Element).closest('[data-table-id]')?.getAttribute('data-table-id');
      if (id) {
        cancelClose();
        setHoverId(id);
        locate(id);
      }
    },
    [cancelClose, locate],
  );

  const scheduleClose = useCallback(() => {
    cancelClose();
    timer.current = setTimeout(() => {
      if (!pinned.current) {
        setHoverId(null);
      }
    }, CLOSE_GRACE_MS);
  }, [cancelClose]);

  const cardHandlers = {
    onPointerEnter: () => {
      cancelClose();
      pinned.current = true;
    },
    onPointerLeave: () => {
      pinned.current = false;
      scheduleClose();
    },
  };

  return { hoverId, position, onStagePointerMove, onStagePointerLeave: scheduleClose, cardHandlers, clear };
}
