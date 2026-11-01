# Boletas de honorarios y conciliación

Decisión del titular del 1 de noviembre de 2026: emisión manual de boletas de honorarios, sin facturas; mantener los precios brutos de Local y Grupo. No sumar IVA a las contrataciones nuevas. Los registros anteriores conservan su tratamiento original.

## Importes

| Plan | Mensual bruto | Anual bruto |
| --- | ---: | ---: |
| Local | $9.990 | $99.900 |
| Grupo | $24.990 | $249.900 |

Bienvenida Local: $7.992 brutos en cada una de las tres primeras mensualidades, o $89.910 brutos el primer año. Cuando el receptor retiene, en 2026 el cobro regular mensual de Local es $8.467 y la retención $1.523. Con bienvenida son $6.773 y $1.219, respectivamente. Cuando el emisor paga PPM, el cliente paga el bruto completo. Las comisiones de Mercado Pago no cambian el bruto ni la retención de la boleta.

La tasa se determina en horario de Chile: 15,25% en 2026; 16% en 2027 y 17% desde 2028. La actualización de las renovaciones considera `next_payment_date` del proveedor. Una diferencia entre el año programado y el año de aprobación queda marcada para revisión tributaria. Confirmar con contabilidad que el giro y el servicio efectivamente prestado admiten la emisión de honorarios antes de activar cobros reales; la selección del documento no realiza esa validación tributaria.

## Operación

1. El propietario guarda RUT válido, nombre o razón social, domicilio, comuna, correo y modalidad de retención en **Suscripción**. Selecciona la modalidad legal que corresponde al receptor.
2. MenuPro cotiza en el servidor, muestra bruto, retención e importe a cobrar y guarda una copia de esos datos en la contratación. Para modificarlos con una renovación activa, cancelar esa renovación y realizar una contratación nueva. Los registros históricos no cambian.
3. Solo un pago aprobado y validado contra Mercado Pago genera acceso y una boleta pendiente. La autorización de una tarjeta no acredita un período.
4. En **Administración → Boletas de honorarios**, consultar la bandeja paginada y emitir y entregar manualmente el documento del SII. Registrar folio y fecha reales. MenuPro no genera un documento fiscal ni presenta declaraciones tributarias.
5. El aviso de registro se encola y envía por **Resend** al correo tributario guardado. Incluye el folio y el enlace a Suscripción; no adjunta la boleta del SII. Repetir la misma confirmación no genera otro aviso.
6. Devoluciones, contracargos o diferencias de año requieren revisión. No se anula automáticamente ningún documento del SII. El registro de pago descargable es informativo.

## Recuperación de pagos

El mantenimiento horario llama a `POST /api/internal/payments` con el secreto privado de MenuPro. El endpoint ignora datos de cobro proporcionados por el solicitante y obtiene las contrataciones desde una cola privada con reservas temporales. Las credenciales de Mercado Pago permanecen en Next/Vercel; no se necesitan en el mantenimiento de InsForge.

Se recuperan contrataciones que quedaron sin vincular, se recorren las páginas de cobros y se guardan sus identificadores y fechas. Solo después de completar el recorrido se procesan de antiguo a nuevo. Cada confirmación se valida nuevamente contra la API. El avance se conserva entre ejecuciones con tiempo limitado; errores, respuestas incompletas y reservas vencidas se reintentan. El identificador del pago y el de la cuota evitan acreditar dos veces. La revisión manual desde Suscripción usa el mismo proceso y limita la frecuencia.

Los avisos y la conciliación se procesan de forma independiente: una falla de Resend no omite la consulta de cobros. La administración muestra errores y el siguiente intento. En el lanzamiento de menor volumen la frecuencia es horaria; aumentar capacidad y frecuencia cuando crezca la cola.

Para activar el mantenimiento de pagos, desplegar primero el mismo modo y sus credenciales en Next y luego ejecutar `node scripts/configure-business-worker.mjs --billing-mode=test --app-url=https://tu-entorno-aislado`. El script comprueba privadamente el modo antes de activarlo. `live` exige la validación final del proveedor y autorización de lanzamiento. Por defecto se conserva `disabled`.

## Pruebas y límites

`tests/integration/local-release.spec.ts` recorre navegador → API → PostgreSQL aislado: demo, carta y QR público, contratación, autorización sin cobro, cobro sin webhook, repetición, renovación, rechazo, fin de gracia, reactivación, fin del descuento, aislamiento tributario y registro de boleta. Mercado Pago se sustituye únicamente en el servidor de pruebas mediante un módulo de pruebas; el código de producción siempre utiliza la API oficial.

Iniciar ese servidor solo con una rama de InsForge vinculada: `node tests/helpers/start-payments-server.mjs`. Ejecutar `pnpm exec playwright test`. Correos deshabilitados y ninguna llamada financiera al proveedor en ese recorrido. Las pruebas unitarias cubren firma, importes, cambios de año, paginación y recuperación de fallos. Estas pruebas no certifican el checkout ni la entrega efectiva de webhooks de Mercado Pago; esos puntos necesitan una prueba separada con vendedor y comprador de prueba.

## Referencias primarias

- [SII: tasas de honorarios por año](https://www.sii.cl/destacados/boletas_honorarios/).
- [SII: PPM cuando no retiene el receptor](https://www.sii.cl/preguntas_frecuentes/declaracion_renta/001_140_0717.htm).
- [Mercado Pago: buscar cobros de una suscripción](https://www.mercadopago.cl/developers/es/reference/online-payments/subscriptions/authorized-payment-search/get).
- [Mercado Pago: cuentas vendedora y compradora para probar suscripciones](https://www.mercadopago.cl/developers/es/news/2023/11/16/Questions-on-how-to-test-your-integration--).
