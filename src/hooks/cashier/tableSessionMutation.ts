type NumberRef = { current: number };
type BooleanRef = { current: boolean };
type BooleanSetter = (value: boolean) => void;

/** Invalidate reads before a write and provide one monotonic mutation identity. */
export function beginTableSessionMutation(
  requestRef: NumberRef,
  inFlightRef: BooleanRef,
  setIsLoading: BooleanSetter,
  operationRef: NumberRef,
): number {
  requestRef.current += 1;
  setIsLoading(false);
  inFlightRef.current = true;
  return ++operationRef.current;
}

export function isCurrentTableSessionMutation(
  mountedRef: BooleanRef,
  operationRef: NumberRef,
  operationId: number,
): boolean {
  return mountedRef.current && operationId === operationRef.current;
}

export function finishTableSessionMutation(
  mountedRef: BooleanRef,
  operationRef: NumberRef,
  inFlightRef: BooleanRef,
  setIsMutating: BooleanSetter,
  operationId: number,
): void {
  if (operationId !== operationRef.current) return;
  inFlightRef.current = false;
  if (mountedRef.current) setIsMutating(false);
}
