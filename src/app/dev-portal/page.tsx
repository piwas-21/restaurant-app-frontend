'use client';

// Internal developer/operator tool — deliberately NOT tenant product UI.
// No i18n, no design-system primitives (BaseModal/FormField/PageHeader/Sidebar),
// no AuthContext. Access is gated by Caddy Basic Auth at the proxy layer
// (see deploy/Caddyfile), independent of the restaurant's tenant auth system —
// this stays true even after RUMI becomes multi-tenant SaaS. Approved exception
// to frontend/CLAUDE.md §5 conventions; see docs/plans for context.

import { useDevPortalData } from '@/hooks/useDevPortalData';
import styles from './page.module.css';

function isBackendUnreachable(value: unknown): value is { reachable: false; error: string } {
  return typeof value === 'object' && value !== null && (value as { reachable?: boolean }).reachable === false;
}

export default function DevPortalPage() {
  const { version, diagnostics } = useDevPortalData();

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Developer Portal</h1>
      <p className={styles.subtitle}>Internal ops dashboard — build info, diagnostics, logs.</p>

      <div className={styles.grid}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Version Info</h2>
          {version.loading && <p className={styles.loading}>Loading…</p>}
          {version.error && <p className={styles.error}>Failed to load version info: {version.error}</p>}
          {version.data && (
            <>
              <h3>Frontend</h3>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Commit</span>
                <span>{version.data.frontend.commit}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Build Time</span>
                <span>{version.data.frontend.buildTime}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Environment</span>
                <span>{version.data.frontend.environment ?? 'unknown'}</span>
              </div>

              <h3>Backend</h3>
              {isBackendUnreachable(version.data.backend) ? (
                <p className={styles.error}>Backend unreachable: {version.data.backend.error}</p>
              ) : (
                <>
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>Commit</span>
                    <span>{version.data.backend.commit}</span>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>Build Time</span>
                    <span>{version.data.backend.buildTime}</span>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>Environment</span>
                    <span>{version.data.backend.environment ?? 'unknown'}</span>
                  </div>
                  <div className={styles.row}>
                    <span className={styles.rowLabel}>Uptime</span>
                    <span>{version.data.backend.uptimeSeconds ?? 0}s</span>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Diagnostics</h2>
          {diagnostics.loading && <p className={styles.loading}>Loading…</p>}
          {diagnostics.error && (
            <p className={styles.error}>
              Failed to load diagnostics: {diagnostics.error}. Log in as Admin at /admin in this browser to view.
            </p>
          )}
          {diagnostics.data && (
            <>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Database</span>
                <span>{diagnostics.data.database.canConnect ? 'Connected' : 'Disconnected'}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Last Applied Migration</span>
                <span>{diagnostics.data.database.lastAppliedMigration ?? 'n/a'}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Pending Migrations</span>
                <span>{diagnostics.data.database.pendingMigrations}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Host</span>
                <span>{diagnostics.data.host}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Framework</span>
                <span>{diagnostics.data.framework}</span>
              </div>
              <div className={styles.row}>
                <span className={styles.rowLabel}>Uptime</span>
                <span>{diagnostics.data.uptimeSeconds}s</span>
              </div>
            </>
          )}
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Container Logs</h2>
          <p>View live container logs in Dozzle.</p>
          <a className={styles.link} href="/logs" target="_blank" rel="noopener noreferrer">
            Open Log Viewer
          </a>
        </section>
      </div>
    </main>
  );
}
