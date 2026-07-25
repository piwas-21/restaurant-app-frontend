/**
 * Frontend mirrors of the backend `Features/RestaurantInfo/Dtos/*` and
 * `Features/RestaurantInfo/Commands/*` shapes.
 *
 * Source of truth: `backend/RestaurantSystem.Api/Features/RestaurantInfo/`.
 * Keep field names and nullability in lock-step (camelCase serialiser on
 * the .NET side flips PascalCase property names to camelCase JSON, which
 * is what these types reflect).
 */

import type { ApiResponse } from '@/types/order';

export interface RestaurantPhoneNumberDto {
  id: string;
  label: string | null;
  /** E.164, e.g. `+41227863333`. */
  number: string;
  whatsAppEnabled: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface RestaurantInfoDto {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  country: string;
  /** Decimal serialised as number; null when not set. */
  latitude: number | null;
  longitude: number | null;
  email: string;
  website: string | null;
  /** Runtime colour-palette key (ADR-007); null = the template's baked palette. */
  themePaletteKey: string | null;
  /**
   * Legacy floor-plan entrance marker (canvas percentages, 0–100). Optional AND
   * nullable. No longer edited in the admin editor as of the metre-scale rewrite
   * (FLOOR-PLAN-REVAMP S6 retired the pixel canvas); the entrance returns as a
   * plan item in S8 and these columns retire in S10. Kept on the DTO until then.
   */
  entrancePositionX?: number | null;
  entrancePositionY?: number | null;
  phoneNumbers: RestaurantPhoneNumberDto[];
}

// ── Commands ─────────────────────────────────────────────────────────

export interface UpdateRestaurantInfoCommand {
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  postalCode: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  email: string;
  website: string | null;
  themePaletteKey: string | null;
  /** Optional until the backend entrance-position PR deploys (additive). */
  entrancePositionX?: number | null;
  entrancePositionY?: number | null;
}

export interface AddPhoneNumberCommand {
  label: string | null;
  number: string;
  whatsAppEnabled: boolean;
  displayOrder: number;
  isActive: boolean;
}

export interface UpdatePhoneNumberCommand {
  /** Echoed for symmetry with the backend record; the route id wins. */
  id: string;
  label: string | null;
  number: string;
  whatsAppEnabled: boolean;
  displayOrder: number;
  isActive: boolean;
}

// Re-export for convenience so callers can pull a single import.
export type { ApiResponse };
