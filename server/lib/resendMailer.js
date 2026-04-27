const sanitizeEnvValue = (value) => {
  if (typeof value !== 'string') return '';
  let cleaned = value.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith('\'') && cleaned.endsWith('\''))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned;
};

const readEnv = (...keys) => {
  for (const key of keys) {
    const value = sanitizeEnvValue(process.env[key]);
    if (value) return value;
  }
  return '';
};

export const isResendConfigured = () =>
  Boolean(readEnv('RESEND_API_KEY') && readEnv('RESEND_FROM_EMAIL', 'OTP_FROM_EMAIL'));

export const sendResendEmail = async ({ to, subject, html, fromName = 'IndianTradeMart', fromEmail = '' }) => {
  const apiKey = readEnv('RESEND_API_KEY');
  const sender = fromEmail || readEnv('RESEND_FROM_EMAIL', 'OTP_FROM_EMAIL');

  if (!apiKey || !sender) {
    throw new Error('Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${sender}>`,
      to: [to],
      subject,
      html,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Resend send failed (${response.status})`);
  }

  return payload;
};
