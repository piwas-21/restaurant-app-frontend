module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  // Stale per-session git worktrees (gitignored, local-only) duplicate the
  // whole tree; their test copies resolve `@/` aliases against the MAIN tree
  // and go red on any API change. CI never has them — ignore them locally too.
  testPathIgnorePatterns: ['/node_modules/', String.raw`/\.claude/`],
  // …and keep them out of the MODULE map too, not just the test list. Each worktree carries its
  // own `__mocks__/@/utils/apiClient.ts`, so jest-haste-map sees several manual mocks registered
  // under one module name and silently picks one — a stale copy then shadows the real module and
  // its exports read as `undefined` (an `instanceof ApiError` throws instead of running).
  modulePathIgnorePatterns: [String.raw`<rootDir>/\.claude/`],
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  transform: {
    '^.+\.(js|jsx|ts|tsx)$': [
      'babel-jest',
      {
        presets: [
          [
            'next/babel',
            {
              'preset-react': {
                runtime: 'automatic',
              },
            },
          ],
        ],
      },
    ],
  },
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/__mocks__/fileMock.js',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/app/(.*)$': '<rootDir>/src/app/$1',
    '^@/config/(.*)$': '<rootDir>/src/config/$1',
    // Added E9 slice 8: `src/constants/` had no mapping, so the FIRST test to reach a module
    // importing it (useOrders) failed to resolve rather than failing an assertion.
    '^@/constants/(.*)$': '<rootDir>/src/constants/$1',
    '^@/contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    '^@/schemas/(.*)$': '<rootDir>/src/schemas/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    '^@/design-system/(.*)$': '<rootDir>/src/design-system/$1',
    // Tenant UI template alias (ADR-006). Jest always resolves to `classic`,
    // matching the tsconfig type-source; templates get covered by the
    // per-template Playwright screenshot suite, not unit tests.
    '^@active-template$': '<rootDir>/src/templates/classic',
    '^@active-template/(.*)$': '<rootDir>/src/templates/classic/$1',
    'next/router': '<rootDir>/__mocks__/nextRouterMock.js',
  },
  transformIgnorePatterns: ['/node_modules/', String.raw`^.+\.module\.(css|sass|scss)$`],
  collectCoverage: false,
  collectCoverageFrom: [
    'src/components/**/*.tsx',
    'src/app/**/*.tsx',
    // E9 slice 8 — hooks and contexts are not collected wholesale (see the note at the end of this
    // list), so the three the slice pinned have to be named. A `coverageThreshold` row for a file
    // outside this list does not fail: jest reports "coverage data not found" and moves on.
    'src/hooks/useOrders.ts',
    'src/hooks/useCashierOrders.ts',
    'src/hooks/cashier/useCashierManualRefresh.ts',
    'src/contexts/TableContext.tsx',
    'src/hooks/admin/useProductEditorFetch.ts',
    'src/services/formFieldConfigService.ts',
    'src/hooks/reservations/useMyReservations.ts',
    'src/hooks/useCustomerFormFields.ts',
    'src/hooks/admin/useCustomerFormsAdmin.ts',
    'src/hooks/order/registrationOutcome.ts',
    'src/hooks/order/useOrderTypeSwitch.ts',
    'src/hooks/order/useAssertBasketChannel.ts',
    'src/hooks/order/needsTakeawayInfoModal.ts',
    'src/hooks/order/useGuestProfilePrefill.ts',
    'src/hooks/checkout/useDeliveryAddress.ts',
    'src/lib/passwordPolicy.ts',
    'src/schemas/password.schema.ts',
    'src/utils/apiFormErrors.ts',
    'src/utils/apiClient.ts',
    'src/utils/orderErrorHandler.ts',
    'src/services/order/orderCommands.ts',
    'src/lib/checkout/contactFieldRules.ts',
    'src/schemas/deliveryAddress.schema.ts',
    'src/utils/orderItemTree.ts',
    'src/utils/channelNotice.ts',
    'src/hooks/menu/useTrackItemBlocked.ts',
    'src/hooks/menu/useCategoryTabs.ts',
    'src/hooks/menu/useItemAvailabilityNotice.ts',
    'src/hooks/menu/useFeaturedSpecialHero.ts',
    'src/hooks/useApiError.ts',
    'src/lib/orderStatus.ts',
    'src/lib/paymentStatus.ts',
    'src/utils/catalogItem.ts',
    'src/hooks/useFeaturedSpecial.ts',
    'src/components/order/lineSummary.ts',
    'src/utils/templates/receiptHtml.ts',
    'src/utils/templates/simpleReceipt.ts',
    'src/utils/templates/kitchenReceipt.ts',
    'src/utils/reservationForm.ts',
    'src/utils/productTypeFilter.ts',
    'src/utils/productEditorDefaults.ts',
    'src/lib/floorPlan/geometry.ts',
    'src/lib/floorPlan/walls.ts',
    'src/lib/floorPlan/tableGeometry.ts',
    'src/lib/floorPlan/symbols.ts',
    'src/lib/floorPlan/symbolPrims.ts',
    'src/lib/floorPlan/symbolsStructure.ts',
    'src/lib/floorPlan/symbolsDecor.ts',
    'src/lib/floorPlan/zones.ts',
    'src/lib/floorPlan/viewport.ts',
    'src/lib/floorPlan/snapping.ts',
    'src/lib/floorPlan/history.ts',
    'src/lib/floorPlan/document.ts',
    'src/lib/floorPlan/editorGeometry.ts',
    'src/lib/floorPlan/handles.ts',
    'src/lib/floorPlan/editorGestures.ts',
    'src/lib/floorPlan/selection.ts',
    'src/lib/floorPlan/align.ts',
    'src/lib/floorPlan/movable.ts',
    'src/lib/floorPlan/palette.ts',
    'src/lib/floorPlan/itemPlacement.ts',
    'src/lib/floorPlan/localIds.ts',
    'src/lib/floorPlan/editorTools.ts',
    'src/lib/floorPlan/editorKeyActions.ts',
    'src/lib/floorPlan/floorStyles.ts',
    'src/lib/floorPlan/wallDrafting.ts',
    'src/lib/floorPlan/wallHitTest.ts',
    'src/lib/floorPlan/wallEditing.ts',
    'src/lib/floorPlan/wallOpenings.ts',
    'src/lib/floorPlan/wayfinding.ts',
    'src/lib/allergens.ts',
    'src/lib/modules.ts',
    'src/services/tenantModulesService.ts',
    'src/hooks/floorPlan/useEditorDrag.ts',
    'src/hooks/floorPlan/useEditorSave.ts',
    'src/hooks/floorPlan/useEditorAutoSave.ts',
    'src/hooks/floorPlan/useEditorItems.ts',
    'src/hooks/floorPlan/useEditorMarquee.ts',
    'src/hooks/floorPlan/useStageScale.ts',
    'src/hooks/floorPlan/useWallDraft.ts',
    'src/hooks/floorPlan/useWallDraftKeys.ts',
    'src/hooks/floorPlan/useWallPick.ts',
    'src/hooks/floorPlan/useWallSelection.ts',
    'src/hooks/floorPlan/useWallVertexDrag.ts',
    'src/components/floor-plan/editor/EditorHandles.tsx',
    'src/components/floor-plan/editor/EditorPalette.tsx',
    'src/components/floor-plan/editor/EditorToolControls.tsx',
    'src/components/floor-plan/editor/EditorWallPanel.tsx',
    'src/components/floor-plan/editor/WallOverlay.tsx',
    'src/components/floor-plan/editor/WallVertexHandles.tsx',
    'src/components/floor-plan/editor/EditorOpeningsPanel.tsx',
    'src/components/floor-plan/editor/EditorOpeningRow.tsx',
    'src/components/floor-plan/editor/EditorVertexFields.tsx',
    'src/components/floor-plan/editor/itemKindLabel.ts',
    'src/components/floor-plan/guest/guestMapState.ts',
    'src/components/floor-plan/guest/hoverCardPosition.ts',
    'src/services/floorPlanService.ts',
    'src/components/admin/product/productFormUtils.ts',
    'src/utils/basketMutationError.ts',
    'src/hooks/cart/useCartItemMutations.ts',
    'src/hooks/cart/cartFailureReporting.ts',
    'src/hooks/checkout/useSavedAddressList.ts',
    'src/hooks/admin/useSetupChecklist.ts',
    '!src/**/*.test.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.spec.tsx',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  coverageReporters: ['json', 'lcov', 'text', 'clover', 'json-summary'],
  // Coverage gate — PER-FILE thresholds for the files that actually have
  // tests today. The global threshold is intentionally NOT set (PR #79
  // review, gemini): a global floor at sub-1% is fragile — any large
  // untested file added to the tree drops the average and redlines the
  // gate independently of test quality, so the gate's behaviour ends up
  // driven by file size rather than the thing we care about (regressions
  // in covered code).
  //
  // Shape of the gate instead:
  //   - Each file that has a unit test gets a per-file threshold pinned
  //     just below its current actual coverage (actual − ~1pt, "floor
  //     minus a hair", same pattern as backend coverlet — see workspace
  //     CLAUDE.md §7). A real regression on that file (deleted test,
  //     new untested branch) fails the build.
  //   - Untested files don't drag down a global average because there
  //     is no global average being enforced. They just sit at 0% until
  //     somebody ships a test for them.
  //
  // To add a new file to the gate:
  //   1. Ship the *.test.{ts,tsx} alongside the source file.
  //   2. Run `npm test -- --coverage` and read the per-file pct.
  //   3. Add a row below pinned at actual − 1pt (or 99 if the file is
  //      at 100%). Same MR — test + gate row together.
  //
  // To ratchet a row up: after a test-improvement MR raises the actual
  // pct, bump the row in a chore: MR and link the run that proves it.
  coverageThreshold: {
    // ── #435 — the checkout error transport. ────────────────────────────────────────────────────
    // These pin the two halves of a defect that was invisible to every other gate: the map in
    // `orderErrorHandler` was 0/7 live and STILL type-checked, lint-passed and read as coverage,
    // because the reason never left `errors[0]` — `orderCommands` threw a plain `Error` carrying
    // the literal "Operation failed". Deleting either test file would restore that silently.
    //
    // Measured with CI's own command (`npm test -- --ci --runInBand --coverage`), pinned at
    // actual − 1pt. `orderCommands.ts` is low because the file holds five more write endpoints
    // this change does not touch; the row guards the two creators' throw shape, not the file.
    './src/utils/orderErrorHandler.ts': { statements: 99, branches: 92, functions: 99, lines: 99 },
    './src/services/order/orderCommands.ts': { statements: 72, branches: 55, functions: 82, lines: 72 },
    // ── #415 — the two basket 404s. ─────────────────────────────────────────────────────────────
    // These pin the discrimination between "the item is gone" (resync) and "the basket is gone"
    // (report), which nothing else can see: both are a 404, and the bug they replace was invisible
    // to every other gate because the old substring test type-checked and lint-passed.
    './src/utils/basketMutationError.ts': { statements: 99, branches: 99, functions: 99, lines: 99 },
    './src/hooks/cart/cartFailureReporting.ts': { statements: 99, branches: 99, functions: 99, lines: 99 },
    // ── #416 — a deliberate ignore justified per CALLSITE but applied per THROW. ─────────────────
    // Both files had NO test before this: the branch that tells a guest 401 apart from a 500, and
    // the one that reports a re-read failure only when the write succeeded, are invisible to every
    // other gate. Mutation-verified in BOTH directions — forcing the guest branch and forcing the
    // non-auth branch each turn these red, which the first draft of the guest test did not.
    //
    // Measured with CI's own command (`npm test -- --ci --runInBand --coverage`), not a subset run:
    // the first draft of these rows was pinned from a two-file run that reported higher numbers, and
    // the branch failed CI. `--runInBand` is part of the measurement, not a detail.
    './src/hooks/checkout/useSavedAddressList.ts': { statements: 90, branches: 77, functions: 99, lines: 99 },
    './src/hooks/admin/useSetupChecklist.ts': { statements: 99, branches: 82, functions: 99, lines: 99 },
    './src/hooks/cart/useCartItemMutations.ts': { statements: 89, branches: 99, functions: 99, lines: 89 },
    // ── E9 slice 8 — the closing slice of the bare-catch sweep (#383). ──────────────────────────
    // Pinned at actual − 1pt per the recipe above, so the coverage that pins each fix cannot be
    // deleted silently. These are FLOORS, not targets: several are low because the file is large
    // and only its error paths are tested, which is exactly what the slice was about. Raise them
    // in a chore: MR, do not lower them.
    './src/hooks/useOrders.ts': { statements: 94, branches: 82, functions: 75, lines: 94 },
    './src/hooks/useCashierOrders.ts': { statements: 56, branches: 38, functions: 26, lines: 65 },
    './src/hooks/cashier/useCashierManualRefresh.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/contexts/TableContext.tsx': { statements: 80, branches: 79, functions: 56, lines: 83 },
    './src/components/account/DeleteAccountSection.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/cashier/ZReportModal.tsx': { statements: 64, branches: 13, functions: 29, lines: 66 },
    './src/components/cashier/diagnostics/ServerDiagnosticsSection.tsx': {
      statements: 71,
      branches: 65,
      functions: 49,
      lines: 73,
    },
    './src/components/checkout/FidelityPointsCheckout.tsx': {
      statements: 76,
      branches: 62,
      functions: 41,
      lines: 76,
    },
    './src/app/(auth)/delete-account/page.tsx': { statements: 81, branches: 85, functions: 56, lines: 83 },
    './src/app/admin/point-rules/page.tsx': { statements: 67, branches: 67, functions: 49, lines: 69 },
    './src/hooks/admin/useProductEditorFetch.ts': { statements: 91, branches: 71, functions: 99, lines: 95 },
    // ───────────────────────────────────────────────────────────────────────────────────────────
    // Password reset (SOFRA-ONBOARDING-PLAN O3). Pinned because these are the only way a
    // tenant admin can regain access to their own account — and because the route they
    // replace was MISSING for as long as the backend has been emailing links to it
    // (verified: www.rumirestaurant.ch/reset-password -> 404). Every branch is a way to lock
    // someone out or to leak whether an address has an account.
    //
    // passwordPolicy.ts is here for a sharper reason: it MIRRORS the backend, so it is the
    // file that should go red when the server's rules change rather than a user on the
    // recovery path.
    //
    // It sits BELOW 100 on purpose, and the reason is worth knowing: two of the four
    // mirrored rules are unreachable, on the server exactly as much as here.
    //   - minUniqueChars = 4 is subsumed — requiring one lowercase, one uppercase, one digit
    //     and one non-alphanumeric already forces four distinct characters.
    //   - the common-password check cannot fire either: every entry on the server's list
    //     ('password', 'qwerty', 'admin123', …) is lowercase and/or digits only, so all of
    //     them are rejected by the basics gate first.
    // Both are kept because they are the SERVER's rules and go live the moment the list
    // gains a compliant entry or a class requirement is dropped. The test asserts why they
    // cannot fire rather than faking passwords that cannot exist, so these numbers are the
    // honest ceiling — do not "fix" them by deleting the guards.
    './src/app/(auth)/forgot-password/page.tsx': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/app/(auth)/reset-password/page.tsx': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // E9 — the two halves of "show the user what the server actually said".
    //
    // `apiFormErrors` is pinned at 100% because every uncovered branch is a message that reaches
    // nobody: the whole defect it fixes was a failure path that ran, produced nothing a user could
    // act on, and looked fine. Its fallbacks are the file — there is no incidental code to leave
    // uncovered. `password.schema` is thin zod glue over `passwordPolicy` (pinned separately above),
    // but it is the only thing standing between a form and a guaranteed 400.
    './src/utils/apiFormErrors.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // `apiClient` joined them in #401. It is where the sweep's premise actually lives: every
    // `getErrorMessage(e) ?? t('…')` in the tree is only as true as this file's promise to leave
    // `message` empty when the server authored nothing, and for five slices it silently was not —
    // because the tests hand-built `new ApiError(500, '')`, a shape `request()` could not emit, and
    // the file itself had NO test at all. Lines and functions are pinned at 100 so no failure path
    // can be added without one — though note it is the STATEMENTS and BRANCHES floors that do that
    // work, not lines: a one-line `if (x) throw new ApiError(418, '')` leaves lines at 100 while its
    // statement goes uncovered, which is exactly the shape of the four gaps below. Those two floors
    // drop to 94.94 / 92.96 on such an addition and fail. The gap is exactly four, counted out
    // of `coverage-final.json` rather than guessed: the three `typeof window === 'undefined'`
    // storage guards, reachable only from the server runtime this suite does not run in, plus
    // `request`'s own `config: RequestConfig = {}` default, which is permanently uncoverable —
    // `request` is module-private and every wrapper passes an object. (Two earlier drafts of this
    // note were wrong in opposite directions: one blamed the `body instanceof FormData` ternaries,
    // which were merely untested and now are; the correction then dropped the default-arg, which
    // was true. Count the branch map, don't reason about it.)
    './src/utils/apiClient.ts': {
      statements: 96,
      branches: 94,
      functions: 100,
      lines: 100,
    },
    './src/schemas/password.schema.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/lib/passwordPolicy.ts': {
      statements: 85,
      branches: 84,
      functions: 100,
      lines: 100,
    },
    // Module gating (SOFRA-ONBOARDING-PLAN O5). Pinned at 100% because both files decide
    // whether a tenant SEES a feature they paid for, and every branch is a fail-open path:
    // an uncovered one is a route that disappears for a paying customer, or a network blip
    // that takes the app away. There is nothing incidental in either file to leave uncovered.
    './src/lib/modules.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/services/tenantModulesService.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // Kitchen routing over the ROOT-ONLY order tree (backend #237). Pinned at 100% because its
    // failure mode is silence: miss a nested item and a kitchen simply never gets a ticket — no
    // error, no empty print, just food that is never cooked. Every branch here is one `?? []` or one
    // match/hoist decision, so there is nothing incidental to leave uncovered.
    './src/utils/orderItemTree.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // §4.4 — the ONE place that decides whether a customer surface mentions a channel restriction,
    // now shared by the catalog card, the customization sheet and the category nav. Pinned at 100%
    // because each of its three rules was a bug first, and all three fail SILENTLY: a chip that
    // advertises a channel the guest cannot pick, a dim the server never asked for, or a category
    // tab and the items inside it disagreeing.
    './src/utils/channelNotice.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // The one uncovered branch is the `i18n.language || 'en'` fallback — the same one already
    // accepted on `useItemAvailabilityNotice` and `OrderTypeConflictModal`.
    './src/hooks/menu/useCategoryTabs.ts': {
      statements: 100,
      branches: 91,
      functions: 100,
      lines: 100,
    },
    // The only impression-style analytics event in the app — a blocked card has no control to click,
    // so a regression here is not a wrong number, it is silence. The single uncovered branch is the
    // `orderType ?? undefined` narrowing arm, unreachable because a non-null key implies a non-null
    // channel; TypeScript cannot see that through the key.
    './src/hooks/menu/useTrackItemBlocked.ts': {
      statements: 100,
      branches: 90,
      functions: 100,
      lines: 100,
    },
    './src/hooks/menu/useItemAvailabilityNotice.ts': {
      statements: 100,
      branches: 95,
      functions: 100,
      lines: 100,
    },
    // G7 — the featured banner is an ENTRY POINT: a guest can order straight from it, so a
    // regression here is an unguarded add, not a missing chip. Raised to 100 across the board by
    // E9 slice 8: the two previously-uncovered arms are now pinned — the `data:null` miss (which
    // IS the failure path, since `getFeaturedSpecial` swallows into `{success:true,data:null}`)
    // and the `active` guard that stops a slow answer for the PREVIOUS channel overwriting the
    // current one.
    './src/hooks/useFeaturedSpecial.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/components/menu/FeaturedSpecial.tsx': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // E4 part 2 — the DECISION half of the hero, shared by both templates. Pinned because the whole
    // reason it exists is that a second copy of this reasoning is what let `CraftMenuCard` and the
    // hero disagree about "blocked" (E6): one checked the notice, the other also checked the
    // server's `canOrder`. A branch that goes uncovered here is a branch one template can regress
    // alone, which is exactly the failure this file was extracted to make impossible.
    './src/hooks/menu/useFeaturedSpecialHero.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // The banner's `priceEditability` derivation. It decides whether an admin is offered a WRITE,
    // from a payload that does not carry enough to derive it the way a card does — and the wrong
    // guess routes a combo to the product price endpoint, whose validator accepts >= 0 where the
    // combo's own editor requires > 0. Every arm is covered on purpose.
    './src/utils/catalogItem.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // The other half of the root-only tree (#332): what a HUMAN sees. Same silent failure mode as
    // the routing above — a component that stops being rendered produces no error, the bill just
    // stops itemising the combo. These four carry every surface that shows what is inside a line.
    './src/components/order/lineSummary.ts': {
      statements: 100,
      branches: 91,
      functions: 100,
      lines: 100,
    },
    // 92 -> 94 with #189: `showChildPrices` and the `showQuantity` suppression it drives are each
    // asserted in both directions, so the branches they add are covered and the floor moves with
    // them rather than leaving slack behind.
    './src/components/order/OrderLineSummary.tsx': {
      statements: 100,
      branches: 94,
      functions: 100,
      lines: 100,
    },
    './src/utils/templates/receiptHtml.ts': {
      statements: 100,
      branches: 83,
      functions: 100,
      lines: 100,
    },
    // The two thermal templates are pinned well below the shared builders they call: most of their
    // remaining uncovered branches are the per-field totals/address/payment blocks, not the item tree.
    './src/utils/templates/simpleReceipt.ts': {
      statements: 77,
      branches: 40,
      functions: 70,
      lines: 75,
    },
    './src/utils/templates/kitchenReceipt.ts': {
      statements: 71,
      branches: 61,
      functions: 65,
      lines: 71,
    },
    // §4.4 — the two-phase basket order-type switch. Worth pinning at this level because it is the
    // ONLY thing that tells the server which channel a basket is on, and `Basket.OrderType` being
    // null is silently permissive: a regression here does not throw, it just quietly disarms
    // `BasketChannelGuard` again. The two uncovered branches are the `basket == null` optional
    // chain and the re-entrancy guard on confirm.
    './src/hooks/order/useOrderTypeSwitch.ts': {
      statements: 98,
      branches: 93,
      functions: 100,
      lines: 100,
    },
    // The server-sync half. 100% across the board and pinned there: its whole job is arming a guard
    // whose failure mode is silence — nothing throws when the basket stays on a null channel.
    './src/hooks/order/useAssertBasketChannel.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // §4.4 — the itemized confirm. The naming assertions are the point: a dialog asking consent to
    // delete "× 2" is the failure mode. (It renders `conflicts`, which the server has always named
    // correctly — the field plan §9.11 found empty was the echoed `basket`, which this never
    // reads.) The one uncovered branch is the `i18n.language` fallback.
    './src/components/order/OrderTypeConflictModal.tsx': {
      statements: 100,
      branches: 87,
      functions: 100,
      lines: 100,
    },
    // S4 — the per-order-type availability notice on a catalog card. The shared presentational
    // half, exercised from BOTH template card tests (classic MenuCard + craft CraftMenuCard), which
    // is exactly the property worth pinning: every customer deliverable lands twice, so a regression
    // in one template must not be masked by the other. The DECISION half lives in
    // `useItemAvailabilityNotice` (its own test file; hooks are not in collectCoverageFrom).
    // E2 — the design system's checkbox, and the channel picker composed from it. Pinned because
    // "which channels is this available on?" was written TWICE with nothing shared, so the two
    // surfaces could drift on channel order, on where labels come from, and on what a disabled box
    // means. A branch that goes uncovered here is a branch one surface can regress alone.
    './src/components/design-system/CheckboxField.tsx': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/components/design-system/ChannelPicker.tsx': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // Both order-type write surfaces. The matrix had NO test at all before E2; it writes real
    // availability rules, and every way it can be wrong is silent — a mis-wired row id saves the
    // wrong category, and an unchecked row takes a category off sale without saying so.
    './src/components/admin/settings/CategoryOrderTypeMatrix.tsx': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/components/admin/product/ProductOrderTypes.tsx': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // E1 — the one place a status becomes something a user sees, and the one place a staff surface
    // learns what it may become NEXT. Pinned at 100 because every way this file can be wrong is
    // silent: the ladders it replaced ended in a `default`, which is how two statuses came to render
    // as raw English in every locale, and how the cashier's transition list stranded an order by
    // returning an empty array that reads exactly like "this one is finished".
    // E9 step 2 — the one error surface. Pinned at 100 because the failure it prevents is a
    // FORGETTING, not a bug: the fallback is not a parameter, so no caller can print an
    // untranslated generic by omission. A branch left uncovered here is a way that guarantee can
    // quietly stop holding.
    './src/hooks/useApiError.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    // The money vocabulary. Pinned at 100 because the bug it fixes was invisible from the UI: the
    // admin "Paid" filter returned EVERY order, because the value it sent is not a backend enum
    // member and the server's TryParse failure skipped the whole clause. A full list looks
    // plausible; only a test that asserts `'Paid'` does NOT resolve keeps it from coming back.
    './src/lib/paymentStatus.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/lib/orderStatus.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/components/menu/MenuCardAvailability.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // O6 — the tenant's logo, or its name as text. Pinned because `resolveLogoSrc` is the ONLY
    // place the fallback chain exists, for all three chromes, and the two ways it can go wrong
    // are both silent: an empty string reaches <img src=""> as a broken-image icon where the
    // restaurant's name belongs, and an asymmetric chain gives a tenant with one logo a header
    // that shows their mark on some routes and text on others. Neither throws, neither logs.
    './src/components/branding/TenantLogo.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // §9.10 — the sheet's order-type guard. The blocked footer and the normal footer are both
    // pinned; the uncovered lines are the quantity stepper's own handlers, which belong to the
    // pre-existing footer and are not what this row is protecting.
    './src/components/menu/ItemCustomizationSheet.tsx': {
      statements: 84,
      branches: 80,
      functions: 49,
      lines: 83,
    },
    // B2 (cart instructions) — the /cart special-instructions editor is now the single owner of
    // item notes for EVERY item (the gate that hid it for customized items on prod is gone), and
    // the customizations summary no longer duplicates the notes line. The editor's display/edit/
    // save/cancel paths are pinned; the customizations summary pins its ingredient/side structure.
    './src/components/cart/cart-page/CartItemInstructionsEditor.tsx': {
      statements: 99,
      branches: 80,
      functions: 99,
      lines: 99,
    },
    // #189 deleted CartItemCustomizations.tsx (its row lived here) — the card mounts the shared
    // OrderLineSummary instead, and that component's own floor above now covers the customizations
    // rows. The card's tests moved with the claims rather than being dropped.
    //
    // The floor RISES steeply, and that is a correction, not a windfall. Deleting the "Includes:"
    // list removed COVERED JSX (including its map callback), so the same tests measured 62/56/25 on
    // the shorter file — a refactor that removed no capability would have pushed this floor DOWN.
    // The controls and header block were covered to close that gap. What the remaining branch budget
    // buys, measured rather than guessed: the `productName` fallbacks (`|| 'Unknown Item'` on the
    // heading, `|| 'Product'` on the image alt) and the `i18n.language?.split('-')[0] || 'en'`
    // chain, none of which any fixture reaches — `renderCard` always supplies a name and the mock
    // always supplies 'en'. The itemId fallback is NOT among them: the controls tests drive all
    // three of basketItemId → id → productId.
    './src/components/cart/cart-page/CartItemCard.tsx': {
      statements: 100,
      branches: 86,
      functions: 100,
      lines: 100,
    },
    // Slice 7 PR2d — the unified admin editor. `productEditorDefaults` is the pure
    // fetched-product → form-state mapping (the load-bearing half, incl. the real
    // primary-category resolution); `ProductEditorPage` is the composition + the single
    // Save. `BundlePanel` sits lower because its file-picker and section-change handlers
    // are not exercised — the panel's kind-specific *structure* is what the tests pin.
    './src/utils/productEditorDefaults.ts': {
      statements: 95,
      branches: 61,
      functions: 99,
      lines: 99,
    },
    './src/components/admin/product-editor/ProductEditorPage.tsx': {
      statements: 92,
      branches: 80,
      functions: 74,
      lines: 92,
    },
    './src/components/admin/product-editor/BundlePanel.tsx': {
      statements: 49,
      branches: 39,
      functions: 32,
      lines: 49,
    },
    // Slice 7 PR2e — existing-image management, migrated to immediate per-image endpoint
    // calls (no rival Save), self-managing its list so an op never discards the form's edits.
    // Set-primary, sort-on-blur, delete, and the failure path are all pinned.
    './src/components/admin/product-editor/ImageGallery.tsx': {
      statements: 92,
      branches: 82,
      functions: 95,
      lines: 97,
    },
    './src/components/admin/product-editor/ImageActions.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // Slice 7 PR2e — the "New product" type chooser (create entry). Fully covered.
    './src/components/admin/menu-management/NewProductTypeModal.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // Slice 7 — the admin write path. These tests pin the create/update endpoint
    // dispatch on both halves (a bundle must go to /api/Menus, an item to
    // /api/Products) and the shared menu-definition mapping. PR2e's create route now
    // exercises the create half too; the global-ingredient reconciliation and the
    // error branches are the untested remainder.
    './src/components/admin/product/productFormUtils.ts': {
      statements: 42,
      branches: 35,
      functions: 56,
      lines: 40,
    },
    // Slice 7 PR2b — the admin catalog's type filter. `productTypeFilter` is pure and
    // fully covered; `ProductsTable`'s uncovered branches are the loading/error early
    // returns, not the per-row type logic the tests pin.
    './src/utils/productTypeFilter.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/admin/menu-management/ProductsTable.tsx': {
      statements: 82,
      branches: 69,
      functions: 99,
      lines: 99,
    },
    './src/components/design-system/AlertDialog.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/design-system/BaseModal.tsx': {
      statements: 89,
      branches: 77,
      functions: 87,
      lines: 94,
    },
    './src/components/design-system/FormField.tsx': {
      statements: 99,
      branches: 82,
      functions: 99,
      lines: 99,
    },
    './src/components/design-system/StatusBadge.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // reservationForm helpers ship at 100% (see reservationForm.test.ts); pinned
    // at 99 per the "at 100% → 99" rule above.
    './src/utils/reservationForm.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // Reservations floor-plan core (B1) — the shared canvas-geometry contract
    // (600x500, centre-anchored marker maths) at 100% → 99; the customer map's
    // FLOOR-PLAN-REVAMP S4 foundation — geometry/walls/service all at 100% → 99.
    './src/lib/floorPlan/geometry.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/walls.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // FLOOR-PLAN-REVAMP S4 render layer — the pure geometry (table body, symbol
    // registry + generators) at 100% → 99; symbolPrims' branch floor is lower
    // (a leaf-length ternary side the fixtures don't split).
    './src/lib/floorPlan/tableGeometry.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/symbols.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/symbolPrims.ts': {
      statements: 99,
      branches: 55,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/symbolsStructure.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/symbolsDecor.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // FLOOR-PLAN-REVAMP S4 render layer — the shared scene + its five layers.
    // FloorPlanScene / SceneDefs are fully covered; the layers' uncovered
    // remainder is defensive (an unresolved symbol, a missing entrance def) and
    // the small-table label floor, pinned at actual − ~a hair.
    './src/components/floor-plan/FloorPlanScene.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/SceneDefs.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/FloorPlanSymbol.tsx': {
      statements: 88,
      branches: 80,
      functions: 99,
      lines: 88,
    },
    './src/components/floor-plan/ItemsLayer.tsx': {
      statements: 99,
      branches: 78,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/LabelsLayer.tsx': {
      statements: 92,
      branches: 67,
      functions: 99,
      lines: 91,
    },
    './src/components/floor-plan/RoomsLayer.tsx': {
      statements: 99,
      branches: 74,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/TablesLayer.tsx': {
      statements: 93,
      branches: 98,
      functions: 87,
      lines: 92,
    },
    './src/components/floor-plan/WallsLayer.tsx': {
      statements: 99,
      branches: 87,
      functions: 99,
      lines: 99,
    },
    // FLOOR-PLAN-REVAMP S5 guest map — the pure zone/viewport/state/placement
    // helpers at 100% → 99; the map components at actual − ~a hair. The
    // pointer/wheel/pinch paths of the viewport + hover hooks are exercised in
    // the browser (S9 e2e/axe), not jsdom, so those hooks are left ungated.
    './src/lib/floorPlan/zones.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/viewport.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // FLOOR-PLAN-REVAMP S6 editor foundation — snapping maths, the undo/redo
    // command stack, and immutable document ops, all fully covered.
    './src/lib/floorPlan/snapping.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/history.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/document.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/editorGeometry.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/handles.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/editorGestures.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/selection.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/align.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // S6b-3: the movable vocabulary and the palette are pure, so they carry the
    // same 99% bar as the rest of the floor-plan geometry layer.
    './src/lib/floorPlan/movable.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/palette.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/itemPlacement.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // The allergen table decides what every menu card shows; a miss is silent.
    './src/lib/allergens.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // The autosave path: its rules (idle debounce, max wait, conflict latch, the
    // two-pass flush) are only enforced by these tests.
    './src/hooks/floorPlan/useEditorSave.ts': {
      statements: 100,
      branches: 93,
      functions: 100,
      lines: 100,
    },
    './src/hooks/floorPlan/useEditorAutoSave.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    './src/hooks/floorPlan/useEditorItems.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/hooks/floorPlan/useStageScale.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/editor/EditorHandles.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/editor/EditorPalette.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/editor/itemKindLabel.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // The wall tool (S7). Its maths decides where a corner lands, so it is held
    // at full coverage; the components' and hooks' uncovered branches are the
    // usual pre-layout guards (an unmeasurable stage rect) plus the i18n
    // interpolation paths a stubbed `t` doesn't reach.
    './src/lib/floorPlan/localIds.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/editorTools.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/editorKeyActions.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/floorStyles.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/wallDrafting.ts': {
      statements: 99,
      branches: 95,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/wallHitTest.ts': {
      statements: 99,
      branches: 90,
      functions: 99,
      lines: 99,
    },
    './src/hooks/floorPlan/useWallDraft.ts': {
      statements: 90,
      branches: 84,
      functions: 90,
      lines: 90,
    },
    // S7b — reshaping a wall. `wallEditing` is held highest of the three: it is
    // the module that renumbers segments under the openings pinned to them, and
    // getting that wrong slides a door onto a different wall without throwing.
    // S8 — the wayfinding kinds became first-class objects. `wayfinding` is the
    // vocabulary the renderer, the palette and the hit test all read, so a drift
    // in it silently makes a zone undraggable again.
    './src/lib/floorPlan/wayfinding.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/WayfindingShapes.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/wallEditing.ts': {
      statements: 99,
      branches: 92,
      functions: 99,
      lines: 99,
    },
    './src/lib/floorPlan/wallOpenings.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/hooks/floorPlan/useWallVertexDrag.ts': {
      statements: 94,
      branches: 89,
      functions: 99,
      lines: 94,
    },
    './src/components/floor-plan/editor/WallVertexHandles.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/editor/EditorOpeningsPanel.tsx': {
      statements: 99,
      branches: 88,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/editor/EditorOpeningRow.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/editor/EditorVertexFields.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/hooks/floorPlan/useWallDraftKeys.ts': {
      statements: 99,
      branches: 90,
      functions: 99,
      lines: 99,
    },
    './src/hooks/floorPlan/useWallPick.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/hooks/floorPlan/useWallSelection.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/editor/EditorToolControls.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/editor/EditorWallPanel.tsx': {
      statements: 99,
      branches: 84,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/editor/WallOverlay.tsx': {
      statements: 99,
      branches: 89,
      functions: 99,
      lines: 99,
    },
    // The two pointer layers' uncovered lines are defensive guards for states
    // jsdom can't produce (an unmeasurable stage rect, a disabled listener) or
    // that only a mid-drag reload reaches (the table vanishing from the document).
    './src/hooks/floorPlan/useEditorDrag.ts': {
      statements: 95,
      branches: 88,
      functions: 99,
      lines: 95,
    },
    './src/hooks/floorPlan/useEditorMarquee.ts': {
      statements: 93,
      branches: 79,
      functions: 99,
      lines: 93,
    },
    './src/components/floor-plan/guest/guestMapState.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/guest/hoverCardPosition.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/guest/FloorPlanGuestMap.tsx': {
      statements: 95,
      branches: 88,
      functions: 99,
      lines: 94,
    },
    './src/components/floor-plan/guest/FloorPlanHoverCard.tsx': {
      statements: 99,
      branches: 82,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/guest/FloorPlanMapControls.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/floor-plan/guest/FloorPlanTableList.tsx': {
      statements: 90,
      branches: 60,
      functions: 84,
      lines: 94,
    },
    './src/components/floor-plan/guest/FloorPlanZoneChips.tsx': {
      statements: 84,
      branches: 99,
      functions: 82,
      lines: 84,
    },
    './src/services/floorPlanService.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/SelectedTableInfo.tsx': {
      statements: 99,
      branches: 84,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/DateTimeSelector.tsx': {
      statements: 78,
      branches: 82,
      functions: 53,
      lines: 81,
    },
    // Reservations revamp D2 — configurable customer form fields. The service
    // (fetch/update shapes), the admin page + tri-state hook (locked
    // immutability, whole-form save), and the FormField-migrated reservation
    // guest-details form are at 100% → 99. The two hooks' uncovered remainder
    // is console.error noise + the fresh-cache fast path / unknown-form guard,
    // pinned at actual − ~1pt.
    './src/services/formFieldConfigService.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/hooks/useCustomerFormFields.ts': {
      statements: 94,
      branches: 84,
      functions: 99,
      lines: 99,
    },
    './src/hooks/admin/useCustomerFormsAdmin.ts': {
      statements: 93,
      branches: 79,
      functions: 99,
      lines: 99,
    },
    './src/app/admin/customer-forms/page.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/CustomerDetailsForm.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    // Reservations revamp D3 — checkout contact + delivery address wired to
    // the form-field config. The pure merge (`contactFieldRules`) and the
    // extracted registration-outcome mapper are at 100% → 99; the
    // schema-from-config builder's only uncovered branch is the defensive
    // missing-rule `??` default. The contact fields component pins the
    // per-field required rendering (register-CTA branches untested); the
    // delivery hook/section pin the config paths (saved-addresses fetch and
    // persistence flows are the untested remainder), pinned at actual − ~1pt.
    './src/lib/checkout/contactFieldRules.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/hooks/order/registrationOutcome.ts': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/hooks/order/useGuestProfilePrefill.ts': {
      statements: 88,
      branches: 69,
      functions: 99,
      lines: 93,
    },
    './src/hooks/checkout/useDeliveryAddress.ts': {
      statements: 41,
      branches: 41,
      functions: 49,
      lines: 41,
    },
    './src/schemas/deliveryAddress.schema.ts': {
      statements: 99,
      branches: 84,
      functions: 99,
      lines: 99,
    },
    './src/components/order/GuestCustomerInfoFields.tsx': {
      statements: 66,
      branches: 68,
      functions: 53,
      lines: 62,
    },
    './src/components/checkout/order-type/DeliveryAddressSection.tsx': {
      statements: 64,
      branches: 73,
      functions: 52,
      lines: 59,
    },
    // Reservations revamp B3 — my-reservations layout/card + the three
    // BaseModal-migrated reservation dialogs. Card, both cancel dialogs and
    // ReservationSuccessModal at 100% → 99; the layout's uncovered branch is
    // the defensive cancelTargetId guard (91.66 → 90); the hook's is the
    // toggle collapse arm (83.33 → 82).
    './src/components/reservation/my-reservations/MyReservationsLayout.tsx': {
      statements: 99,
      branches: 90,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/my-reservations/MyReservationCard.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/CancelReservationModal.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/CancelSuccessModal.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/components/reservation/ReservationSuccessModal.tsx': {
      statements: 99,
      branches: 99,
      functions: 99,
      lines: 99,
    },
    './src/hooks/reservations/useMyReservations.ts': {
      statements: 99,
      branches: 82,
      functions: 99,
      lines: 99,
    },
  },
};
