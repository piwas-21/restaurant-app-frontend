import type { CSSProperties } from 'react';

/**
 * Single source of truth for the table floor-plan canvas geometry, shared by
 * the customer map (`VisualTableLayout`), the admin editor (`TableCanvas` via
 * `useTableLayout`) and the table marker component. Positions are stored in
 * backend canvas units (600×500 — must match the backend seeder comment) and
 * rendered as percentages so both canvases scale identically; markers are
 * centre-anchored on (positionX, positionY) in BOTH renderers.
 */
export const CANVAS_WIDTH = 600;
export const CANVAS_HEIGHT = 500;

/** `padding-bottom` percentage that reproduces the canvas aspect ratio. */
export const CANVAS_ASPECT_PADDING_PCT = (CANVAS_HEIGHT / CANVAS_WIDTH) * 100;

/** Entrance-marker fallback (canvas percentages) until the admin places it. */
export const DEFAULT_ENTRANCE_POSITION = { x: 50, y: 10 } as const;

/**
 * The single uniform table-marker size, in canvas-percent units (72 canvas
 * units square → identical rendered size on the admin and customer maps).
 */
export const TABLE_MARKER_WIDTH_PCT = 12; // 72 / 600
export const TABLE_MARKER_HEIGHT_PCT = 14.4; // 72 / 500

/** Canvas-unit X → percentage of canvas width. */
export function toPercentX(positionX: number): number {
  return (positionX / CANVAS_WIDTH) * 100;
}

/** Canvas-unit Y → percentage of canvas height. */
export function toPercentY(positionY: number): number {
  return (positionY / CANVAS_HEIGHT) * 100;
}

/**
 * Position + size style for a table marker: percent-based so the marker
 * scales with the canvas, centre-anchored via the marker's own transform.
 */
export function getTableMarkerStyle(positionX: number, positionY: number): CSSProperties {
  return {
    left: `${toPercentX(positionX)}%`,
    top: `${toPercentY(positionY)}%`,
    width: `${TABLE_MARKER_WIDTH_PCT}%`,
    height: `${TABLE_MARKER_HEIGHT_PCT}%`,
  };
}
