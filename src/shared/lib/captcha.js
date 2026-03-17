export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

export const isCaptchaConfigured = () => Boolean(TURNSTILE_SITE_KEY);

export const isCaptchaDevBypass = () => import.meta.env.DEV && !TURNSTILE_SITE_KEY;

export const getCaptchaValidationError = (token) => {
  const normalizedToken = String(token || '').trim();

  if (normalizedToken) return '';
  if (isCaptchaDevBypass()) return '';
  if (!isCaptchaConfigured()) {
    return 'Captcha is not configured for this environment.';
  }

  return 'Please complete the CAPTCHA verification.';
};
