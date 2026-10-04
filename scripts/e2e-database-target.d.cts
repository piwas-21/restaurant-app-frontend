export type E2EDatabaseTarget = 'disposable' | 'staging';

export function validateE2EDatabaseTarget(env?: Record<string, string | undefined>): { target: E2EDatabaseTarget };

export function createPsqlEnvironment(env?: Record<string, string | undefined>): Record<string, string | undefined>;
