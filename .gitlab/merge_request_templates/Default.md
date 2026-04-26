<!--
  Default MR template — RUMI Backend
  See CLAUDE.md §6 (pre-implementation verification) and §8 (git workflow).
  Delete sections that don't apply (e.g. Schema/Contract Verification for non-DB changes).
-->

## Summary
<!-- 1–3 bullets describing what this MR does and why. -->
- ...

## Sprint task / issue
<!-- Link the sprint task (docs/SPRINT-PLAN.md task ID) or GitLab issue number. -->
- Closes #
- Sprint task: 

## Type
- [ ] `feat` — new user-visible feature
- [ ] `fix` — bug fix
- [ ] `refactor` — no behaviour change
- [ ] `chore` — build / CI / dependencies / config
- [ ] `docs` — documentation only
- [ ] `test` — tests only
- [ ] `perf` — performance

## Acceptance criteria coverage
<!--
  For each acceptance criterion in the linked issue / sprint task, state coverage.
  Delete this section for chore/docs MRs with no acceptance criteria.
-->

| Criterion | Status | Notes |
|---|---|---|
| <criterion 1> | Covered / Partial / Out of scope | <follow-up issue # if partial> |
| <criterion 2> | | |

## Schema / contract verification
<!--
  Required if this MR touches: EF migrations, DTOs, controller signatures, or any DB column.
  Delete the whole section if not applicable.
-->

**EF migrations referenced / added:**
- `RestaurantSystem.Infrastructure/Persistence/Migrations/<timestamp>_<name>.cs`

**DTOs added / modified:**
- `Features/<X>/Dtos/<Y>Dto.cs` — fields: ...

**Cross-repo impact (additive / breaking / none):**
- `printer-app/PrinterAPP/Models/`: <none / file affected>
- `frontend/src/services/`: <none / file affected>

## Standard checklist
- [ ] `dotnet build RestaurantSystem.sln` — 0 errors
- [ ] All existing tests pass
- [ ] No hardcoded secrets / emails / URLs / magic numbers (CLAUDE.md §5)
- [ ] No `null!` in DTOs (use `required` or `= string.Empty`)
- [ ] Custom exceptions used for user-facing errors (no `InvalidOperationException`)
- [ ] No raw `DbContext` injection in controllers
- [ ] Sibling file conventions matched (DI registration, naming, base class)
- [ ] Pre-commit hooks pass locally (`pre-commit run --all-files`)
- [ ] Branch is off `develop`; MR targets `develop`

## Test plan
<!-- Manual testing steps; specific scenarios to verify. -->
- [ ] ...
- [ ] ...

## Screenshots / API examples
<!-- For controller changes: paste the request/response. For UI changes (rare in backend): screenshots. -->

## Deploy notes
<!-- Anything ops needs to know: new config keys, new secrets, migration order, downtime risk. -->
- New config keys required: <none / list>
- New secrets required: <none / list>
- Migration risk: <none / additive / requires downtime>
- Rollback procedure: <standard / special>
