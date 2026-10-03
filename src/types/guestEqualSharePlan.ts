export interface GuestEqualSharePlanIntent {
  readonly serviceSessionId: string;
  readonly participantFingerprint: string;
  readonly operationId: string;
  readonly expectedAccountRevision: number;
  readonly shareCount: number;
  readonly supersedesPlanId: string | null;
  readonly createdAt: number;
}
