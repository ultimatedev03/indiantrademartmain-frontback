import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  TURNSTILE_SITE_KEY,
  isCaptchaConfigured,
  isCaptchaDevBypass,
} from '@/shared/lib/captcha';

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

let turnstileScriptPromise = null;

const loadTurnstileScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Turnstile can only load in the browser.'));
  }

  if (window.turnstile?.render) {
    return Promise.resolve(window.turnstile);
  }

  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.turnstile), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Turnstile.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = TURNSTILE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.turnstile?.render) {
          resolve(window.turnstile);
          return;
        }
        reject(new Error('Turnstile did not initialize.'));
      };
      script.onerror = () => reject(new Error('Failed to load Turnstile.'));
      document.head.appendChild(script);
    });
  }

  return turnstileScriptPromise;
};

const getStatusMessage = (status) => {
  if (status === 'expired') return 'Captcha expired. Please complete it again.';
  if (status === 'error') return 'Captcha could not load. Please refresh and try again.';
  if (status === 'timeout') return 'Captcha timed out. Start the security check again.';
  return '';
};

const TurnstileField = ({
  action = 'submit',
  appearance = 'always',
  className,
  execution = 'render',
  onTokenChange,
  onWidgetReady,
  refreshExpired = 'auto',
  refreshTimeout = 'auto',
  resetKey = 0,
  retry = 'auto',
}) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const canAcceptTokenRef = useRef(execution !== 'execute');
  const [status, setStatus] = useState(() => {
    if (isCaptchaDevBypass()) return 'dev_bypass';
    if (!isCaptchaConfigured()) return 'unavailable';
    return 'idle';
  });

  useEffect(() => {
    if (!isCaptchaConfigured()) {
      onTokenChange?.('');
      onWidgetReady?.(null);
      return undefined;
    }

    let active = true;

    const renderWidget = async () => {
      canAcceptTokenRef.current = execution !== 'execute';
      onTokenChange?.('');
      setStatus('loading');

      try {
        const turnstile = await loadTurnstileScript();
        if (!active || !containerRef.current) return;

        containerRef.current.innerHTML = '';
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          appearance,
          execution,
          retry,
          'refresh-expired': refreshExpired,
          'refresh-timeout': refreshTimeout,
          callback: (token) => {
            if (!active) return;
            if (execution === 'execute' && !canAcceptTokenRef.current) {
              setStatus('idle');
              onTokenChange?.('');
              return;
            }
            canAcceptTokenRef.current = execution !== 'execute';
            setStatus('ready');
            onTokenChange?.(token || '');
          },
          'expired-callback': () => {
            if (!active) return;
            canAcceptTokenRef.current = execution !== 'execute';
            setStatus('expired');
            onTokenChange?.('');
          },
          'error-callback': () => {
            if (!active) return;
            canAcceptTokenRef.current = execution !== 'execute';
            setStatus('error');
            onTokenChange?.('');
          },
          'timeout-callback': () => {
            if (!active) return;
            canAcceptTokenRef.current = execution !== 'execute';
            setStatus('timeout');
            onTokenChange?.('');
          },
        });

        onWidgetReady?.({
          execute: async () => {
            if (widgetIdRef.current === null || !window.turnstile?.execute) return false;
            canAcceptTokenRef.current = true;
            onTokenChange?.('');
            setStatus('loading');
            if (window.turnstile?.reset) {
              window.turnstile.reset(widgetIdRef.current);
            }
            window.turnstile.execute(widgetIdRef.current);
            return true;
          },
          reset: () => {
            if (widgetIdRef.current === null || !window.turnstile?.reset) return false;
            canAcceptTokenRef.current = execution !== 'execute';
            onTokenChange?.('');
            setStatus('idle');
            window.turnstile.reset(widgetIdRef.current);
            return true;
          },
        });

        if (execution === 'execute') {
          setStatus('idle');
        }
      } catch (error) {
        if (!active) return;
        setStatus('error');
        onTokenChange?.('');
      }
    };

    renderWidget();

    return () => {
      active = false;
      if (widgetIdRef.current !== null && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      onWidgetReady?.(null);
    };
  }, [action, appearance, execution, onTokenChange, onWidgetReady, refreshExpired, refreshTimeout, resetKey, retry]);

  if (isCaptchaDevBypass()) {
    return (
      <div className={cn('rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800', className)}>
        Captcha bypass is active in local development because `VITE_TURNSTILE_SITE_KEY` is not set.
      </div>
    );
  }

  if (!isCaptchaConfigured()) {
    return (
      <div className={cn('rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700', className)}>
        Captcha is unavailable in this environment. Configure `VITE_TURNSTILE_SITE_KEY` to enable it.
      </div>
    );
  }

  const statusMessage = getStatusMessage(status);

  return (
    <div className={cn('flex w-full flex-col items-center space-y-2', className)}>
      <div ref={containerRef} className="flex w-full justify-center" />
      {statusMessage ? <p className="text-center text-xs text-slate-500">{statusMessage}</p> : null}
    </div>
  );
};

export default TurnstileField;
