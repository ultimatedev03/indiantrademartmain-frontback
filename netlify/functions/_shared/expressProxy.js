import serverless from 'serverless-http';
import appModule from '../../../server/app.js';

const FUNCTION_ROUTE_MAP = Object.freeze({
  admin: '/api/admin',
  auth: '/api/auth',
  dir: '/api/dir',
  employee: '/api/employee',
  finance: '/api/finance',
  payment: '/api/payment',
  support: '/api/support',
  vendors: '/api/vendors',
});

const stripTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

const resolveExpressApp = (candidate) => {
  if (!candidate) return null;
  if (typeof candidate === 'function') return candidate;
  if (typeof candidate?.default === 'function') return candidate.default;
  if (typeof candidate?.app === 'function') return candidate.app;
  if (typeof candidate?.default?.app === 'function') return candidate.default.app;
  return null;
};

const expressApp = resolveExpressApp(appModule);

if (!expressApp) {
  const keys = Object.keys(appModule || {}).join(', ') || 'none';
  throw new TypeError(`Unsupported Express app export in expressProxy. Keys: ${keys}`);
}

const rewriteFunctionPath = (event = {}) => {
  const rawPath = String(event?.path || '').trim();
  if (!rawPath) return '/';

  const parts = rawPath.split('/').filter(Boolean);
  const fnIndex = parts.lastIndexOf('functions');
  if (fnIndex < 0 || !parts[fnIndex + 1]) return rawPath;

  const functionName = String(parts[fnIndex + 1] || '').trim();
  const baseRoute = FUNCTION_ROUTE_MAP[functionName];
  if (!baseRoute) return rawPath;

  const tail = parts.slice(fnIndex + 2).join('/');
  return tail ? `${stripTrailingSlash(baseRoute)}/${tail}` : baseRoute;
};

const expressHandler = serverless(expressApp, {
  request: (req, event) => {
    const rewrittenPath = rewriteFunctionPath(event);
    req.url = rewrittenPath;
    req.originalUrl = rewrittenPath;
  },
});

export const expressProxy = async (event, context) => {
  const rewrittenPath = rewriteFunctionPath(event);
  const nextEvent = {
    ...event,
    path: rewrittenPath,
    rawUrl: event?.rawUrl
      ? String(event.rawUrl).replace(String(event.path || ''), rewrittenPath)
      : event?.rawUrl,
  };

  if (context) {
    context.callbackWaitsForEmptyEventLoop = false;
  }

  return expressHandler(nextEvent, context);
};
