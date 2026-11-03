/** Return only known, safe provider diagnostics. Never expose the raw response. */
export function mercadoPagoFailure(providerStatus, body) {
  const message = typeof body?.message === 'string' ? body.message : '';
  const match = message.match(/^Cannot pay an amount lower than\s*\$\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*$/i);
  const minimum = match ? Number(match[1].replaceAll(',', '')) : NaN;
  if ([400, 422].includes(providerStatus) && Number.isFinite(minimum) && minimum > 0 && minimum <= 1_000_000_000) {
    const minimumAmount = Math.ceil(minimum);
    return {
      status: 422,
      message: `Mercado Pago exige un cobro mínimo de $${new Intl.NumberFormat('es-CL').format(minimumAmount)}. Contacta a MenuPro para ajustar esta oferta.`,
      diagnostic: { providerStatus, code: 'amount_below_minimum', minimumAmount },
    };
  }
  return {
    status: 502,
    message: 'Mercado Pago no pudo completar la operación. Puedes reintentar sin perder tu contenido.',
    diagnostic: { providerStatus, code: 'provider_rejected' },
  };
}
