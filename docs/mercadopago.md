# Mercado Pago en MenuPro

## Aplicación

Creada el 1 de noviembre de 2026 en la cuenta conectada de Chile (MLC).

- Nombre: MenuPro.
- ID: `3623413345304006`.
- Producto: Suscripciones, pagos online, desarrollo propio.
- Sitio: https://www.menupro.cl.
- Panel: https://www.mercadopago.cl/developers/panel/app/3623413345304006.

## Estado de esta configuración

- Aplicación y notificaciones de prueba creadas.
- Credencial de prueba guardada en `.env.local` y Vercel. La API de suscripciones respondió HTTP 200 a una consulta de lectura.
- Credencial y firma del webhook guardadas con tipo Secret en Vercel. La firma local aún debe copiarse privadamente desde el panel si se va a usar el servidor local.
- Contratación deshabilitada (`MENUPRO_BILLING_MODE=disabled`); no se procesaron cobros.
- Checkout y pago ficticio aprobados con vendedor y comprador de prueba, recuperación del cobro validada y reintentos firmados recibidos con HTTP 200. Ver validacion-local-20261101.md para el alcance y los límites.
- Falta completar la activación de credenciales productivas en Mercado Pago antes del lanzamiento de pagos reales.

## Solución elegida

Una suscripción sin plan asociado de Mercado Pago por negocio. Los planes Local y Grupo siguen definidos en MenuPro. La fecha de inicio y el importe pueden variar por cliente según los días restantes de demo y el descuento de bienvenida. Se crea una autorización pendiente mediante `/preapproval` y se redirige al cliente al enlace devuelto por Mercado Pago para elegir su medio de pago.

La demo se activa dentro de MenuPro sin tarjeta. Autorizar una suscripción no acredita un período pagado: se espera la confirmación del cobro, contrastada con la API del proveedor. El primer cobro durante la demo debe respetar su vencimiento. Este comportamiento debe comprobarse con el checkout real de pruebas antes de ofrecerlo a clientes.

Para el primer lanzamiento se valida Local mensual con honorarios brutos de 9.990 CLP y bienvenida de 7.992 CLP. El importe transferido depende de la retención del receptor. Ver boletas-honorarios.md. La cuarta mensualidad vuelve a la tarifa regular. Anualidad y Grupo requieren sus propios recorridos del proveedor.

## Credenciales y notificaciones

La aplicación dispone de credenciales de prueba. Para Suscripciones, la validación completa utilizó una aplicación separada dentro de una cuenta vendedora ficticia y las credenciales productivas de esa cuenta de prueba. La API verifica el vendedor con test_user; su pago puede informar live_mode=true. Sus credenciales de producción requieren completar la activación en Mercado Pago. Nunca deducir el entorno solamente por el prefijo de una credencial ni usar credenciales de otra aplicación.

El 1 de noviembre se registró la URL de prueba `https://www.menupro.cl/api/payments/mercadopago/webhook` para `subscription_preapproval`, `subscription_authorized_payment` y `payment`. La URL productiva no está configurada. Verificar la entrega efectiva: la documentación genérica de notificaciones tiene indicaciones diferentes para Suscripciones y el panel sí permite seleccionar sus eventos; guardar la configuración por sí solo no valida la entrega.

La firma completa se obtiene en Webhooks del panel y se guarda privadamente en `MERCADOPAGO_WEBHOOK_SECRET`. El MCP solo devuelve sus primeros caracteres: no utilizar ese fragmento como secreto. La integración actual exige firma válida y consulta el recurso antes de acreditar pagos; no deshabilitar esa comprobación para hacer pasar una simulación.

En Next/Vercel se necesitan `APP_URL`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MENUPRO_WORKER_SECRET` y `MENUPRO_BILLING_MODE`. En el mantenimiento de InsForge debe configurarse el mismo modo; las credenciales del proveedor permanecen en Next/Vercel, según `operacion-comercial.md`. No cambiar secretos de otras aplicaciones del backend compartido.

Mantener el modo `disabled` hasta completar la firma, el despliegue y el entorno de pruebas. Cambiar una variable de Vercel requiere un nuevo despliegue para que la aplicación la reciba. Para probar sin afectar clientes, usar un despliegue y una rama de datos aislados, con su propio secreto de operaciones; no adelantar fechas ni crear negocios sintéticos en el backend principal.

## Comprobación de conexión

Validación del 5 de noviembre de 2026: la API productiva devolvió `authorized` para la suscripción de validación Local mensual, con importe de $999 y primer cobro previsto para el 17 de noviembre. No había pagos registrados ni fecha de último cargo en el resumen del proveedor. La autorización respeta los días restantes de demo; el correo de adhesión no acredita un débito.

La pantalla de Suscripción y el directorio administrativo distinguen el acuerdo autorizado del acceso por demo o período pagado. Una contratación `authorized` aparece en el resumen de la suscripción y deja de ofrecer un enlace para continuar el checkout. Solo `pending` y `ready` se muestran como contrataciones pendientes. El período pagado y las boletas siguen dependiendo del cobro aprobado y verificado; no se adelantan al autorizar ni al vencer la demo.

Validación productiva del 3 de noviembre de 2026: crear una suscripción pendiente por $500 respondió HTTP 400 con `Cannot pay an amount lower than $ 950.00`. La consulta por referencia no encontró una suscripción creada. El titular autorizó sustituir la oferta individual de 95% por 90% solo en la primera mensualidad ($999 brutos), conservando el resto de condiciones y el término de la demo. La solicitud fallida conserva sus importes originales y debe anularse antes de reservar una nueva; no se modifica el precio de un checkout existente. El BFF traduce este rechazo conocido a HTTP 422 con el mínimo informado y registra únicamente diagnóstico seguro, sin credenciales ni datos del pagador.

Ejecutar `pnpm payments:check` desde este repositorio. Solo consulta la API de suscripciones y muestra el estado HTTP, sin imprimir tokens, datos del pagador ni registros del proveedor. No crea ni autoriza cobros. Un resultado correcto no acredita todavía la firma del webhook ni el pago completo.

## Prueba completa antes de habilitar cobros

1. Usar una cuenta compradora de prueba y los datos de tarjeta de prueba oficiales vigentes de Chile, separados de la cuenta vendedora.
2. Registrar un negocio en el entorno aislado, activar la demo y guardar/publicar una carta.
3. Consultar el precio de Local mensual y verificar descuento, honorario bruto, retención y fecha del primer cobro.
4. Continuar a Mercado Pago, autorizar y regresar. Confirmar que una autorización sin cobro no concede un período pagado.
5. Confirmar que llega la notificación, pasa la firma y acredita el período una sola vez. Repetir el evento y comprobar que no duplica el período ni consume otro descuento.
6. Verificar rechazo, pago pendiente, cancelación y renovación. Comprobar las tres mensualidades con descuento y el cambio de importe posterior. Adelantar fechas solo en la rama de pruebas.
7. Comprobar conservación de cartas y QR al contratar, siete días de gracia ante impago de renovación y recuperación tras regularizar.
8. Habilitar producción con las credenciales y URL correspondientes después de validar los resultados. Realizar el primer cobro real controlado con autorización expresa del titular.

La evaluación automática de calidad del MCP respondió `Product not homologable` para esta aplicación. Esto no acredita ni rechaza el flujo de suscripción; se debe conservar evidencia de las pruebas funcionales.

## Referencias oficiales

- [Suscripciones sin plan asociado](https://www.mercadopago.com/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/introduction).
- [Creación pendiente y enlace de pago](https://www.mercadopago.com/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments).
- [Gestión de suscripciones e importes](https://www.mercadopago.com/developers/es/docs/subscriptions/subscription-management).
- [Cuentas de prueba](https://www.mercadopago.cl/developers/es/docs/your-integrations/test/accounts).
