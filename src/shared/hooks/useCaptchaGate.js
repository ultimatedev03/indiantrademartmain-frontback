import { useCallback, useState } from 'react';
import { getCaptchaValidationError } from '@/shared/lib/captcha';

export const useCaptchaGate = () => {
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken('');
    setCaptchaResetKey((prev) => prev + 1);
  }, []);

  const getCaptchaError = useCallback(() => getCaptchaValidationError(captchaToken), [captchaToken]);

  return {
    captchaToken,
    setCaptchaToken,
    captchaResetKey,
    resetCaptcha,
    getCaptchaError,
  };
};
