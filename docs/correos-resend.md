# Correos de MenuPro con Resend

## Transporte

Las invitaciones de equipo, demos asistidas y los avisos de demo, impago, suspensión, reactivación y conservación usan la API de Resend. `src/lib/resend-email.mjs` centraliza el envío y `src/lib/notification-email.mjs` procesa la cola de avisos.

El horario `menupro-lifecycle-hourly` de InsForge sigue generando los avisos. Su función llama por HTTPS a `/api/internal/notifications` en Next.js, con el secreto privado de operaciones. Next reclama avisos de la base de datos y los envía a través de Resend. El endpoint no acepta destinatarios ni mensajes proporcionados por el solicitante. Ni la función ni Next necesitan una clave administrativa de InsForge para estos envíos; la clave de Resend permanece en Vercel.

Las reservas de diez minutos evitan que dos ejecuciones reclamen el mismo aviso. Cada aviso usa una clave estable de idempotencia de Resend. Se espacian los envíos y se deja de procesar la tanda ante límites de frecuencia o un error de autorización. Los errores quedan pendientes para volver a intentar; se marca enviado solamente si Resend devuelve un identificador de correo válido. Si falla la confirmación en la base después de aceptar el correo, el reintento reutiliza la misma clave. Resend conserva estas claves durante 24 horas; no es una garantía de entrega exactamente una vez tras interrupciones más largas.

`email_sent_at` significa aceptación por el proveedor, no llegada comprobada a la bandeja del destinatario. La revisión de entrega, rebotes y spam se realiza en Resend. No se ha añadido un webhook de seguimiento de entrega.

## Dominio y remitente

Ser dueño de `menupro.cl` permite publicar los registros DNS que Resend exige para demostrar su autorización para enviar. No es necesario crear una casilla de correo para `notificaciones@menupro.cl`. La recepción de correo es una configuración independiente.

1. Añadir `menupro.cl` en Domains de Resend.
2. Copiar los registros exactos mostrados por Resend a Vercel DNS. Conservar todos los registros existentes y no sustituir los MX de la raíz del dominio.
3. Esperar a que Resend muestre el dominio como verificado.
4. Utilizar `RESEND_FROM=MenuPro <notificaciones@menupro.cl>` y, si se desean recibir respuestas en Gmail, `RESEND_REPLY_TO=daranedag@gmail.com`.

No usar `gmail.com` como dominio remitente: no se controla su DNS y no puede verificarse en la cuenta de MenuPro.

## Activación de invitaciones y recordatorios

En Vercel: configurar `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO` opcional, `APP_URL=https://www.menupro.cl` y `MENUPRO_EMAIL_ENABLED=true`. Crear un despliegue que incluya el endpoint nuevo. Antes de activar el horario, validar el dominio y el remitente y probar el envío con las direcciones de prueba oficiales de Resend.

Desde el repositorio, con `.env.local` y el proyecto InsForge vinculados al mismo backend:

```sh
pnpm exec node scripts/configure-business-worker.mjs --enable-email --app-url=https://www.menupro.cl
```

El comando comprueba el endpoint privado, guarda `MENUPRO_APP_URL`, despliega la función, habilita el envío de forma explícita y verifica la ejecución. Sin `--enable-email`, conserva los estados de correo y pagos que ya existan, inicializando como deshabilitados solo los secretos nuevos. No configura ni activa Mercado Pago.

Inspeccionar el horario y sus registros con `pnpm exec insforge schedules get <id>` y `pnpm exec insforge schedules logs <id>`. Una respuesta de error en Resend hace fallar la ejecución y deja los avisos pendientes. Validar también la interfaz de invitaciones y su enlace alternativo.

## Verificación de cuenta y recuperación de contraseña

Estos correos los genera la autenticación de InsForge, utilizando SMTP de Resend. El titular autorizó el 1 de noviembre de 2026 aplicar Resend al backend compartido DieGui Dev. Este ajuste afecta al remitente de autenticación de todas sus aplicaciones.

Después de verificar el dominio, configurar privadamente `RESEND_FROM` en `.env.local` y guardar la clave de Resend como secreto `MENUPRO_RESEND_API_KEY` del backend vinculado. La CLI resuelve las referencias `env()` desde los secretos de InsForge, no desde las variables del proceso. Preparar el cambio:

```sh
pnpm exec node scripts/configure-resend-auth.mjs
```

El script genera un archivo ignorado con SMTP `smtp.resend.com:465`, usuario `resend` y una referencia al secreto privado del backend, sin escribir la clave en ese archivo ni en los argumentos del cambio SMTP. Usa `insforge config plan/apply` y cambia exclusivamente `auth.smtp`; conserva métodos de verificación, contraseñas, Google y demás ajustes. Probar primero en una rama del backend para comprobar envío de códigos y restablecimiento; no incorporar usuarios de prueba al backend principal.

Aplicar después de comprobar el plan y la prueba SMTP:

```sh
pnpm exec node scripts/configure-resend-auth.mjs --apply
```

La aplicación continúa usando los métodos oficiales de autenticación para generar y validar los códigos. No se sustituyen por códigos inventados en el navegador. La entrega pasa por Resend.

## Comprobaciones

- `pnpm test`: pruebas del transporte, HTML escapado, idempotencia, errores, reservas y límites de tiempo.
- `pnpm test:auth`: recuperación de contraseña y protección del endpoint de avisos contra solicitudes sin credenciales o intentos de enviar mensajes arbitrarios. Usa datos y proveedores simulados.
- `pnpm typecheck` y `pnpm run build`: tipos y compilación.
- Verificación externa: dominio verificado en Resend; correo aceptado y entregado en sus registros; invitación aceptada con el correo correcto; códigos de alta y recuperación; ejecución horaria sin duplicar avisos. Los tests simulados no certifican entregas reales.

## Referencias

- [Dominios verificados](https://resend.com/docs/dashboard/domains/introduction).
- [SMTP de Resend](https://resend.com/docs/send-with-smtp).
- [Idempotencia](https://resend.com/docs/dashboard/emails/idempotency-keys).
