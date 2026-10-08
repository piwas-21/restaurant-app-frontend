/** Run asynchronous operations one at a time, stopping at the first rejection. */
export function runSequentially(values, action) {
  return values.reduce((pending, value, index) => pending.then(() => action(value, index)), Promise.resolve());
}
