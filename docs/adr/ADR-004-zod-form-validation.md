# ADR-004 — Zod as form-validation source of truth

**Status:** Accepted
**Date:** 2026-04-27
**Author:** mahmutkaya
**References:**
- `src/schemas/` — Zod schemas
- Forms across `src/components/**/` using `react-hook-form` + `@hookform/resolvers/zod`

---

## Context

A frontend form has three parts that need to agree:
1. **The runtime value** — what the user typed
2. **The static type** — what TypeScript thinks the form value is
3. **The validation rules** — what makes a value acceptable

Drift between any two of these is a bug pattern: a field marked optional in TypeScript but required in the validator silently rejects valid submissions; a field validated as email but typed as `string` allows invalid types upstream; a custom validation function that doesn't match the type narrowing leaves consumers handling cases that can't happen.

We also have a backend (.NET / FluentValidation) that does its own server-side validation — frontend validation is for UX, not security. The frontend doesn't need to replicate every backend rule, but it MUST not allow client-side submissions that the backend will obviously reject (e.g. blank required fields, invalid email format).

## Decision

**Use Zod schemas as the single source of truth for form validation. Derive the TypeScript type from the schema via `z.infer`. Wire the schema to `react-hook-form` via `@hookform/resolvers/zod`.**

### Pattern

```typescript
// src/schemas/customer.schema.ts
import { z } from "zod";

export const customerInfoSchema = z.object({
  name: z.string().min(1, "validation.name_required"),
  email: z.string().email("validation.email_invalid"),
  phone: z.string().regex(/^\+?[0-9\s-]{7,15}$/, "validation.phone_invalid"),
});

export type CustomerInfo = z.infer<typeof customerInfoSchema>;
```

```typescript
// In the form component
const form = useForm<CustomerInfo>({
  resolver: zodResolver(customerInfoSchema),
});
```

### Rules

- **One schema per form** lives in `src/schemas/<feature>.schema.ts`.
- **Error messages are i18n keys**, not English strings. Render via `t(error.message)`.
- **Type is derived from schema**, not the other way around. Never write `z.object({ ... })` and a separate `interface Customer` for the same shape.
- **Schemas can compose**: `addressSchema.merge(customerInfoSchema)` etc. Reuse over duplication.

## Consequences

### Positive
- **Type + runtime + validation in lock-step.** Refactoring a field updates all three at once.
- **i18n-friendly errors** — error keys map to locale files; users see translated errors.
- **Schema reuse across forms** — the same `customerInfoSchema` powers checkout-customer-info, profile-edit, and admin-create-customer.
- **Test surface is the schema** — unit tests assert `customerInfoSchema.safeParse(input)` instead of mounting a form.

### Negative
- **Bundle cost** — Zod is ~12 kB gz. Acceptable for the value delivered.
- **Backend validation can't be derived from frontend Zod** without a code-gen step. We accept the duplication: backend FluentValidation has fields the frontend Zod doesn't (DB uniqueness, business rules) and vice versa (display formatting). Convergence is a Sprint-3+ topic.
- **Async / cross-field validation** — Zod supports it via `.refine()` and `.superRefine()`, but the syntax can get gnarly. For complex rules, prefer extracting a named validator function.

### Mitigation for the negatives
- Schemas live in `src/schemas/` so they're easy to colocate with tests and find when refactoring.
- For the backend ↔ frontend validator divergence, document in each schema's top comment which backend validator it mirrors (when it does).
- Code review enforces "every form uses Zod + react-hook-form" — no ad-hoc useState + manual validation.

## Alternatives considered

### Alternative A: Yup
Mature, well-documented, similar API. Rejected because Zod has stronger TypeScript inference (`z.infer<>` is sharper than `yup.InferType<>`), Zod is actively developed, and Yup's TypeScript support has historically lagged.

### Alternative B: Hand-rolled validation in `useForm` mode: 'onChange'`
No library; just `register('email', { pattern: /...email regex.../ })`. Rejected because (a) error messages get hardcoded in the registration call (i18n becomes awkward), (b) there's no single object representing "the validation rules" to test or share, (c) types and rules drift trivially.

### Alternative C: Backend-first validation (no client-side validation)
Submit the form, render server errors. Rejected for UX: users want immediate feedback on a typo, not a round-trip per failed submit.
