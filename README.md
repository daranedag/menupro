# MenuPro

Aplicación única de Next.js para la landing, el panel de restaurantes, la carta pública y el BFF. Usa **pnpm exclusivamente** y Neon como base de datos y autenticación.

## Desarrollo

Requiere Node.js 22.13 o posterior y pnpm 11.1.2.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abre `http://localhost:3000`. La configuración local está en `.env.local` y no se versiona. `.env.example` documenta las variables necesarias.

## Funcionalidad básica

- Landing con acceso al panel desde escritorio y móvil.
- Registro e inicio de sesión con Google o correo, verificación por correo, renovación de sesión y logout con Neon Auth.
- Restaurantes y selección del restaurante activo.
- Crear, editar y eliminar cartas, secciones y platos; ordenar secciones y platos.
- Publicar/despublicar y pausar/ocultar contenido.
- Carta pública y QR con una dirección estable basada en los slugs del restaurante y de la carta.
- Vista previa privada, exportación PDF del editor existente y apariencia guardada en el restaurante.
- Páginas públicas de contacto, información, privacidad y términos.

La aplicación incluye cuentas de negocio con integrantes e invitaciones, planes Local/Grupo, demo de 15 días, revisión de registros repetidos, descuentos de bienvenida, controles de acceso por vigencia y administración de cortesías y pagos por transferencia. La integración de Mercado Pago está deshabilitada hasta configurar y verificar sus credenciales de prueba. No hay dependencias de Vite, Astro, Express, Bun ni del cliente de Supabase en la aplicación.

Las reglas aprobadas están en `docs/reglas-de-negocio.md`. La operación y configuración comercial están en `docs/operacion-comercial.md`.

La aplicación de Mercado Pago **MenuPro** (`3623413345304006`) y los pasos de integración están en `docs/mercadopago.md`. `pnpm payments:check` comprueba el acceso a la API de suscripciones sin crear cobros ni mostrar credenciales.

## Estructura

```text
src/app/         Rutas Next.js, landing, panel y endpoints /api
src/components/ Interfaz compartida y componentes reutilizados
src/contexts/   Estado del panel, sesión y apariencia
src/features/   Pantallas del panel
src/server/     BFF, validación y clientes Neon del servidor
src/lib/        Utilidades compartidas
migrations/     Migraciones SQL versionadas
public/         Recursos de la landing existente
tests/          Pruebas de datos, permisos y navegador
```

## Neon y migraciones

El proyecto es **bitter-heart-68907011**, organización **org-snowy-haze-69666506**, rama **production**. Todos los objetos propios usan el prefijo menupro_. La aplicación usa PostgreSQL directamente desde el BFF, con consultas parametrizadas, roles restringidos y RLS por usuario; la conexión nunca llega al navegador.

`DATABASE_URL` contiene la conexión agrupada de la app y `DATABASE_URL_UNPOOLED` la conexión directa para migraciones. `NEON_AUTH_BASE_URL` y `NEON_AUTH_COOKIE_SECRET` configuran el acceso de usuarios. Todos son privados y se guardan en .env.local o en el alojamiento.

```sh
pnpm db:status
pnpm db:new nombre-de-la-migracion
pnpm db:migrate
```

El ejecutor conserva el historial SQL original y adapta sus referencias de plataforma a objetos propios de MenuPro. Las migraciones nuevas se guardan en migrations/neon/. Se aplican con transacción, bloqueo y verificación de checksums. Primero deben probarse en una rama aislada.

El 9 de noviembre de 2026 se autorizó comenzar con datos nuevos en Neon: el respaldo de abril no contiene tablas de MenuPro y no se importan sus usuarios ni sus secretos. Las cuentas deben registrarse nuevamente. Se conservan el catálogo de planes, los permisos, las reglas comerciales y la cuenta administrativa configurada en las migraciones.

El acceso con Google y correo lo gestiona Neon Auth. Se exige verificar el correo con código antes de activar una demo. El SDK gestiona las cookies HttpOnly y el retorno de Google; el middleware completa el acceso en /app/dashboard. Los dominios de la aplicación deben estar autorizados en Neon. Un proveedor Google propio permite usar la marca de MenuPro en la pantalla de consentimiento.

Los PDFs fiscales privados se guardan en Neon con el límite existente de 2 MB y permisos de administrador/propietario. La biblioteca de imágenes sigue usando su proveedor externo.

Más detalles y operación: [docs/neon.md](docs/neon.md).

## Verificación

```sh
pnpm typecheck
pnpm test
pnpm test:auth
pnpm run build
```

La suite de autenticación actual usa una rama aislada de Neon, correo y cobros desactivados, y Chrome. Requiere .env.neon-validation.local con NEON_BRANCH=menupro-migration-validation. Las pruebas de permisos usan una transacción que se revierte al terminar. La suite del navegador crea identidades sintéticas solo en esa rama.

```sh
pnpm test:db
pnpm test:auth
```

Las suites anteriores de tests/auth y tests/integration y sus helpers de InsForge se conservan como referencia histórica; no son la verificación del backend Neon. Se usa Webpack en desarrollo y compilación.

## Vercel

`vercel.json` usa `pnpm install --frozen-lockfile` y `pnpm run build`. No se usa exportación estática: el BFF y las sesiones requieren el servidor de Next.js.

Configura estas variables en el proyecto de Vercel:

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_INSFORGE_URL` | URL de DieGui Dev |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | Clave pública del mismo backend |
| `APP_URL` | Origen público de la aplicación, sin rutas |
| `MENUPRO_WORKER_SECRET` | Secreto aleatorio privado, vinculado a su hash en `menupro_system_keys` |
| `MENUPRO_BILLING_MODE` | `disabled` inicialmente; `test` después de configurar Mercado Pago |
| `MERCADOPAGO_ACCESS_TOKEN` | Credencial privada de la integración de Mercado Pago |
| `MERCADOPAGO_WEBHOOK_SECRET` | Secreto de firma de las notificaciones de Mercado Pago |
| `MENUPRO_EMAIL_ENABLED` | `false` hasta verificar el servicio de correos transaccionales |
| `RESEND_API_KEY` | Clave privada de Resend con permiso de envío |
| `RESEND_FROM` | Remitente de un dominio verificado en Resend; formato `MenuPro <correo@dominio-verificado>` |
| `RESEND_REPLY_TO` | Dirección opcional para recibir respuestas, por ejemplo la casilla Gmail del negocio |

Las invitaciones y los recordatorios se envían por la API de Resend. Para activarlos, verifica el dominio remitente en Resend, configura `RESEND_API_KEY` y `RESEND_FROM` como variables privadas en Vercel y cambia `MENUPRO_EMAIL_ENABLED` a `true`. Repite la configuración en `.env.local` para probar localmente. Reconstruye el despliegue después de cambiar las variables. Mientras no se configure Resend, deja el envío en `false`. El mantenimiento horario en GitHub Actions llama al endpoint privado de Next y procesa Neon; no depende de InsForge. La configuración SMTP para los correos de autenticación y los pasos de activación están en `docs/correos-resend.md`.

La interfaz confirma si el proveedor aceptó el correo o muestra el enlace para compartirlo si no pudo enviarse. La invitación se conserva aunque Resend falle; aceptarla siempre exige iniciar sesión con el correo verificado del destinatario. Cada envío usa una clave de idempotencia basada en la invitación para evitar duplicados al repetir la misma solicitud al proveedor. Verificación y recuperación usan Neon Auth. Su proveedor SMTP se configura en Neon.

No subas `.env.local`, `.env.neon-validation.local`, `.insforge`, `.neon` ni credenciales. Los previews también deben apuntar al backend elegido expresamente.

Para completar el cambio de alojamiento, crea un proyecto Vercel desde este directorio/repositorio, configura el dominio y verifica landing → login → panel → publicación → QR. Después desactiva GitHub Pages en el repositorio anterior. Esta migración local no modifica DNS ni desactiva un sitio publicado.
