# MenuPro en Neon

El 9 de noviembre de 2026 se autorizó iniciar una base nueva, sin trasladar restaurantes, cartas, pagos ni cuentas anteriores. El respaldo `20260421_022424.sql.gz` es un respaldo de plataforma de abril: no tiene tablas `menupro_`. Se conserva localmente e ignorado por Git; no se restaura sobre Neon.

## Destinos

- Proyecto: `bitter-heart-68907011`.
- Organización: `org-snowy-haze-69666506`.
- Rama de aplicación: `production`.
- Rama aislada de verificación: `menupro-migration-validation`, con vencimiento automático.

PostgreSQL, Neon Auth y PDFs fiscales privados usan Neon. Las imágenes siguen en el proveedor externo de cada negocio. Los correos comerciales usan Resend y los pagos conservan Mercado Pago. Ninguna solicitud de la aplicación necesita InsForge.

## Conexiones y acceso

Configura `DATABASE_URL` (agrupada), `DATABASE_URL_UNPOOLED` (directa), `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` y `MENUPRO_WORKER_SECRET` únicamente en `.env.local` o secretos del alojamiento. Nunca publiques sus valores. No uses el prefijo `NEXT_PUBLIC_`.

Neon Auth exige verificar el correo mediante un código. Autoriza los dominios de MenuPro en Neon. El proveedor compartido de Google sirve para comprobar el flujo; una aplicación pública debe configurar sus propias credenciales Google en Neon. Los correos de acceso usan el proveedor configurado en Neon, independiente del envío comercial de Resend.

El BFF verifica la sesión y sincroniza su identidad con `menupro_users`. Los roles `menupro_anon` y `menupro_authenticated` no tienen `BYPASSRLS`. Cada consulta de aplicación abre una transacción, establece un rol restringido y el identificador verificado con configuración local, y confirma o revierte antes de devolver la conexión al pool. Nunca se aceptan identificadores de sesión del cuerpo de una solicitud.

Las funciones comerciales existentes conservan sus validaciones y permisos. Los PDFs privados (máximo 2 MB) se guardan en `menupro_storage_objects` y mantienen sus permisos y comprobaciones SHA-256. No se habilita una API pública de SQL.

## Migraciones

```sh
pnpm db:status
pnpm db:new nombre-del-cambio
pnpm db:migrate
```

Se usa la conexión directa, TLS verificado, un bloqueo transaccional y checksums. Los archivos históricos de la raíz de `migrations/` permanecen intactos; el ejecutor adapta sus referencias conocidas de InsForge a objetos `menupro_`. La plataforma mínima y las migraciones futuras viven en `migrations/neon/`. No edites una migración aplicada.

La clave privada de mantenimiento se registra como hash al migrar. Si cambia `MENUPRO_WORKER_SECRET`, aplica `pnpm db:migrate` y actualiza los secretos de Vercel y GitHub juntos.

## Mantenimiento

`POST /api/internal/lifecycle` reemplaza la función alojada en InsForge. Requiere la clave privada de mantenimiento, aplica vencimientos y retención, procesa las colas habilitadas y registra su resultado. El workflow `.github/workflows/menupro-lifecycle.yml` lo invoca cada hora desde `main`, con el secreto GitHub `MENUPRO_WORKER_SECRET`.

El monitor independiente conserva `MENUPRO_MONITOR_TOKEN` y su workflow anterior. `scripts/configure-operations-watchdog.mjs` configura ambos secretos sin mostrarlos. Los scripts antiguos de configuración de InsForge y `functions/` se conservan solo como referencia; no se despliegan ni se ejecutan en la operación Neon.

## Comprobaciones

```sh
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:auth
pnpm run build
```

Las dos suites Neon exigen `.env.neon-validation.local` con la rama `menupro-migration-validation`. Las pruebas SQL revierten sus datos al terminar. La prueba de navegador usa cuentas sintéticas solo en esa rama, con correo y cobros desactivados. No desactives la verificación de correo en `production` para ejecutar pruebas.

El endpoint `/api/health` realiza una lectura pequeña de Neon antes de devolver el estado. El mantenimiento requiere una comprobación autenticada independiente.

Las suites históricas `tests/auth/` y `tests/integration/` dependen del proveedor anterior y no se ejecutan contra Neon. La validación de OAuth con una cuenta Google real y la recepción de códigos por una persona se completan manualmente; las pruebas automáticas no envían correos reales.
