import { AxeBuilder } from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import type { Result } from 'axe-core';

interface A11yOptions {
  /**
   * CSS selectors to exclude from the scan. Per E2E-STRATEGY §Accessibility,
   * scope exclusions to specific selectors, NEVER the whole page; document
   * the reason at the call site so the next reader knows whether the
   * exclusion is still load-bearing.
   */
  excludeSelectors?: string[];
}

/**
 * Run axe-core against the page and fail on critical/serious violations.
 *
 * Strategy: docs/E2E-STRATEGY.md §Accessibility. Default threshold is
 * critical + serious; moderate findings are logged for visibility but do
 * not fail the test (avoids drowning genuine regressions in colour-contrast
 * noise from work-in-progress design tokens).
 */
export async function expectNoA11yViolations(page: Page, opts: A11yOptions = {}): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  for (const selector of opts.excludeSelectors ?? []) {
    builder = builder.exclude(selector);
  }
  const results = await builder.analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );

  const moderate = results.violations.filter(
    (v) => v.impact === 'moderate' || v.impact === 'minor',
  );
  if (moderate.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[a11y] ${moderate.length} non-blocking violation(s):`,
      moderate.map((v) => `${v.id} (${v.impact})`).join(', '),
    );
  }

  expect(blocking, formatViolations(blocking)).toEqual([]);
}

function formatViolations(violations: Result[]): string {
  if (violations.length === 0) return '';
  return [
    `\nFound ${violations.length} blocking accessibility violation(s):`,
    ...violations.map(
      (v, i) =>
        `  ${i + 1}. [${v.impact ?? 'unknown'}] ${v.id}: ${v.description}\n` +
        `     affecting ${v.nodes.length} node(s): ${v.nodes
          .slice(0, 3)
          .map((n) => JSON.stringify(n.target))
          .join(', ')}${v.nodes.length > 3 ? ', …' : ''}`,
    ),
  ].join('\n');
}
