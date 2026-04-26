# Architecture Decision Records

Index of ADRs for the RUMI Frontend. New ADRs are numbered sequentially with no gaps.

> **When to write an ADR**: any decision that constrains future implementation choices, has non-obvious tradeoffs, or that you'd want a future agent to understand without re-deriving. Bug fixes don't need ADRs; choosing a library or pattern usually does.
>
> **Format**: copy [ADR-template.md](ADR-template.md) and fill in. Status starts as `Proposed`; flip to `Accepted` on merge.

## Index

| # | Title | Status | Date | Tags |
|---|---|---|---|---|
| [001](ADR-001-app-router-context-api.md) | App Router + Context API for state | Accepted | 2026-04-27 | architecture, state |
| [002](ADR-002-css-modules-and-tokens.md) | CSS Modules + design tokens (vs Tailwind) | Accepted | 2026-04-27 | styling, design-system |
| [003](ADR-003-i18next-locale-parity.md) | i18next + 9 locales with parity rule | Accepted | 2026-04-27 | i18n |
| [004](ADR-004-zod-form-validation.md) | Zod as form-validation source of truth | Accepted | 2026-04-27 | forms, validation |
| [005](ADR-005-design-system-primitives.md) | BaseModal, FormField, StatusBadge as mandatory wrappers | Accepted | 2026-04-27 | design-system |

## Conventions

- Filename: `ADR-NNN-kebab-case-title.md`
- Numbering: gap-free; if rejected, mark Status: `Rejected` and keep the file (history matters)
- Status progression: `Proposed` → `Accepted` / `Rejected` → `Deprecated` / `Superseded by ADR-XXX`
- One ADR = one decision; if a record grows three sub-decisions, split it
- Reference ADRs from code comments via `// See docs/adr/ADR-NNN.md` when behaviour is non-obvious
