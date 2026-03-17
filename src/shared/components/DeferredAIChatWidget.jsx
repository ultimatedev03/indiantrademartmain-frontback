import { Suspense, lazy, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const AIChatWidget = lazy(() => import('@/components/AIChatWidget'));

const INTERNAL_PATH_PREFIXES = [
  '/admin',
  '/employee',
  '/finance-portal',
  '/hr',
  '/vendor',
  '/buyer',
  '/management',
  '/migration-tools',
];

const DeferredAIChatWidget = () => {
  const location = useLocation();
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    const pathname = String(location.pathname || '');
    const isInternalRoute = INTERNAL_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

    if (isInternalRoute) {
      setShouldMount(false);
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;

    const enableMount = () => {
      if (!cancelled) setShouldMount(true);
    };

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      const idleId = window.requestIdleCallback(enableMount, { timeout: 1800 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    timeoutId = window.setTimeout(enableMount, 1200);
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [location.pathname]);

  if (!shouldMount) return null;

  return (
    <Suspense fallback={null}>
      <AIChatWidget />
    </Suspense>
  );
};

export default DeferredAIChatWidget;
