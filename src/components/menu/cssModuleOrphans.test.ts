import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/**
 * `scripts/check-css-module-orphans.mjs`, exercised as CI runs it (issue #615).
 *
 * The gate exists because `ProductIngredientsManager.module.css` — 379 lines, 28 classes — sat in
 * the tree with no importer while three CSS gates ran on every PR: the bindings check had no uses
 * to resolve, the physical-CSS ratchet does not count a file that is never built, and the
 * file-length baseline actively EXCUSED it.
 *
 * Every case below runs the REAL script against a fixture tree in a temp directory, the way
 * `localeUntranslatedGate.test.ts` does: the script resolves the repo from its own location, so
 * copying it (and its one lib dependency) beside a fixture `src/` is enough, and no test-only hook
 * has to exist in a production gate.
 *
 * A GREEN RESULT FROM AN ORPHAN CHECK IS THE UNINFORMATIVE ONE — a scanner that matched nothing at
 * all would report a clean tree forever and look exactly like this. So the positive control (a
 * stylesheet that IS imported passes) is worth little on its own, and the negative controls carry
 * the weight: an orphaned fixture must FAIL and must name the file.
 */

const REPO_ROOT = resolve(__dirname, '../../..');
const SCRIPT = join(REPO_ROOT, 'scripts/check-css-module-orphans.mjs');
const LIB = join(REPO_ROOT, 'scripts/lib/comment-stripper.mjs');

const workdirs: string[] = [];

/** Write a fixture `src/` tree, run the real gate over it, and return its status and output. */
function runGate(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), 'css-orphan-gate-'));
  workdirs.push(root);
  mkdirSync(join(root, 'scripts/lib'), { recursive: true });
  copyFileSync(SCRIPT, join(root, 'scripts/check-css-module-orphans.mjs'));
  copyFileSync(LIB, join(root, 'scripts/lib/comment-stripper.mjs'));

  for (const [name, contents] of Object.entries(files)) {
    const target = join(root, 'src', name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents);
  }

  const run = spawnSync('node', [join(root, 'scripts/check-css-module-orphans.mjs')], { encoding: 'utf8' });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

afterAll(() => {
  for (const dir of workdirs) rmSync(dir, { recursive: true, force: true });
});

describe('check-css-module-orphans', () => {
  it('passes when every stylesheet has an importer (positive control)', () => {
    const { status, output } = runGate({
      'components/Card.tsx': "import styles from './Card.module.css';\nexport default styles;\n",
      'components/Card.module.css': '.card { color: red; }\n',
    });

    expect(status).toBe(0);
    // The success line prints what was examined, so a green run is falsifiable rather than a bare OK.
    expect(output).toMatch(/1 stylesheets/);
  });

  it('FAILS on an orphan and names it (negative control — the whole point)', () => {
    const { status, output } = runGate({
      'components/Card.tsx': "import styles from './Card.module.css';\nexport default styles;\n",
      'components/Card.module.css': '.card { color: red; }\n',
      'components/Left.module.css': '.dead { color: blue; }\n',
    });

    expect(status).toBe(1);
    expect(output).toContain('src/components/Left.module.css');
    // And it must not drag the live one in with it.
    expect(output).not.toContain('src/components/Card.module.css');
  });

  it('reproduces the real defect: the component moved to another stylesheet', () => {
    const { status, output } = runGate({
      'components/Manager.tsx': "import styles from './Group.module.css';\nexport default styles;\n",
      'components/Group.module.css': '.group { display: flex; }\n',
      'components/Manager.module.css': '.row { display: flex; }\n',
    });

    expect(status).toBe(1);
    expect(output).toContain('src/components/Manager.module.css');
  });

  it('counts a stylesheet reached only by `composes: … from` as alive', () => {
    // MEASURED AGAINST THE REAL TREE, not invented: the first version of this gate reported
    // `templates/craft/primitives.module.css` as dead. Nine craft stylesheets compose their buttons
    // from it and no .tsx imports it directly. A gate whose first output says to delete the design
    // system's primitives is a gate that gets switched off the same afternoon.
    const { status, output } = runGate({
      'templates/Page.tsx': "import styles from './Page.module.css';\nexport default styles;\n",
      'templates/Page.module.css': ".btn { composes: btnPrimary from './primitives.module.css'; }\n",
      'templates/primitives.module.css': '.btnPrimary { padding: 1rem; }\n',
    });

    expect(status).toBe(0);
    expect(output).not.toContain('primitives.module.css');
  });

  it('does NOT let an orphan keep its own dependency alive (reachability, not reference count)', () => {
    // THE CONTROL FOR THE PREVIOUS CASE. A gate that merely counted "is this file named anywhere"
    // would pass both, so this is the one that proves the live set is a closure from the TypeScript
    // entry points rather than a mention count.
    const { status, output } = runGate({
      'templates/Page.tsx': 'export default 1;\n',
      'templates/Dead.module.css': ".btn { composes: btnPrimary from './alsoDead.module.css'; }\n",
      'templates/alsoDead.module.css': '.btnPrimary { padding: 1rem; }\n',
    });

    expect(status).toBe(1);
    expect(output).toContain('src/templates/Dead.module.css');
    expect(output).toContain('src/templates/alsoDead.module.css');
  });

  it('counts a side-effect import, which carries no binding at all', () => {
    const { status } = runGate({
      'app/layout.tsx': "import './globals.module.css';\nexport default 1;\n",
      'app/globals.module.css': '.body { margin: 0; }\n',
    });

    expect(status).toBe(0);
  });

  it('counts an `@/`-aliased import', () => {
    const { status } = runGate({
      'components/Far.tsx': "import styles from '@/app/styles/Shared.module.css';\nexport default styles;\n",
      'app/styles/Shared.module.css': '.shared { color: red; }\n',
    });

    expect(status).toBe(0);
  });

  it('does not let a COMMENTED-OUT import keep a stylesheet alive', () => {
    const { status, output } = runGate({
      'components/Card.tsx': "// import styles from './Card.module.css';\nexport default 1;\n",
      'components/Card.module.css': '.card { color: red; }\n',
    });

    expect(status).toBe(1);
    expect(output).toContain('src/components/Card.module.css');
  });

  it('fails closed when it resolves nothing, instead of reporting a clean tree', () => {
    // A scanner that silently matches nothing is the failure mode this gate is most exposed to,
    // because its healthy output and its broken output are both "no orphans".
    const { status, output } = runGate({ 'components/Card.tsx': 'export default 1;\n' });

    expect(status).toBe(1);
    expect(output).toMatch(/scanner is broken/);
  });

  it('does not read a runtime file path as an import (S8786 rewrite control)', () => {
    // The regex became `\bimport\s[^'"]*['"]…['"]` to remove super-linear backtracking (Sonar
    // S8786). That form has no `from` in it, so this case is what proves it did not become a
    // "any string ending in .module.css" match: a QUOTE is a hard barrier the class cannot cross,
    // which is why the `import` on line 1 cannot reach the path on line 2.
    const { status, output } = runGate({
      'components/reader.ts': [
        "import { readFileSync } from 'node:fs';",
        "export const css = readFileSync('./Card.module.css', 'utf8');",
      ].join('\n'),
      'components/Card.module.css': '.card { color: red; }\n',
    });

    expect(status).toBe(1);
    expect(output).toContain('src/components/Card.module.css');
  });
});
