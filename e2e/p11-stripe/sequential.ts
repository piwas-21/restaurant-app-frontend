export async function runSequentially<T>(
  values: readonly T[],
  action: (value: T, index: number) => Promise<void>,
  index = 0,
): Promise<void> {
  if (index >= values.length) return;
  await action(values[index], index);
  return runSequentially(values, action, index + 1);
}
