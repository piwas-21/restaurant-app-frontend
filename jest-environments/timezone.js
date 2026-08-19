/**
 * A jsdom test environment that runs a suite in a chosen device timezone.
 *
 * Why this exists: three of the last four clock defects in this system (backend #372, #369, #363)
 * were "whose calendar day is it" bugs, and the review lesson each time was that a test which
 * cannot move the clock's ZONE is a tautology on a UTC-clocked host — every CI runner and every
 * container here is UTC, so a local-time implementation and a UTC one agree and the test is green
 * against both. `process.env.TZ = ...` inside the test file is too late: jest's jsdom context has
 * already captured the zone (measured — the assignment has no effect there), so it has to happen
 * before the environment is constructed.
 *
 * Usage — ONE docblock at the top of the test file, carrying both pragmas:
 *
 *   /**
 *    * @jest-environment ./jest-environments/timezone.js
 *    * @jest-environment-options {"timezone": "America/Los_Angeles"}
 *    *\/
 *
 * They must share a block: jest-docblock parses only the FIRST comment, so two separate blocks
 * silently drop the options and hand you the runner's own zone back — which is why a missing
 * `timezone` throws below rather than defaulting. Pick the zone by the DIRECTION the defect lies
 * in: west of UTC catches a reader that formats a midnight-UTC day on the local clock, east of it
 * catches one that pushes a local midnight through `toISOString()`. One zone cannot see both.
 */

const JSDOMEnvironment = require('jest-environment-jsdom').default;

class TimezoneEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    const timezone = config?.projectConfig?.testEnvironmentOptions?.timezone;
    if (!timezone) {
      throw new Error(
        'jest-environments/timezone.js: no `timezone` in @jest-environment-options. ' +
          'Both pragmas must live in ONE docblock, or the options are dropped and the suite ' +
          'runs on the ambient zone — silently proving nothing.',
      );
    }

    const previous = process.env.TZ;
    // Before `super()`, which is what creates the jsdom vm context that captures the zone.
    process.env.TZ = timezone;
    try {
      super(config, context);
    } catch (error) {
      // The instance never exists on this path, so `teardown()` will never run: restore here or
      // the zone leaks into every later suite in this reused worker, silently and out of order.
      restoreTimezone(previous);
      throw error;
    }

    this.previousTimezone = previous;
  }

  async teardown() {
    // The worker process is reused by later suites, so the zone must not leak out of this file.
    restoreTimezone(this.previousTimezone);
    await super.teardown();
  }
}

function restoreTimezone(previous) {
  if (previous === undefined) delete process.env.TZ;
  else process.env.TZ = previous;
}

module.exports = TimezoneEnvironment;
