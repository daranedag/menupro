# Validación de producción — 3 de noviembre de 2026

Estado: comprobaciones iniciales completadas; recorrido comercial real pendiente.

## Evidencia comprobada

- Vercel: despliegue productivo `dpl_9EpjfdLEVXAs7WdkGz93HcMT7E6G`, estado `READY`, commit `17776860b74c7eccdb0d067eb7d51b34d79b5a04`.
- Dominio `https://www.menupro.cl`: landing, acceso y precios respondieron HTTP 200. La pantalla de acceso se observó en navegador.
- Consulta privada de pagos: HTTP 200, proveedor Mercado Pago, `mode=live`, `ready=true`, `emailEnabled=true`. Esto verifica preparación e identidad del vendedor, no un cobro ni la firma del webhook.
- Consulta privada de correos: HTTP 200, proveedor Resend, `ready=true`. Esto no prueba una nueva entrega al destinatario.
- InsForge: proyecto vinculado DieGui Dev, horario `menupro-lifecycle-hourly` activo cada hora.
- Las ejecuciones de mantenimiento de las 04:00 y 05:00 UTC terminaron con HTTP 200, antes del cambio de modo descrito abajo.
- Último estado operativo consultado: sin incidentes abiertos, sin errores de pagos o correos; comprobación externa registrada.
- Cero pagos registrados en producción. El historial de Mercado Pago no mostró notificaciones para la aplicación MenuPro en la consulta realizada.
- Había dos eventos de entrega de correo registrados; no se verificó todavía su correspondencia con este recorrido comercial.

## Ajuste realizado

La aplicación estaba en `live`, pero el mantenimiento conservaba `MENUPRO_BILLING_MODE=disabled`.
Se actualizó únicamente ese ajuste de MenuPro en InsForge a `live` y se confirmó mediante una segunda lectura.
Queda pendiente comprobar una ejecución del mantenimiento posterior al cambio y su conciliación real.

No se crearon suscripciones, cobros ni cuentas de prueba, no se enviaron correos manualmente y no se adelantaron fechas de negocios.

## Recorrido pendiente para cerrar la validación

1. Seleccionar un negocio real y una cuenta compradora distinta del vendedor.
2. Comprobar acceso, edición, publicación y lectura anónima de su carta desde el QR, conservando sus direcciones.
3. Revisar Local mensual, importe, retención aplicable, descuento, fecha del primer cobro y autorización de renovación en la cotización real.
4. Completar el checkout personalmente. Si el negocio está en demo, respetar su fecha de término: la autorización por sí sola no demuestra un pago ni concede un período pagado.
5. Verificar notificación firmada, respuesta correcta, pago aprobado, período acreditado y una sola boleta pendiente. Contrastar identificadores y montos con Mercado Pago.
6. Comprobar la siguiente ejecución del mantenimiento con conciliación habilitada y sin errores. La repetición de un evento no debe acreditar otro período ni duplicar la boleta.
7. Emitir la boleta real en el SII, guardar folio/PDF y enviar al receptor cuando se indique expresamente; confirmar entrega mediante Resend.
8. Cancelar la renovación cuando lo solicite el titular, verificar el estado del proveedor y conservar el acceso pagado. La cancelación no equivale a devolución.
9. Registrar resultados y pendientes. Renovaciones futuras, vencimientos y recordatorios no se dan por comprobados en producción solo por haber pasado pruebas simuladas.

Las suites de integración existentes requieren una rama aislada y no deben ejecutarse contra DieGui Dev para este recorrido.
