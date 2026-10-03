'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

type TableGuestRuntime = typeof import('@/contexts/TableGuestRouteRuntime').default;

export default function TableGuestRouteRuntimeLoader({
  readPublicTableGuestFeature,
  loadTableGuestLocaleForRoute = false,
  children,
}: Readonly<{
  readPublicTableGuestFeature: boolean;
  loadTableGuestLocaleForRoute?: boolean;
  children: ReactNode;
}>) {
  const { t } = useTranslation();
  const [Runtime, setRuntime] = useState<TableGuestRuntime | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const shouldLoad = readPublicTableGuestFeature || loadTableGuestLocaleForRoute;

  useEffect(() => {
    if (!shouldLoad) {
      setRuntime(null);
      setLoadFailed(false);
      return;
    }
    let isCurrent = true;
    void import('@/contexts/TableGuestRouteRuntime')
      .then(({ default: component }) => {
        if (isCurrent) setRuntime(() => component);
      })
      .catch(() => {
        if (isCurrent) setLoadFailed(true);
      });
    return () => {
      isCurrent = false;
    };
  }, [shouldLoad]);

  if (!shouldLoad) return children;
  if (loadFailed) {
    return (
      <section role="alert">
        <p>{t('error')}</p>
        <button type="button" onClick={() => window.location.reload()}>
          {t('retry')}
        </button>
      </section>
    );
  }
  if (!Runtime) return <p role="status">{t('loading')}</p>;

  return (
    <Runtime
      readPublicTableGuestFeature={readPublicTableGuestFeature}
      loadTableGuestLocaleForRoute={loadTableGuestLocaleForRoute}
    >
      {children}
    </Runtime>
  );
}
