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
 * Usage — per test file, in a docblock at the top:
 *
 *   /** @jest-environment ./jest-environments/timezone.js *\/
 *   /** @jest-environment-options {"timezone": "America/Los_Angeles"} *\/
 */

const JSDOMEnvironment = require('jest-environment-jsdom').default;

class TimezoneEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    const timezone = config?.projectConfig?.testEnvironmentOptions?.timezone;
    const previous = process.env.TZ;
    // Before `super()`, which is what creates the jsdom vm context that captures the zone.
    if (timezone) process.env.TZ = timezone;

    super(config, context);

    this.previousTimezone = previous;
    this.timezoneApplied = Boolean(timezone);
  }

  async teardown() {
    // The worker process is reused by later suites, so the zone must not leak out of this file.
    if (this.timezoneApplied) {
      if (this.previousTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = this.previousTimezone;
    }
    await super.teardown();
  }
}

module.exports = TimezoneEnvironment;
