#!/usr/bin/env node
// PostToolUse single-file checker (frontend). Instant in-loop feedback on file-length
// + a few CLAUDE.md conventions right after an edit, before pre-commit/CI.
// Contract: NON-BLOCKING (always exit 0), fast (<200ms, no deps/build/network), quiet
// on success, warnings to stderr as `path: <rule>: <details>`.
// Path from argv[2], else from the PostToolUse hook JSON on stdin (.tool_input.file_path).
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";

function getPathFromStdin() {
  try {
    const raw = readFileSync(0, "utf8");
    return JSON.parse(raw)?.tool_input?.file_path ?? "";
  } catch {
    return "";
  }
}

const file = process.argv[2] || (process.stdin.isTTY ? "" : getPathFromStdin());
if (!file) process.exit(0);
if (!/\.(tsx?|css)$/.test(file)) process.exit(0);
if (/\.(test|spec)\.|\.d\.ts$|\/node_modules\/|\/\.next\//.test(file)) process.exit(0);

// Confine reads to the repo tree (hook cwd = repo root): the path arrives from
// tool JSON/argv and is only ever a repo file — anything resolving outside is
// never read (Sonar S8707; positive-branch guard so the taint engine sees it).
const resolved = resolve(file);
let src = "";
if (resolved.startsWith(process.cwd() + sep)) {
  try {
    src = readFileSync(resolved, "utf8");
  } catch {
    // unreadable/deleted — nothing to check
  }
}
if (!src) process.exit(0);
const lines = src.split("\n");
const loc = lines.length;
const warn = (msg) => process.stderr.write(`${file}: ${msg}\n`);

// File-length limits (frontend/CLAUDE.md §4)
let lim = 0,
  kind = "";
if (/\/app\/(.*\/)?page\.tsx$/.test(file)) [lim, kind] = [200, "page"];
else if (/Modal\.tsx$/.test(file)) [lim, kind] = [200, "modal"];
else if (/\/hooks\/use[^/]*\.ts$/.test(file)) [lim, kind] = [200, "hook"];
else if (/\/(services|lib)\//.test(file)) [lim, kind] = [200, "service/lib"];
else if (/\/types\//.test(file)) [lim, kind] = [150, "type"];
else if (/\.module\.css$/.test(file)) [lim, kind] = [200, "CSS module"];
else if (/\.tsx$/.test(file)) [lim, kind] = [250, "component"];
if (lim && loc > lim) warn(`file-length: ${kind} ~${loc} LOC (limit ${lim}) — extract per CLAUDE.md §4`);

// Convention checks
const isTs = /\.tsx?$/.test(file);
if (isTs && /:\s*any\b/.test(src.replace(/\/\/.*$/gm, "")))
  warn("`: any` — use `unknown` + a type guard (CLAUDE.md §5.8)");
if (/Dialog\.tsx$/.test(file)) warn("filename `*Dialog.tsx` — overlays must be named `*Modal.tsx` (§5.2)");
if (/\.tsx$/.test(file) && /style=\{\{[^}]*#[0-9a-fA-F]{3,6}/.test(src))
  warn("inline hex in a style={{}} — use a CSS variable / CSS module (§5.5/§5.6)");
if (/\.css$/.test(file) && /@media[^{]*prefers-color-scheme:\s*dark/.test(src))
  warn("`@media (prefers-color-scheme: dark)` — use `html[data-theme=\"dark\"]` (§5.7)");
if (
  /\.css$/.test(file) &&
  /\/(design-system|templates)\//.test(file) &&
  !/\/design-system\/tokens\//.test(file) &&
  /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(src)
)
  warn("raw color outside design-system/tokens — use var(--*); color values live in src/design-system/tokens/ (S15 T1 ratchet)");
if (!/\/lib\/config\.ts$/.test(file) && /process\.env\.NEXT_PUBLIC_/.test(src))
  warn("`process.env.NEXT_PUBLIC_*` outside src/lib/config.ts — read typed constants from config (§5.12)");

process.exit(0);
