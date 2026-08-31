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
   * The restaurant's own logo (SOFRA-ONBOARDING-PLAN O6), or null when it has none —
   * in which case the chromes render the restaurant's NAME as text, never a stand-in
   * image. The backend normalises an empty string to null precisely so `??` works here.
   *
   * Deliberately absent from `UpdateRestaurantInfoCommand` below: the logo has its own
   * endpoints, so a General Settings save — which is a FULL upsert — cannot wipe it.
   */
  logoUrl: string | null;
  /** Dark-theme variant; null falls back to {@link logoUrl}. */
  logoDarkUrl: string | null;
  /**
   * The restaurant's own full-width landing background. Null means the tenant has not uploaded
   * one and the page uses the baked, tenant-neutral platform artwork. Kept out of the profile PUT:
   * its dedicated upload/delete endpoints prevent a General Settings save from wiping the image.
   */
  interiorImageUrl: string | null;
  phoneNumbers: RestaurantPhoneNumberDto[];
}

/** Which stored logo an upload or delete addresses. Mirrors the backend `LogoVariant`. */
export type LogoVariant = 'light' | 'dark';

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
