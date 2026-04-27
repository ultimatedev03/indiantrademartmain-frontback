import { expressProxy } from "./_shared/expressProxy.js";

/**
 * Netlify Auth Function — Thin Compatibility Adapter
 *
 * MIGRATION NOTE (Phase 2): This function now wraps the Express app directly.
 * It exists only to preserve the /.netlify/functions/auth path for frontend 
 * callers that haven't yet switched to /api/auth.
 */
export const handler = async (event, context) => {
  return expressProxy(event, context);
};
