export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

export const CAPTCHA_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  EXPIRED: 'expired',
  ERROR: 'error',
  TIMEOUT: 'timeout',
  UNAVAILABLE: 'unavailable',
  DEV_BYPASS: 'dev_bypass',
};

export const isCaptchaConfigured = () => Boolean(TURNSTILE_SITE_KEY);

export const isCaptchaDevBypass = () => import.meta.env.DEV && !TURNSTILE_SITE_KEY;

export const getInitialCaptchaStatus = () => {
  if (isCaptchaDevBypass()) return CAPTCHA_STATUS.DEV_BYPASS;
  if (!isCaptchaConfigured()) return CAPTCHA_STATUS.UNAVAILABLE;
  return CAPTCHA_STATUS.IDLE;
};

export const getCaptchaValidationTitle = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  if ([CAPTCHA_STATUS.ERROR, CAPTCHA_STATUS.UNAVAILABLE].includes(normalizedStatus)) {
    return 'Captcha Unavailable';
  }

  if (normalizedStatus === CAPTCHA_STATUS.LOADING) {
    return 'Captcha Loading';
  }

  if ([CAPTCHA_STATUS.EXPIRED, CAPTCHA_STATUS.TIMEOUT].includes(normalizedStatus)) {
    return 'Captcha Retry Required';
  }

  return 'Captcha Required';
};

export const getCaptchaStatusMessage = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase();

  if (normalizedStatus === CAPTCHA_STATUS.EXPIRED) {
    return 'Captcha expired. Please complete it again.';
  }

  if (normalizedStatus === CAPTCHA_STATUS.ERROR) {
    return 'Captcha failed to load. Use Reload CAPTCHA to try again.';
  }

  if (normalizedStatus === CAPTCHA_STATUS.TIMEOUT) {
    return 'Captcha timed out. Use Reload CAPTCHA to try again.';
  }

  if (normalizedStatus === CAPTCHA_STATUS.UNAVAILABLE) {
    return 'Captcha is unavailable right now. Use Reload CAPTCHA to try again.';
  }

  return '';
};

export const canRetryCaptcha = (status) => {
  const normalizedStatus = String(status || '').trim().toLowerCase();
  return [
    CAPTCHA_STATUS.ERROR,
    CAPTCHA_STATUS.EXPIRED,
    CAPTCHA_STATUS.TIMEOUT,
    CAPTCHA_STATUS.UNAVAILABLE,
  ].includes(normalizedStatus);
};

export const getCaptchaValidationError = (token, status) => {
  const normalizedToken = String(token || '').trim();
  const normalizedStatus = String(status || '').trim().toLowerCase();

  if (normalizedToken) return '';
  if (isCaptchaDevBypass()) return '';
  if (!isCaptchaConfigured() || normalizedStatus === CAPTCHA_STATUS.UNAVAILABLE) {
    return 'Captcha failed to load. Use Reload CAPTCHA to try again.';
  }
  if (normalizedStatus === CAPTCHA_STATUS.ERROR) {
    return 'Captcha failed to load. Use Reload CAPTCHA to try again.';
  }
  if (normalizedStatus === CAPTCHA_STATUS.LOADING) {
    return 'Captcha is still loading. Wait a moment or use Reload CAPTCHA if it stays stuck.';
  }
  if (normalizedStatus === CAPTCHA_STATUS.TIMEOUT) {
    return 'Captcha timed out. Use Reload CAPTCHA to try again.';
  }
  if (normalizedStatus === CAPTCHA_STATUS.EXPIRED) {
    return 'Captcha expired. Complete it again before continuing.';
  }

  return 'Please complete the CAPTCHA verification.';
};
