/**
 * Leave this application for another origin.
 *
 * A one-line module rather than an inline `window.location.assign`, for two reasons.
 *
 * It is the single place that records WHY this is a full navigation and not `router.push`: the
 * destination is a different origin (Stripe's hosted Checkout), so the App Router cannot serve
 * it, and the browser must genuinely leave so the diner's back button returns them to a page
 * that still works.
 *
 * And it is a seam. `window.location` is non-configurable and its methods are read-only under the
 * jsdom this repo resolves (**26.1.0** — an earlier draft of this line said 30, which was jest's
 * version read off the wrong dependency). Verified, not assumed: both
 * `Object.defineProperty(window, 'location', …)` and `jest.spyOn(window.location, 'assign')` throw. Without a module to mock, no unit test could
 * assert that a redirect happened, or that one did NOT happen on a failure path.
 */
export function navigateExternal(url: string): void {
  window.location.assign(url);
}
