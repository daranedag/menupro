// Read-only provider check. Never creates subscriptions or charges a card.
const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
if (!token) {
  console.error('Configura la credencial privada de Mercado Pago antes de comprobar la conexión.');
  process.exitCode = 1;
} else {
  try {
    const response = await fetch('https://api.mercadopago.com/preapproval/search?limit=1', {
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000),
    });
    console.log(JSON.stringify({ applicationId: process.env.MERCADOPAGO_APPLICATION_ID || null,
      subscriptionsApi: response.ok ? 'accessible' : 'rejected', httpStatus: response.status,
      configuredMode: process.env.MENUPRO_BILLING_MODE || 'disabled',
      webhookSecretConfigured: Boolean(process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim()),
      note: 'Esta consulta no crea cobros ni certifica el recorrido de pago o las notificaciones.' }, null, 2));
    if (!response.ok) process.exitCode = 1;
  } catch {
    console.error('No se pudo conectar con Mercado Pago. Revisa la conexión antes de habilitar la contratación.');
    process.exitCode = 1;
  }
}
