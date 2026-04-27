import { expressProxy } from "./_shared/expressProxy.js";

/**
 * Netlify Vendors Function — Thin Compatibility Adapter
 *
 * MIGRATION NOTE (Phase 2): This function now wraps the Express app directly.
 */
export const handler = async (event, context) => {
  return expressProxy(event, context);
};
