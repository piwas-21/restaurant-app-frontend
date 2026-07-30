/**
 * Frontend mirrors of the backend `Features/Setup/Dtos/*` shapes
 * (SOFRA-ONBOARDING-PLAN O4).
 *
 * Source of truth: `backend/RestaurantSystem.Api/Features/Setup/`. Keep field names
 * and nullability in lock-step — the .NET camelCase serialiser is what these reflect.
 */

import type { ApiResponse } from '@/types/order';

export interface SetupStepDto {
  /** Stable step id — also the i18n key stem and the route lookup. */
  key: string;
  /** Owning module id, or null when every tenant needs the step. */
  moduleId: string | null;
  /**
   * True when `isDone` was OBSERVED from real data rather than claimed. The UI must
   * not offer a "mark as done" control for these — the API refuses the write.
   */
  isDerived: boolean;
  isDone: boolean;
}

export interface SetupChecklistDto {
  isDismissed: boolean;
  doneCount: number;
  /** Only the steps this tenant's modules entitle them to, in working order. */
  steps: SetupStepDto[];
}

export type SetupChecklistResponse = ApiResponse<SetupChecklistDto>;
