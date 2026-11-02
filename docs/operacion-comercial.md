# Operación comercial de MenuPro

El lanzamiento está limitado a **Local mensual**. Administración permite habilitar por separado Grupo y anualidad; las opciones desactivadas aparecen como «Próximamente». El panel incorpora carga y envío de boletas PDF y alertas operativas. Ver [la operación de lanzamiento](lanzamiento-local-mensual.md).

Implementación del acuerdo del 31 de octubre de 2026. Consultar `reglas-de-negocio.md` para precios, límites y políticas.

## Recorridos

- Registro con Google o correo → verificación → datos del restaurante → aceptación expresa de la demo → carta de ejemplo sin publicar.
- Mi negocio: integrantes, invitaciones ligadas al correo verificado, transferencia de propiedad, archivo/restauración de locales y descarga de los datos propios.
- Suscripción: planes y cotización de honorarios brutos, con retención cuando corresponde, oferta de bienvenida, autorización de renovación, contratación pendiente, cancelación y reducción con selección del local.
- Administración: disponible únicamente para el correo verificado `daranedag@gmail.com`; revisión de coincidencias, demos preparadas sin iniciar el reloj, cortesías y registro de transferencias recibidas.
- Recuperación de contraseña: código por correo, intercambio por un token conservado en una cookie HttpOnly y confirmación de la nueva contraseña.

El administrador general utiliza las funciones administrativas; esa condición no lo convierte en integrante de todos los negocios ni le concede acceso genérico a su contenido por las rutas de clientes.

## Acceso y datos

- Las tablas comerciales no aceptan modificaciones directas del cliente. Las operaciones privilegiadas validan propietario o administrador y generan auditoría.
- La consulta pública y las políticas de escritura comprueban fechas y cupos dentro de la base de datos. No dependen de un temporizador del navegador ni de que el mantenimiento se ejecute puntualmente.
- La autorización de una suscripción en Mercado Pago no equivale a un pago aprobado.
- Las notificaciones de pagos se validan mediante firma HMAC y se contrastan consultando los recursos de Mercado Pago. La referencia, moneda e importe se comprueban antes de acreditar el período.
- Cada pago se acredita una vez; los reintentos y eventos repetidos no deben extender nuevamente el período ni consumir otra mensualidad de descuento.
- Las cortesías usan un plan temporal separado del plan contratado. Al vencer, dejan de ampliar el cupo.
- La antigua referencia al creador del restaurante usa `ON DELETE SET NULL`; eliminar la cuenta de un propietario anterior no elimina contenido transferido.
- Las señales mínimas de restaurantes se conservan 24 meses desde su última actividad. Son datos seudonimizados, no anónimos.
- El contenido vencido se elimina después de 180 días y de un aviso enviado al menos 30 días antes. Sin confirmación de envío del aviso, el mantenimiento no ejecuta el borrado.

## Mantenimiento horario

El código está en `functions/menupro-lifecycle.ts`. El servicio se ejecuta en InsForge y:

1. Genera los avisos de demo, vencimiento, gracia, suspensión y conservación, sin duplicarlos.
2. Procesa la retención del contenido y el vencimiento de señales contra abuso.
3. Envía los avisos por Resend mediante el endpoint privado de Next.js; utiliza reservas temporales y claves de idempotencia para evitar duplicados durante los reintentos.
4. Con Mercado Pago configurado, recupera avisos perdidos con reservas y paginación, acredita cada cobro una sola vez y sincroniza los importes siguientes. Los envíos y la conciliación se ejecutan en paralelo.

`pnpm exec node scripts/configure-business-worker.mjs` vincula el secreto privado con su hash, prepara la función y el horario y verifica una ejecución. Comprueba que `.env.local` y el proyecto vinculado coincidan. Conserva los estados existentes de correos y pagos; para habilitar correos usa `--enable-email --app-url=https://www.menupro.cl` después de desplegar Next y verificar Resend. No habilita cobros. Consultar `correos-resend.md` para dominios, remitente y SMTP de autenticación.

El secreto privado da acceso exclusivamente a RPC de operaciones de MenuPro y a su despachador de avisos; no es una clave administrativa de InsForge y nunca debe publicarse. La clave de Resend permanece en Vercel. No se agrega una clave administrativa de InsForge a Next.js o Vercel.

## Configuración de Mercado Pago

Aplicación **MenuPro** creada el 1 de noviembre de 2026, ID `3623413345304006`. La credencial de prueba respondió HTTP 200 a la API de suscripciones y quedó guardada en local y Vercel; la firma está guardada como secreto en Vercel. La contratación sigue deshabilitada. Consultar `mercadopago.md` para el estado actualizado y las pruebas pendientes.

1. Crear o seleccionar la aplicación de Mercado Pago de Chile y sus credenciales de prueba.
2. Configurar en el servidor `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MENUPRO_WORKER_SECRET` y una `APP_URL` pública HTTPS.
3. Registrar `/api/payments/mercadopago/webhook` para los eventos `subscription_preapproval`, `subscription_authorized_payment` y `payment`.
4. Configurar MENUPRO_APP_URL y el mismo modo de cobros en el mantenimiento. La credencial de Mercado Pago permanece en Next/Vercel; no se necesita en InsForge. Nunca incluirla en variables públicas ni archivos versionados.
5. Habilitar `MENUPRO_BILLING_MODE=test` en ambos servicios y probar autorización, primer cobro diferido, renovación, rechazo, cancelación, cambio de importe y devoluciones con las cuentas de prueba del proveedor.
6. Habilitar producción únicamente después de revisar los resultados y autorizar el inicio de cobros reales.

Mientras no esté configurado, el panel permite consultar precios y la oferta, informa que la contratación online todavía no está disponible y no simula un pago exitoso. Las demos, permisos y transferencias verificadas pueden operar sin activar Mercado Pago.

El registro descargable de un pago es un comprobante del servicio y no sustituye la boleta de honorarios del SII. La emisión fiscal automática no forma parte de esta integración.

## Verificación

Validación del 31 de octubre de 2026: 5 pruebas de utilidades, 9 de autenticación y 10 de integración aprobadas. La prueba contra demos repetidas incluye el cierre del negocio y la eliminación de su cuenta original; las coincidencias de un nuevo solicitante siguen entrando en revisión.

Las ocho migraciones comerciales se aplicaron a DieGui Dev después de probarlas en una rama aislada, que se eliminó al terminar. El mantenimiento horario está desplegado y respondió correctamente. Se confirmó que todas las tablas de MenuPro tienen RLS, que el historial no es consultable de forma anónima y que el cliente no puede modificar directamente las suscripciones. No se trasladaron restaurantes, solicitudes ni pagos sintéticos al backend principal. La verificación de correo sigue habilitada.

- `pnpm typecheck`, `pnpm test` y `pnpm run build` verifican tipos, utilidades de pagos/firmas y compilación.
- `pnpm test:auth` verifica Google y recuperación de contraseña contra un servicio simulado, sin cuentas reales.
- `pnpm exec playwright test` verifica el recorrido y las reglas contra una rama aislada. Requiere la aplicación iniciada en el puerto 3000 y Chrome.
- Las pruebas preparan identidades verificadas, fechas y eventos sintéticos únicamente en esa rama. No equivalen a una certificación de cobros reales de Mercado Pago.

## Pendientes de activación externa

- Completar la prueba de checkout y notificaciones de Mercado Pago con su credencial de prueba y la firma configurada; después activar las credenciales productivas.
- Verificación del servicio de correo transaccional y habilitación explícita de envíos automáticos.
- Validar el recorrido comercial en la aplicación ya publicada en Vercel y aplicar nuevos despliegues al modificar variables.

La revisión de coincidencias está disponible como proceso administrativo. No se ha contratado un proveedor de SMS ni activado una verificación telefónica automática.
