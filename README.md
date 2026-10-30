# MenuPro

Aplicación única de Next.js para la landing, el panel de restaurantes, la carta pública y el BFF. Usa **pnpm exclusivamente** e InsForge como base de datos y autenticación.

## Desarrollo

Requiere Node.js 22.13 o posterior y pnpm 11.1.2.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abre `http://localhost:3000`. La configuración local está en `.env.local` y no se versiona. `.env.example` documenta las variables necesarias.

## Funcionalidad básica

- Landing con acceso al panel desde escritorio y móvil.
- Registro, verificación por correo, login, renovación de sesión y logout con InsForge.
- Restaurantes y selección del restaurante activo.
- Crear, editar y eliminar cartas, secciones y platos; ordenar secciones y platos.
- Publicar/despublicar y pausar/ocultar contenido.
- Carta pública y QR con una dirección estable basada en los slugs del restaurante y de la carta.
- Vista previa privada, exportación PDF del editor existente y apariencia guardada en el restaurante.
- Páginas públicas de contacto, información, privacidad y términos.

La primera versión no incluye administración de planes, cobros ni facturación. No hay dependencias de Vite, Astro, Express, Bun ni del cliente de Supabase en la aplicación.

## Estructura

```text
src/app/         Rutas Next.js, landing, panel y endpoints /api
src/components/ Interfaz compartida y componentes reutilizados
src/contexts/   Estado del panel, sesión y apariencia
src/features/   Pantallas del panel
src/server/     BFF, validación y clientes InsForge del servidor
src/lib/        Utilidades compartidas
migrations/     Migraciones SQL versionadas
public/         Recursos de la landing existente
tests/          Pruebas de datos, permisos y navegador
```

## InsForge y migraciones

El destino es **DieGui Dev**. Todos los objetos propios usan el prefijo `menupro_`. La aplicación utiliza clientes con permisos del usuario y RLS; no necesita una clave administrativa en Vercel.

Tablas: `menupro_profiles`, `menupro_restaurants`, `menupro_menus`, `menupro_menu_sections` y `menupro_menu_items`.

```sh
pnpm db:status
pnpm db:new nombre-de-la-migracion
pnpm db:migrate
```

La CLI lee `.insforge/project.json`, que contiene credenciales privadas y está ignorado. Verifica siempre el proyecto vinculado con `pnpm exec insforge current` antes de aplicar cambios. Para cambios de permisos o esquema sobre datos existentes, prueba primero en una rama del backend.

La carta pública accede exclusivamente a `menupro_public_menu`, que devuelve contenido publicado y omite el identificador del propietario. Las operaciones de edición utilizan RLS y no permiten cambiar el propietario ni mover registros a otro restaurante mediante un PATCH.

MenuPro comienza vacío por decisión del propietario. No se trasladan usuarios ni datos del Supabase anterior; sus carpetas originales se conservan.

El MCP oficial de InsForge está registrado en la configuración local de Codex para DieGui Dev y se ejecuta con `pnpm dlx @insforge/mcp@1.2.11`. Es posible que Codex necesite recargar la conexión MCP para mostrar sus herramientas. No se guardan sus claves en el repositorio.

## Verificación

```sh
pnpm typecheck
pnpm test
pnpm run build
```

Las pruebas de integración están en `tests/integration`. Crean cuentas temporales y deben ejecutarse **solo contra una rama aislada** con verificación de correo desactivada, nunca contra el backend compartido. Requieren la aplicación iniciada en `http://localhost:3000` y Chrome instalado:

```sh
pnpm exec playwright test
```

## Vercel

`vercel.json` usa `pnpm install --frozen-lockfile` y `pnpm run build`. No se usa exportación estática: el BFF y las sesiones requieren el servidor de Next.js.

Configura estas variables en el proyecto de Vercel:

| Variable | Valor |
| --- | --- |
| `NEXT_PUBLIC_INSFORGE_URL` | URL de DieGui Dev |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | Clave pública del mismo backend |
| `APP_URL` | Origen público de la aplicación, sin rutas |

No subas `.env.local`, `.insforge` ni claves administrativas. Los previews también deben apuntar al backend elegido expresamente.

Para completar el cambio de alojamiento, crea un proyecto Vercel desde este directorio/repositorio, configura el dominio y verifica landing → login → panel → publicación → QR. Después desactiva GitHub Pages en el repositorio anterior. Esta migración local no modifica DNS ni desactiva un sitio publicado.
