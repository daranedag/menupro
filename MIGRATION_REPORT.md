# Resultado de la migración

Fecha: 30 de octubre de 2026.

## Aplicación

El directorio `MenuPro` reúne la landing, el panel y el BFF en una sola aplicación Next.js 16.4.3. El panel reutiliza los componentes React existentes y utiliza rutas nativas de Next.js. Se conservaron las imágenes de la landing y los textos de privacidad, términos y “Quiénes somos”.

Se usa únicamente pnpm, con un solo `package.json` y `pnpm-lock.yaml`. La configuración de Vercel instala y compila con pnpm. Se inició un repositorio Git local único, sin modificar los repositorios históricos.

## Backend

- InsForge: proyecto compartido **DieGui Dev**.
- Actualización autorizada del backend: 2.0.2 → 2.3.5.
- Migración: `20261030034956_menupro-core.sql`.
- Tablas: `menupro_profiles`, `menupro_restaurants`, `menupro_menus`, `menupro_menu_sections`, `menupro_menu_items`.
- Permisos por propietario y lectura pública limitada a cartas publicadas.
- Sesión mediante los helpers SSR de InsForge; el token de renovación usa una cookie HttpOnly.
- El MCP oficial quedó instalado/configurado con pnpm y se comprobó el descubrimiento de sus herramientas, incluidas `run-raw-sql` y `get-table-schema`.

La migración se ensayó en la rama aislada `menupro-migration`. La revisión final mostró 15 objetos nuevos, sin modificaciones ni conflictos; la incorporación a DieGui Dev terminó correctamente. Los datos de las pruebas no se incorporaron.

Por decisión del propietario, MenuPro comienza vacío. El Supabase anterior no resolvía por DNS y no se importaron sus datos ni sus usuarios. Los proyectos históricos se conservaron como referencia.

## Validación

- Compilación de producción de Next.js correcta.
- TypeScript correcto.
- Dos pruebas de utilidades correctas.
- Prueba del BFF correcta: persistencia, edición, eliminación, publicación, rechazo de cambios de otro usuario y comprobación de origen.
- Prueba de navegador correcta: landing de escritorio y móvil, registro, restaurante, carta, sección, plato, QR, publicación, acceso anónimo y persistencia al recargar.
- Las pruebas de integración crean cuentas solo en una rama aislada; la configuración rechaza ejecutarlas contra el proyecto padre.
- En DieGui Dev se verificaron cero registros en las cinco tablas, RLS activo y ausencia de permisos para lectura anónima directa o cambio de propietario. La verificación de correo sigue activa.
- La rama temporal y sus cuentas se eliminaron después de incorporar el esquema. La configuración local final apunta a DieGui Dev.

Capturas locales de la comprobación: `artifacts/landing-desktop.png`, `artifacts/landing-mobile.png`, `artifacts/panel-editor.png` y `artifacts/public-menu.png`. Muestran datos temporales de la rama de prueba.

## Alojamiento

La aplicación está preparada para Vercel con `vercel.json`, `.vercelignore` y variables documentadas en `README.md`. No se ha publicado un proyecto de Vercel ni se han cambiado DNS o la configuración remota de GitHub Pages.
