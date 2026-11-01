/** Server configuration is passed explicitly; this module contains no credentials. */
export function resendReady(config) {
  return config.enabled && Boolean(config.apiKey?.trim() && config.from?.trim())
    && !/[\r\n]/.test(config.from) && (!config.replyTo || !/[\r\n]/.test(config.replyTo));
}

export function emailEscape(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** All application emails use this transport, including queued reminders. */
export async function sendResendEmail(message, config, fetchEmail = fetch) {
  if (!config.enabled) return { emailSent: false, emailStatus: 'disabled' };
  if (!resendReady(config)) return { emailSent: false, emailStatus: 'unconfigured' };
  try {
    const response = await fetchEmail('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${config.apiKey.trim()}`,
        'Content-Type': 'application/json', 'Idempotency-Key': message.idempotencyKey },
      body: JSON.stringify({ from: config.from.trim(), to: [message.to], subject: message.subject,
        html: message.html, text: message.text, ...(config.replyTo ? { reply_to: config.replyTo.trim() } : {}) }),
      signal: AbortSignal.timeout(10000), cache: 'no-store',
    });
    if (!response.ok) return { emailSent: false, emailStatus: 'failed', httpStatus: response.status };
    const data = await response.json();
    return typeof data?.id === 'string' && data.id
      ? { emailSent: true, emailStatus: 'sent', emailId: data.id }
      : { emailSent: false, emailStatus: 'failed' };
  } catch {
    return { emailSent: false, emailStatus: 'failed' };
  }
}
