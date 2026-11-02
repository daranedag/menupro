# Lanzamiento: Local mensual

Alcance aprobado: Local mensual por $9.990 brutos. El titular confirmó que su giro y servicio permiten emitir boletas de honorarios. La emisión será manual en el SII; MenuPro guarda el PDF y lo envía por Resend.

## Disponibilidad

- `Administración → Planes disponibles para contratar` contiene dos controles independientes: Grupo y anualidad. Ambos parten desactivados.
- La landing muestra las opciones desactivadas como «Próximamente». Los controles también se aplican en cotizaciones y nuevas contrataciones, incluidos los pagos por transferencia, mediante PostgreSQL.
- Desactivar una opción no revoca contratos existentes, pagos confirmados, renovaciones, cancelaciones ni conciliación.
- Habilitar estos controles no activa Mercado Pago productivo.

## Boletas

1. Emitir la boleta en el SII usando el receptor, bruto, retención y monto pagado que muestra la bandeja.
2. En administración, registrar folio y fecha, elegir el PDF (máximo 2 MB) y pulsar **Guardar PDF y folio**.
3. Revisar el correo del receptor y pulsar **Enviar boleta por correo**.

El archivo se guarda en `menupro_fiscal`, un bucket privado. Solo administración y el propietario del negocio pueden descargarlo. Se verifican tamaño, encabezado y SHA-256. Al iniciar el envío quedan inmóviles el archivo y el folio. Una cola con reservas evita envíos concurrentes; los reintentos conservan el PDF y la clave de idempotencia de Resend. La copia temporal del adjunto en la cola se elimina tras la aceptación; el PDF privado se conserva.

El panel distingue aceptación, entrega al servidor de correo, demora, rechazo y reclamo. Las notificaciones de Resend se verifican con Svix sobre el cuerpo original y se registran sin duplicados. Un intento ambiguo que supera 23 horas requiere revisión en Resend; no se reenvía automáticamente fuera de su ventana de idempotencia.

## Alertas

- Mantenimiento terminado con errores o sin respuesta por 150 minutos.
- Tres errores consecutivos de conciliación de pagos.
- Correos pendientes por más de dos horas.
- Boletas pendientes de emisión/PDF por más de 72 horas.
- Problemas de envío de boletas y notificaciones de demora, rechazo o reclamo.
- Ausencia de la vigilancia externa por 150 minutos.

Los incidentes y sus recuperaciones generan avisos por Resend al correo administrador configurado; no se crea un aviso nuevo en cada comprobación de un incidente abierto. La bandeja de administración muestra estado, historial y última ejecución.

El mantenimiento horario conserva su trabajo en InsForge. Un monitor en GitHub Actions comprueba la aplicación aproximadamente cada 15 minutos y puede avisar por Resend aunque la aplicación o el backend fallen. Solo recibe un token de comprobación y una credencial de envío restringida al dominio; no recibe el secreto financiero ni claves administrativas del backend. Las acciones están fijadas a revisiones específicas y solo se ejecutan en `main`. Su caché contiene únicamente el estado de incidentes, sin datos de clientes ni secretos.

GitHub puede retrasar horarios y suspende los horarios de repositorios públicos sin actividad durante 60 días. El mantenimiento vigila la fecha de la última comprobación externa para advertir si esto ocurre. No se ofrece un plazo garantizado de detección.

## Despliegue

Con CLI y `.env.local` apuntando al mismo backend:

```text
node scripts/prepare-fiscal-storage.mjs
pnpm db:migrate
pnpm run build
```

Publicar el código en el proyecto existente de Vercel. Mantener `MENUPRO_BILLING_MODE=disabled` hasta la activación productiva autorizada. Desplegar el mantenimiento con `scripts/configure-business-worker.mjs`. Configurar los dos secretos cifrados del monitor mediante `scripts/configure-operations-watchdog.mjs --dispatch`, usando la autenticación del repositorio; sus valores nunca se imprimen.

En Resend, registrar `https://www.menupro.cl/api/emails/resend/webhook` para `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`, `email.failed` y `email.suppressed`. Guardar su firma exclusivamente como `RESEND_WEBHOOK_SECRET` en Vercel y en la configuración local ignorada.

## Activación comercial pendiente

- Credenciales y notificaciones productivas de Mercado Pago.
- Compra real controlada y cancelación de su renovación. No se debe confundir la cancelación con una devolución.
