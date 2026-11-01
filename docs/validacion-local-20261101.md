# Validación del lanzamiento de Local — 1 de noviembre de 2026

## Resultado

Aplicación de prueba de Mercado Pago **MenuPro Pruebas Suscripciones**, ID `2841258013912559`, perteneciente al vendedor ficticio `3426677054`. Se verificó `test_user` en la API antes de utilizar su credencial. Comprador ficticio distinto, tarjeta oficial de prueba para Chile y base de datos aislada de InsForge. No se habilitaron cobros reales.

La contratación de Local creada desde el BFF respondió HTTP 201 y abrió el checkout auténtico por **$7.992**, correspondiente al descuento inicial sobre $9.990 brutos. El proveedor aprobó el pago ficticio `186223499043`, de la suscripción `88f4f1fa67834831bc19666843386fee`.

Se comprobó lo siguiente:

- La autorización o contratación pendiente no concedió acceso pagado.
- La conciliación recuperó un pago aprobado cuyo aviso inicial no se había aplicado. MenuPro pasó a activo y creó exactamente un registro de pago y una boleta de honorarios pendiente.
- El proveedor reintentó las notificaciones firmadas de `payment` y `subscription_authorized_payment`; ambas recibieron HTTP 200. El período y la boleta no se duplicaron.
- La cancelación desde MenuPro canceló la renovación en Mercado Pago y conservó el acceso al período pagado.
- Un receptor temporal admitió exclusivamente la ruta del webhook. Otras rutas devolvieron 404 y una notificación sin firma devolvió 401. El receptor y el acceso temporal se cerraron después de la prueba.

## Correcciones descubiertas en la prueba auténtica

- Suscripciones requiere usar las credenciales productivas del **vendedor de prueba** para probar con un comprador ficticio. La credencial de prueba de una cuenta real había devuelto `Both payer and collector must be real or test users`.
- Los pagos de ese vendedor ficticio informan `live_mode=true`. MenuPro ahora verifica el tipo e identidad del vendedor en `/users/me`, el `collector_id` del pago y el modo configurado. No decide el entorno por el prefijo del token ni por esa marca aislada.
- La consulta de cobros recurrentes rechazó `limit=50` y `limit=20`; aceptó `limit=10`. La recuperación utiliza diez registros por página para ese recurso y conserva el progreso entre ejecuciones.
- La sincronización conserva el descuento contratado antes del primer pago, cuando todavía no existe `welcome_redeemed_at`.

## Alcance de las pruebas controladas

El recorrido automatizado de navegador y PostgreSQL aislado cubre demo de 15 días, carta pública y QR, contratación, recuperación sin webhook, confirmaciones repetidas, renovación, rechazo, fin de gracia, suspensión, reactivación, fin del descuento, aislamiento de datos tributarios y registro administrativo de boletas. Estas variaciones se ejecutan con respuestas controladas del proveedor; no se esperó un mes calendario para un segundo cobro auténtico.

También se comprobaron RLS, transferencias manuales, reducción de plan, contracargos y recuperación sin duplicar meses. Las pruebas unitarias verifican firmas, importes, tasas por año de Chile, límites de tiempo, paginación y fallos reintentables. Las pruebas de autenticación verifican que las rutas privadas no acepten llamadas públicas ni pagos o correos arbitrarios enviados en el cuerpo.

La API de devolución del pago ficticio respondió HTTP 401 `Unauthorized use of live credentials`. No se afirmó que esa devolución se completara. La reacción ante devoluciones y contracargos se validó mediante pruebas controladas; la renovación ficticia sí quedó cancelada.

La emisión y entrega del documento del SII siguen siendo manuales. MenuPro registra los datos, importes, folio y fecha, y encola el aviso de registro mediante Resend. El aviso no adjunta un documento fiscal generado por MenuPro.
