import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Page } from '@playwright/test';

export type GuestStorageDiagnosticPhase = 'before-departure' | 'after-return-document-start' | 'after-return-check';

export interface GuestStorageDiagnostic {
  readonly phase: GuestStorageDiagnosticPhase;
  readonly observed: boolean;
  readonly appOriginMatched: boolean;
  readonly tableAccountRoute: boolean;
  readonly storageReadable: boolean;
  readonly visitIdentityPresent: boolean;
  readonly blockedVisitPresent: boolean;
  readonly pendingRoundPresent: boolean;
  readonly paymentOperationPresent: boolean;
}

interface BrowserStoragePresence {
  readonly appOriginMatched: boolean;
  readonly tableAccountRoute: boolean;
  readonly storageReadable: boolean;
  readonly visitIdentityPresent: boolean;
  readonly blockedVisitPresent: boolean;
  readonly pendingRoundPresent: boolean;
  readonly paymentOperationPresent: boolean;
}

const require = createRequire(path.resolve('e2e/p11-stripe/guestStorageDiagnostics.ts'));
const { writePrivateStripeBrowserEvidence } = require('../../scripts/e2e-p11-stripe-profile.cjs') as {
  writePrivateStripeBrowserEvidence: (
    identity: { evidenceRoot: string; runId: string; artifactDirectory: string },
    filename: string,
    contents: string,
  ) => void;
};

export async function readGuestStoragePresence(
  page: Page,
  expectedOrigin: string,
  phase: GuestStorageDiagnosticPhase,
): Promise<GuestStorageDiagnostic> {
  try {
    const presence = await page.evaluate((appOrigin): BrowserStoragePresence => {
      const appOriginMatched = window.location.origin === appOrigin;
      const empty = {
        appOriginMatched,
        tableAccountRoute: appOriginMatched && window.location.pathname === '/en/table-account',
        storageReadable: false,
        visitIdentityPresent: false,
        blockedVisitPresent: false,
        pendingRoundPresent: false,
        paymentOperationPresent: false,
      };
      if (!appOriginMatched) return empty;
      try {
        return {
          ...empty,
          storageReadable: true,
          visitIdentityPresent: window.sessionStorage.getItem('rumi_table_guest_visit_v1') !== null,
          blockedVisitPresent: window.sessionStorage.getItem('rumi_table_guest_visit_blocked_v1') !== null,
          pendingRoundPresent: window.sessionStorage.getItem('rumi_table_guest_round_attempt_v1') !== null,
          paymentOperationPresent: window.sessionStorage.getItem('rumi_table_guest_payment_attempts_v1') !== null,
        };
      } catch {
        return empty;
      }
    }, expectedOrigin);
    return { phase, observed: true, ...presence };
  } catch {
    return emptyDiagnostic(phase);
  }
}

export async function installGuestStorageReturnObserver(
  page: Page,
  expectedOrigin: string,
  record: (snapshot: GuestStorageDiagnostic) => void | Promise<void>,
): Promise<() => Promise<void>> {
  const bindingName = `__p11StoragePresence${randomUUID().replaceAll('-', '')}`;
  let navigatedAway = false;
  let returnedAtDocumentStart = false;
  let resolveReturn: (() => void) | undefined;
  const returnObserved = new Promise<void>((resolve) => {
    resolveReturn = resolve;
  });

  await page.exposeBinding(bindingName, async (source, value: unknown) => {
    if (source.frame !== page.mainFrame()) return;
    const presence = normalizePresence(value);
    if (!presence.appOriginMatched) {
      navigatedAway = true;
      return;
    }
    if (!navigatedAway || returnedAtDocumentStart) return;
    returnedAtDocumentStart = true;
    await record({ phase: 'after-return-document-start', observed: true, ...presence });
    resolveReturn?.();
  });

  await page.addInitScript(
    ({ appOrigin, exposedBinding }) => {
      if (window.top !== window) return;
      const appOriginMatched = window.location.origin === appOrigin;
      const empty = {
        appOriginMatched,
        tableAccountRoute: appOriginMatched && window.location.pathname === '/en/table-account',
        storageReadable: false,
        visitIdentityPresent: false,
        blockedVisitPresent: false,
        pendingRoundPresent: false,
        paymentOperationPresent: false,
      };
      let presence = empty;
      if (appOriginMatched) {
        try {
          presence = {
            ...empty,
            storageReadable: true,
            visitIdentityPresent: window.sessionStorage.getItem('rumi_table_guest_visit_v1') !== null,
            blockedVisitPresent: window.sessionStorage.getItem('rumi_table_guest_visit_blocked_v1') !== null,
            pendingRoundPresent: window.sessionStorage.getItem('rumi_table_guest_round_attempt_v1') !== null,
            paymentOperationPresent: window.sessionStorage.getItem('rumi_table_guest_payment_attempts_v1') !== null,
          };
        } catch {
          presence = empty;
        }
      }
      const pageWindow = window as unknown as Window & Record<string, unknown>;
      const binding = pageWindow[exposedBinding];
      if (typeof binding === 'function') void (binding as (value: unknown) => Promise<void>)(presence);
    },
    { appOrigin: expectedOrigin, exposedBinding: bindingName },
  );

  return async () => {
    if (navigatedAway && !returnedAtDocumentStart) {
      await Promise.race([returnObserved, new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
    }
    await record(await readGuestStoragePresence(page, expectedOrigin, 'after-return-check'));
  };
}

export function retainGuestStorageDiagnostics(snapshots: readonly GuestStorageDiagnostic[]): void {
  writePrivateStripeBrowserEvidence(
    {
      evidenceRoot: process.env.P11_STRIPE_EVIDENCE_ROOT ?? '',
      runId: process.env.P11_RUN_ID ?? '',
      artifactDirectory: process.env.P11_STRIPE_ARTIFACT_DIR ?? '',
    },
    'guest-storage-return-diagnostic.json',
    JSON.stringify({ schemaVersion: 1, snapshots }, null, 2),
  );
}

function normalizePresence(value: unknown): BrowserStoragePresence {
  if (typeof value !== 'object' || value === null) return emptyPresence();
  const snapshot = value as Record<string, unknown>;
  const fields = [
    'appOriginMatched',
    'tableAccountRoute',
    'storageReadable',
    'visitIdentityPresent',
    'blockedVisitPresent',
    'pendingRoundPresent',
    'paymentOperationPresent',
  ] as const;
  if (fields.some((field) => typeof snapshot[field] !== 'boolean')) return emptyPresence();
  return {
    appOriginMatched: snapshot.appOriginMatched as boolean,
    tableAccountRoute: snapshot.tableAccountRoute as boolean,
    storageReadable: snapshot.storageReadable as boolean,
    visitIdentityPresent: snapshot.visitIdentityPresent as boolean,
    blockedVisitPresent: snapshot.blockedVisitPresent as boolean,
    pendingRoundPresent: snapshot.pendingRoundPresent as boolean,
    paymentOperationPresent: snapshot.paymentOperationPresent as boolean,
  };
}

function emptyPresence(): BrowserStoragePresence {
  return {
    appOriginMatched: false,
    tableAccountRoute: false,
    storageReadable: false,
    visitIdentityPresent: false,
    blockedVisitPresent: false,
    pendingRoundPresent: false,
    paymentOperationPresent: false,
  };
}

function emptyDiagnostic(phase: GuestStorageDiagnosticPhase): GuestStorageDiagnostic {
  return { phase, observed: false, ...emptyPresence() };
}
