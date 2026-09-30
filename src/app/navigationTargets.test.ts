/**
 * Every literal `router.push` / `router.replace` target must resolve to a real route
 * (BUGS-IMPROVEMENTS-PLAN D1).
 *
 * This exists because two guards spent an unknown length of time pushing to `/login` — a
 * route this app has never had — sending an unauthenticated cashier, and anyone who
 * followed the first-run checklist's "Try the till" row without a live session, to a 404.
 * Neither was caught by a type, a lint rule or a test: `router.push` takes a string, and
 * the string was well-formed. They were found by reading, and reading does not scale to a
 * third one.
 *
 * It walks the source rather than the router because Next has no build-time check for this
 * and no runtime one either — an unknown path is a legitimate 404, not an error.
 *
 * Scope, deliberately narrow so it cannot go flaky:
 *  - only LITERAL targets starting with `/`. A target assembled from a variable is out of
 *    reach here and stays that way;
 *  - a `${…}` segment is treated as a wildcard that must land on a `[param]` directory, so
 *    `/admin/user-groups/${group.id}` still proves `[id]/page.tsx` exists;
 *  - query and hash are stripped before resolving.
 */
import fs from 'node:fs';
import path from 'node:path';
import { LANGUAGE_CODES } from '@/config/languageConfig';

const SRC = path.resolve(__dirname, '..');
const APP = __dirname;
const LOCALE_APP = path.join(APP, '[locale]');
const SUPPORTED_LOCALES = new Set<string>(LANGUAGE_CODES);

/** Every `.ts`/`.tsx` file under `src`, excluding this test's own fixtures. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') sourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

/**
 * Does `segments` resolve to a page under `dir`?
 *
 * Route GROUPS — `(auth)` — are transparent in the URL, so an unmatched segment is also
 * tried inside every group directory. Without that, `/forgot-password` (which lives at
 * `app/(auth)/forgot-password`) would read as missing and this test would fail on correct
 * code, which is the failure mode that gets a check deleted.
 */
function hasPage(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'page.tsx')) || fs.existsSync(path.join(dir, 'page.ts'));
}

function matchesSegment(routeSegment: string, targetSegment: string): boolean {
  if (targetSegment.includes('${')) return routeSegment.startsWith('[');
  return routeSegment === targetSegment || (routeSegment === '[locale]' && SUPPORTED_LOCALES.has(targetSegment));
}

function resolveChild(dir: string, child: fs.Dirent, head: string, rest: string[], segments: string[]): boolean {
  if (!child.isDirectory()) return false;
  const childPath = path.join(dir, child.name);
  if (child.name.startsWith('(') && child.name.endsWith(')')) return resolves(childPath, segments);
  return matchesSegment(child.name, head) && resolves(childPath, rest);
}

function resolves(dir: string, segments: string[]): boolean {
  if (!fs.existsSync(dir)) return false;

  if (segments.length === 0) return hasPage(dir);

  const [head, ...rest] = segments;
  const children = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  return children.some((child) => resolveChild(dir, child, head, rest, segments));
}

interface Target {
  route: string;
  file: string;
}

function literalTargets(): Target[] {
  const pattern = /router\.(?:push|replace)\(\s*(['`])(\/[^'`]*)\1/g;
  const found: Target[] = [];
  for (const file of sourceFiles(SRC)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(pattern)) {
      found.push({ route: match[2], file: path.relative(SRC, file) });
    }
  }
  return found;
}

describe('navigation targets', () => {
  const targets = literalTargets();

  it('finds the literal targets to check (guards against a regex that silently matches nothing)', () => {
    // The check above is only worth having if it is actually looking at something. A
    // refactor to a navigation helper would drop this to zero and leave a green test
    // asserting nothing — the exact shape of rot this file exists to prevent.
    expect(targets.length).toBeGreaterThan(10);
    expect(targets.map((t) => t.route)).toContain('/auth/login');
  });

  it('does not resolve an unregistered path in either route tree', () => {
    const missingSegments = ['__route_that_does_not_exist__'];
    expect(resolves(APP, missingSegments)).toBe(false);
    expect(resolves(LOCALE_APP, missingSegments)).toBe(false);
  });

  it.each([...new Set(targets.map((t) => t.route))])('%s resolves to a route', (route) => {
    const pathname = route.split(/[?#]/)[0];
    const segments = pathname.split('/').filter(Boolean);
    const where = targets
      .filter((t) => t.route === route)
      .map((t) => t.file)
      .join(', ');
    // The message carries the call sites: a bare "expected false to be true" on a route
    // string leaves you grepping for who pushes it.
    expect(
      resolves(APP, segments) || resolves(LOCALE_APP, segments) || `${route} has no page (pushed from ${where})`,
    ).toBe(true);
  });
});
